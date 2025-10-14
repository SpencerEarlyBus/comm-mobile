import React, { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";


import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'comm_access_token';
const REFRESH_KEY = 'comm_refresh_token';
const PROFILE_KEY = 'comm_profile';


//ADD GOOGLE ID STUFF LATER



const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.api.domain/api';

type Profile = {
  id?: string;
  email: string;
  username?: string;
  role?: string;
  created_at?: string;
  leaderboard_permissions?: string[];
  leaderboard_preference?: any;
  report_preference?: any;
  phrase_sentence?: string;
  unique_fillers?: string[];
  unique_gesture_csv_path?: string;
  email_verified?: boolean;

  // NEW: list of tags the user follows
  followed_leaderboard_tags?: string[];
};

type Ctx = {
  user: Profile | null;
  authReady: boolean;
  isAuthenticated: boolean;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  updateUser: (patch: Partial<Profile>) => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
  signupWithPassword?: (email: string, password: string, username?: string) => Promise<boolean>;
  loginWithApple?: () => Promise<boolean>;
  quickLoginWithBiometric?: () => Promise<boolean>;
};

const AuthContext = createContext<Ctx | null>(null);

async function saveSecure(k: string, v: string) { await SecureStore.setItemAsync(k, v, { keychainService: 'commAuth' }); }
async function getSecure(k: string) { return SecureStore.getItemAsync(k); }
async function delSecure(k: string) { try { await SecureStore.deleteItemAsync(k); } catch {} }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const refreshFlight = useRef<Promise<boolean> | null>(null);
  const getAccessToken = useCallback(() => accessRef.current, []);

  // hydrate
  useEffect(() => {
    (async () => {
      try {
        const [p, a, r] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          getSecure(ACCESS_KEY),
          getSecure(REFRESH_KEY),
        ]);
        accessRef.current = a;
        refreshRef.current = r;
        setUser(p ? JSON.parse(p) : null);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);






  {/* 
  const persist = useCallback(async (access: string, refresh: string, profile?: Profile) => {
    accessRef.current = access;
    refreshRef.current = refresh;
    await Promise.all([
      saveSecure(ACCESS_KEY, access),
      saveSecure(REFRESH_KEY, refresh),
      profile ? AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) : Promise.resolve(),
    ]);
    if (profile) setUser(profile);
  }, []);
  */}

  // ---- Face ID / Biometric quick unlock
  const enableBiometric = useCallback(async () => {
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hardware && enrolled;
  }, []);

  async function saveSecureBiometric(k: string, v: string) {
    // iOS: require Face ID / Touch ID to read; Android: still stored securely (no per-read prompt)
    await SecureStore.setItemAsync(k, v, {
      keychainService: "commAuth",
      requireAuthentication: true,            // iOS only
      authenticationPrompt: "Unlock to sign in"
    } as any);
  }


  const persist = useCallback(async (access: string, refresh: string, profile?: Profile) => {
    accessRef.current = access;
    refreshRef.current = refresh;

    const canBio = await enableBiometric();
    await saveSecure(ACCESS_KEY, access); // normal
    if (canBio) {
      await saveSecureBiometric(REFRESH_KEY, refresh); // protected by Face ID when read
    } else {
      await saveSecure(REFRESH_KEY, refresh); // regular secure store
    }

    if (profile) {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      setUser(profile);
    }
  }, [enableBiometric]);



  // helper
  const bytesToHex = (b: Uint8Array) =>
    Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');

  // ---- APPLE
  async function _sha256(input: string) {
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  }

  const loginWithApple = useCallback(async () => {
    try {
      // was: Buffer.from(await Random.getRandomBytesAsync(16)).toString("hex")
      const rawBytes = await Crypto.getRandomBytesAsync(16);
      const rawNonce = bytesToHex(rawBytes);
      const hashedNonce = await _sha256(rawNonce);

      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        state: String(Date.now()),
        nonce: hashedNonce, // Apple will include SHA256(rawNonce) in the id_token's `nonce` claim
      });

      if (!cred.identityToken) return false;

      const r = await fetch(`${API_BASE}/api/auth/apple-mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity_token: cred.identityToken,
          raw_nonce: rawNonce, // backend verifies sha256(raw_nonce) === token's nonce
          user_name: cred.fullName ?? null,
        }),
      });
      if (!r.ok) return false;
      const data = await r.json();
      await persist(data.access, data.refresh, data.user);
      return true;
    } catch (e: any) {
      if (e?.code === 'ERR_CANCELED') return false;
      console.error('apple signin failed', e);
      return false;
    }
  }, [persist]);



  const quickLoginWithBiometric = useCallback(async () => {
    // iOS will prompt here because REFRESH_KEY was stored with requireAuthentication: true
    const rt = await getSecure(REFRESH_KEY); // pass authenticationPrompt in getSecure if you like
    if (!rt) return false;

    const res = await fetch(`${API_BASE}/api/refresh-mobile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: rt })
    });
    if (!res.ok) return false;
    const data = await res.json();
    await persist(data.access, data.refresh);
    return true;
  }, [persist]);




  const loginWithPassword = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/login-mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = await res.json(); // { access, refresh, user }
      if (!data?.access || !data?.refresh || !data?.user?.email) return false;
      await persist(data.access, data.refresh, data.user as Profile);
      return true;
    } catch (e) {
      console.error('login-mobile failed', e);
      return false;
    }
  }, [persist]);

  const logout = useCallback(async () => {
    accessRef.current = null;
    refreshRef.current = null;
    await Promise.all([
      delSecure(ACCESS_KEY),
      delSecure(REFRESH_KEY),
      AsyncStorage.removeItem(PROFILE_KEY),
    ]);
    setUser(null);
  }, []);

  const signupWithPassword = useCallback(async (email: string, password: string, username?: string) => {
    try {
      const res = await fetch(`${API_BASE}/signup-mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.access || !data?.refresh || !data?.user?.email) return false;
      await persist(data.access, data.refresh, data.user as Profile);
      return true;
    } catch (e) {
      console.error('signup-mobile failed', e);
      return false;
    }
  }, [persist]);

  // single-flight refresh that honors your /refresh-mobile contract
  const refreshAccess = useCallback(async (): Promise<boolean> => {
    if (refreshFlight.current) return refreshFlight.current;
    refreshFlight.current = (async () => {
      try {
        const rt = refreshRef.current;
        if (!rt) return false;
        const res = await fetch(`${API_BASE}/api/refresh-mobile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: rt }),
        });
        if (!res.ok) return false;
        const data = await res.json(); // { access, refresh }
        if (!data?.access || !data?.refresh) return false;
        await persist(data.access, data.refresh);
        return true;
      } catch (e) {
        console.error('refresh-mobile failed', e);
        return false;
      } finally {
        refreshFlight.current = null;
      }
    })();
    return refreshFlight.current;
  }, [persist]);

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const doFetch = async () => {
      const headers = new Headers(options.headers as HeadersInit);
      const token = accessRef.current;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...options, headers });
    };

    let res = await doFetch();
    if (res.status === 401) {
      const ok = await refreshAccess();
      if (!ok) {
        await logout();
        return res;
      }
      res = await doFetch();
    }
    return res;
  }, [refreshAccess, logout]);

  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    if (accessRef.current) return accessRef.current;
    const ok = await refreshAccess();
    return ok ? accessRef.current : null;
  }, [refreshAccess]);

  const updateUser = useCallback(async (patch: Partial<Profile>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next: Profile = { ...prev, ...patch, email: prev.email };
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    authReady,
    isAuthenticated: !!user?.email,
    loginWithPassword,
    signupWithPassword,
    logout,
    fetchWithAuth,
    updateUser,
    getValidAccessToken,
    loginWithApple,              
    quickLoginWithBiometric,  
  }), [
    user, authReady, loginWithPassword, signupWithPassword, logout,
    fetchWithAuth, updateUser, getValidAccessToken
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
