// src/screens/LeaderboardScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Screen from '../components/Screen';

export default function LeaderboardScreen() {
  return (
    <Screen scroll footerAware contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
    <View style={styles.root}>
      <Text style={styles.title}>Leaderboard</Text>
      <Text style={styles.subtitle}>Coming soon…</Text>
      <Text style={styles.body}>
        We’ll show top performers, weekly trends, and your rank here.
      </Text>
    </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, paddingBottom: 160, gap: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 14, color: '#64748b' },
  body: { fontSize: 16 },
});
