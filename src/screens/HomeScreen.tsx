// src/screens/HomeScreen.tsx
import React, { useState } from 'react';
import { View, Text, Image, Pressable, TextInput, Button, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/MobileAuthContext';
import { useNavigation } from '@react-navigation/native';

type Mode = 'login' | 'signup';

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const { authReady, isAuthenticated, user, loginWithPassword, signupWithPassword, logout } = useAuth() as any;

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    try {
      setBusy(true);
      const ok = await loginWithPassword(email.trim(), password);
      if (!ok) return Alert.alert('Login failed', 'Check your credentials.');
      nav.reset({ index: 0, routes: [{ name: 'Sessions' }] });
    } finally { setBusy(false); }
  };

  const onSignup = async () => {
    try {
      setBusy(true);
      const ok = await signupWithPassword(email.trim(), password, username.trim());
      if (!ok) return Alert.alert('Sign up failed', 'Unable to create account.');
      nav.reset({ index: 0, routes: [{ name: 'Sessions' }] });
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#0ea5e9', '#6366f1', '#8b5cf6']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 80, alignItems: 'center' }}>
          <Image
            source={require('../../assets/heading.png')}
            resizeMode="contain"
            style={{ width: '85%', height: 120, marginBottom: 12 }}
          />
          <Text style={{ textAlign: 'center', color: 'white', fontSize: 18, opacity: 0.9 }}>
            Measure, improve, and showcase your communication performance.
          </Text>

          {/* Glass card */}
          <View
            style={{
              marginTop: 28,
              width: '100%',
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderColor: 'rgba(255,255,255,0.25)',
              borderWidth: 1,
              padding: 18,
              borderRadius: 20,
            }}
          >
            {authReady && isAuthenticated ? (
              <>
                <Text style={{ color: 'white', fontSize: 16 }}>
                  Signed in as <Text style={{ fontWeight: '700' }}>{user?.email}</Text>
                </Text>
                <View style={{ height: 12 }} />
                <PrimaryButton label="Continue to Sessions" onPress={() => nav.navigate('Sessions')} />
                <View style={{ height: 10 }} />
                <SecondaryButton label="Log out" onPress={async () => {
                  await logout();
                  // stay on Home
                }} />
              </>
            ) : (
              <>
                {/* Tabs */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <TabButton active={mode === 'login'} label="Log in" onPress={() => setMode('login')} />
                  <TabButton active={mode === 'signup'} label="Sign up" onPress={() => setMode('signup')} />
                </View>

                {/* Forms */}
                <View style={{ gap: 10 }}>
                  {mode === 'signup' && (
                    <TextInput
                      placeholder="Username (optional)"
                      placeholderTextColor="rgba(255,255,255,0.8)"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      style={inputStyle}
                    />
                  )}
                  <TextInput
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.8)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={inputStyle}
                  />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.8)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={inputStyle}
                  />
                  <Button
                    title={busy ? (mode === 'login' ? 'Signing in…' : 'Creating…') : (mode === 'login' ? 'Log in' : 'Sign up')}
                    onPress={mode === 'login' ? onLogin : onSignup}
                    disabled={busy}
                  />
                </View>
              </>
            )}
          </View>

          {/* Footer */}
          <Text style={{ position: 'absolute', bottom: 24, color: 'white', opacity: 0.8 }}>
            © {new Date().getFullYear()} Comm
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: active ? 0 : 1,
        borderColor: 'rgba(255,255,255,0.5)',
        backgroundColor: active ? 'white' : 'transparent',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: active ? '#0f172a' : 'white', fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: pressed ? 'rgba(255,255,255,0.75)' : 'white',
        alignItems: 'center',
      })}
    >
      <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'white',
        backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'transparent',
        alignItems: 'center',
      })}
    >
      <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.35)',
  backgroundColor: 'rgba(255,255,255,0.12)',
  color: 'white',
  padding: 12,
  borderRadius: 12,
} as const;
