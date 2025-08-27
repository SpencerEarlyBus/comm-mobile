import React, { useState } from 'react';
import { View, TextInput, Button, Alert, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/api';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    try {
      setBusy(true);
      const { data } = await api.post('/api/login-mobile', { email, password });
      await SecureStore.setItemAsync('access_token', data.access);
      await SecureStore.setItemAsync('refresh_token', data.refresh);
      // you can store user payload if you want:
      await SecureStore.setItemAsync('user_email', data.user?.email ?? '');
      navigation.replace('Sessions');
    } catch (e: any) {
      Alert.alert('Login failed', e?.response?.data?.error ?? e?.message ?? 'Unknown error');
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
