import React, { useState } from 'react';
import { View, TextInput, Button, Alert, Text } from 'react-native';
import { useAuth } from '../context/MobileAuthContext';

export default function SignupScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { signupWithPassword } = useAuth() as any;

  const onSignup = async () => {
    try {
      setBusy(true);
      const ok = await signupWithPassword?.(email.trim(), password, username.trim());
      if (!ok) {
        Alert.alert('Sign up failed', 'Unable to create account.');
        return;
      }
      navigation.replace('Sessions');
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Create an account</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 10, borderRadius: 12 }}
      />
      <TextInput
        placeholder="Username (optional)"
        autoCapitalize="none"
        onChangeText={setUsername}
        style={{ borderWidth: 1, padding: 10, borderRadius: 12 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        style={{ borderWidth: 1, padding: 10, borderRadius: 12 }}
      />
      <Button title={busy ? 'Creating…' : 'Sign up'} onPress={onSignup} disabled={busy} />
    </View>
  );
}
