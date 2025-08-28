// src/context/MobileAuthContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'comm_access_token';
const REFRESH_KEY = 'comm_refresh_token';
const PROFILE_KEY = 'comm_profile';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.api.domain/api';

type Profile = {
  id?: string;
  email: string;
  username?: string;
  role?: string;
  created_at?: string;                 // ← add
  leaderboard_permissions?: string[];
  leaderboard_preference?: any;
  report_preference?: any;
  phrase_sentence?: string;
  unique_fillers?: string[];
  unique_gesture_csv_path?: string;    // ← add
  email_verified?: boolean;
};

type Ctx = {
  user: Profile | null;
  authReady: boolean;
  isAuthenticated: boolean;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  updateUser: (patch: Partial<Profile>) => Promise<void>;
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
      await persist(data.access, data.refresh, data.user);
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
      const res = await fetch(`${API_BASE}/signup-mobile`, {        // <-- adjust if your route differs
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
      });
      if (!res.ok) return false;
      const data = await res.json(); // { access, refresh, user }
      if (!data?.access || !data?.refresh || !data?.user?.email) return false;
      await persist(data.access, data.refresh, data.user);
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
          body: JSON.stringify({ refresh: rt }), // <-- matches your backend
        });
        if (!res.ok) return false;
        const data = await res.json(); // { access, refresh }
        if (!data?.access || !data?.refresh) return false;

        // ROTATE tokens: store BOTH
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
      // DEBUG (remove after it works)
      console.log('[fetchWithAuth] token?', !!token, token?.slice(0, 12));
      if (token) headers.set('Authorization', `Bearer ${token}`);

      // DEBUG (remove after it works)
      console.log('[fetchWithAuth] →', url, 'Authorization:', headers.get('Authorization')?.slice(0, 20));
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
        if (!prev) return prev; // keep null if not logged in

        // Ensure required fields stay intact
        const next: Profile = {
        ...prev,
        ...patch,
        email: prev.email, // keep required string
        };

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
