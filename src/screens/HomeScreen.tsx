// src/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { env } from '../utils/env';

type Nav = { navigation: { navigate: (route: string) => void } };

const Btn = ({ title, onPress }: { title: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      backgroundColor: pressed ? '#2563eb' : '#3b82f6',
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 12,
      marginVertical: 8,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    })}
  >
    <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center', fontSize: 16 }}>
      {title}
    </Text>
  </Pressable>
);

export default function HomeScreen({ navigation }: Nav) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
        {/* Branding / Title */}
        <Text style={{ color: 'white', fontSize: 28, fontWeight: '800', marginBottom: 6 }}>
          Comm Mobile
        </Text>
        <Text style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 24 }}>
          Record a session, upload to S3, and review your results.
        </Text>

        {/* Primary actions */}
        <Btn title="Log in" onPress={() => navigation.navigate('Login')} />
        <Btn title="View Sessions" onPress={() => navigation.navigate('Sessions')} />
        <Btn title="Record a Video" onPress={() => navigation.navigate('Recorder')} />

        {/* Footer / Env hint */}
        <View style={{ marginTop: 24 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            API: {env.apiBase}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
