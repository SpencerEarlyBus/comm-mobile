import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

type Props = {
  topic: string;
  countdown: number | null;
  onAbort: () => void;
};

export default function TopicCountdownPanel({ topic, countdown, onAbort }: Props) {
  const value = typeof countdown === 'number' ? countdown : 0;
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.label}>Your topic</Text>
        <Text style={styles.topic} numberOfLines={3}>
          {topic}
        </Text>

        <View style={styles.countWrap}>
          <View style={styles.countCircle}>
            <Text style={styles.countText}>{value}</Text>
          </View>
          <Text style={styles.sub}>Starting soon… get ready!</Text>
        </View>

        <Pressable onPress={onAbort} style={({ pressed }) => [styles.abortBtn, pressed && { opacity: 0.92 }]}>
          <Text style={styles.abortText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 12,
  },
  label: {
    color: COLORS.label,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  topic: { color: COLORS.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },

  countWrap: { alignItems: 'center', gap: 6, marginTop: 6 },
  countCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.ringBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: COLORS.white, fontWeight: '800', fontSize: 36 },
  sub: { color: COLORS.label, fontSize: 13 },

  abortBtn: {
    marginTop: 8,
    backgroundColor: COLORS.danger,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  abortText: { color: COLORS.white, fontWeight: '800' },
});
