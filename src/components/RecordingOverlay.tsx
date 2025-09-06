import React from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

type Props = {
  countdown: number | null;
  recording: boolean;
  uploading: boolean;
  onAbort?: () => void;
};

export default function RecordingOverlay({ countdown, recording, uploading, onAbort }: Props) {
  const locked = countdown !== null || recording; 

  if (!locked) return null;

  return (
    <View style={styles.overlay}>
      {countdown !== null && <Text style={styles.countText}>{countdown}</Text>}
      {recording && <Text style={styles.statusText}>Recording… (up to 1 min)</Text>}
      {uploading && (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="large" />
          <Text style={styles.statusText}>Uploading…</Text>
        </View>
      )}

      {(countdown !== null || recording) && !uploading && (
        <Pressable
          onPress={onAbort}
          style={({ pressed }) => [styles.abortBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.abortText}>Abort</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  countText: { fontSize: 64, color: COLORS.white, fontWeight: '800' },
  statusText: { marginTop: 6, fontSize: 18, color: COLORS.white, fontWeight: '700' },
  abortBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999,
    backgroundColor: COLORS.danger,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  abortText: { color: COLORS.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
});
