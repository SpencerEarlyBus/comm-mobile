import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import AppCard from './AppCard';
import { COLORS as C } from '../theme/colors';
import { T } from '../theme/typography';
import { S } from '../theme/spacing';

type Props = {
  visible: boolean;
  onClose: () => void;
  name: string;
  metrics: Record<string, number> | null | undefined;
};

const niceLabel = (k: string) => k
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase());

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function Meter({ label, value }: { label: string; value: number }) {
  const v = clamp(Math.round(value));
  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.meterRow}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterRight}>{v}/100</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${v}%` }]} />
      </View>
    </View>
  );
}

export default function MetricsOnlyModal({ visible, onClose, name, metrics }: Props) {
  const entries = React.useMemo(() => {
    const m = metrics || {};
    return Object.entries(m);
  }, [metrics]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <AppCard style={styles.sheet}>
          <Text style={[T.h2]}>Metrics — {name}</Text>
          <Text style={[T.subtle, { marginTop: S.xs }]}>
            These are average scores across sessions on this board.
          </Text>

          {entries.length === 0 ? (
            <Text style={[T.subtle, { marginTop: S.md }]}>No metrics available.</Text>
          ) : (
            <ScrollView
              style={{ marginTop: S.md, maxHeight: 360 }}
              contentContainerStyle={{ paddingBottom: S.sm }}
              showsVerticalScrollIndicator={false}
            >
              {entries.map(([k, v]) => (
                <Meter key={k} label={niceLabel(k)} value={Number(v) || 0} />
              ))}
            </ScrollView>
          )}

          <View style={{ flexDirection: 'row', columnGap: 10, marginTop: S.md }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [T.buttonPrimary, pressed && T.buttonPressed]}
            >
              <Text style={T.buttonPrimaryText}>Close</Text>
            </Pressable>
          </View>
        </AppCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,8,23,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.lg,
  },
  sheet: {
    width: '100%',
  },
  meterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  meterLabel: { color: C.label, fontSize: 12, fontWeight: '600' },
  meterRight: { color: C.text, fontSize: 12, fontWeight: '700' },
  meterTrack: {
    height: 8,
    backgroundColor: C.track,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  meterFill: {
    height: 8,
    backgroundColor: C.accent,
    borderRadius: 999,
  },
});
