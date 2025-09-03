// src/screens/LeaderboardScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import HeaderBar from '../components/HeaderBar';
import { COLORS } from '../theme/colors';

export default function LeaderboardScreen() {
  return (
    <View style={styles.container}>
      <HeaderBar
        title="Leaderboard"
        onPressNotifications={() => {}}
        onPressStatus={() => {}}
        dark
      />

      <Screen scroll footerAware contentStyle={styles.content}>
        <View style={styles.root}>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>Coming soon…</Text>
          <Text style={styles.body}>
            We’ll show top performers, weekly trends, and your rank here.
          </Text>
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  root: {
    flex: 1,
    padding: 20,
    paddingBottom: 160,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.label,
  },
  body: {
    fontSize: 16,
    color: COLORS.text,
  },
});
