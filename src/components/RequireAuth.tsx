// src/components/RequireAuth.tsx
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/MobileAuthContext';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authReady, isAuthenticated } = useAuth();
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (authReady && !isAuthenticated) {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] }); // ← go to Home instead of Login
    }
  }, [authReady, isAuthenticated, navigation]);

  if (!authReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!isAuthenticated) return null;
  return <>{children}</>;
}