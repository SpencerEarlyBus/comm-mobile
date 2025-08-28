// src/screens/TopicsTodayScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Screen from '../components/Screen';

export default function TopicsTodayScreen() {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  return (
    <Screen scroll footerAware contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
    <View style={styles.root}>
      <Text style={styles.title}>Today’s Topics</Text>
      <Text style={styles.subtitle}>{today}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Suggested prompts</Text>
        <Text style={styles.item}>• Elevator pitch in 60s</Text>
        <Text style={styles.item}>• Explain your project to a non-expert</Text>
        <Text style={styles.item}>• Answer “What motivates you?”</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Warm-ups</Text>
        <Text style={styles.item}>• 30s articulate read</Text>
        <Text style={styles.item}>• Pause & breath pacing drill</Text>
      </View>
    </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, paddingBottom: 160, gap: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#64748b' },
  card: {
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 14, padding: 14, gap: 6,
  },
  cardTitle: { fontWeight: '800' },
  item: { fontSize: 16 },
});
