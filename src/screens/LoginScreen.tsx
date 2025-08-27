// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert, Text } from 'react-native';
import { useAuth } from '../context/MobileAuthContext';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { loginWithPassword } = useAuth();

  const onLogin = async () => {
    try {
      setBusy(true);
      const ok = await loginWithPassword(email.trim(), password);
      if (!ok) {
        Alert.alert('Login failed', 'Invalid credentials');
        return;
      }
      // Tokens + profile are saved by the context.
      navigation.replace('Sessions');
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Log in</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />
      <Button title={busy ? 'Signing in…' : 'Log in'} onPress={onLogin} disabled={busy} />
    </View>
  );
}
