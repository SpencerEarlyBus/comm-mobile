import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { COLORS as C } from '../theme/colors';

type MetricsMap = Record<string, number | undefined>;

type Props = {
  visible: boolean;
  onClose: () => void;
  name: string;
  email?: string | null;
  rating?: number;
  metrics?: MetricsMap | null;
  lastSessionId?: string | null;
  onOpenSession?: (sessionId: string) => void;
};

const LABELS: Record<string, string> = {
  filler_usage: 'Filler Usage',
  motion_score: 'Motion',
  vocal_rhythm: 'Vocal Rhythm',
  gesture_score: 'Gestures',
  posture_score: 'Posture',
  interpretability: 'Interpretability',
  content_relevance: 'Content Relevance',
  vocal_expressiveness: 'Vocal Expressiveness',
  reinforced_engagement: 'Reinforced Engagement',
};

const ORDER = [
  'reinforced_engagement',
  'content_relevance',
  'interpretability',
  'vocal_expressiveness',
  'vocal_rhythm',
  'posture_score',
  'gesture_score',
  'motion_score',
  'filler_usage',
];

export default function ParticipantMetricsModal({
  visible,
  onClose,
  name,
  email,
  rating,
  metrics,
  lastSessionId,
  onOpenSession,
}: Props) {
  const entries = React.useMemo(() => {
    const m = metrics || {};
    // Keep only keys we know & have finite values
    return ORDER
      .map(k => [k, m[k]] as const)
      .filter(([, v]) => typeof v === 'number' && isFinite(v as number));
  }, [metrics]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{name}</Text>
              {!!email && <Text style={styles.subtitle} numberOfLines={1}>{email}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={8}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <View style={styles.row}>
            <Text style={styles.kvLabel}>Rating</Text>
            <Text style={styles.kvValue}>{typeof rating === 'number' ? Math.round(rating) : '—'}</Text>
          </View>

          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingVertical: 6 }}>
            {entries.length === 0 ? (
              <Text style={styles.muted}>No per-metric averages available.</Text>
            ) : (
              entries.map(([key, val]) => (
                <MetricBar key={key} label={LABELS[key] ?? key} value={Math.round(val as number)} />
              ))
            )}
          </ScrollView>

          {!!lastSessionId && !!onOpenSession && (
            <Pressable
              onPress={() => onOpenSession(lastSessionId)}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryText}>Open latest session</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterValue}>{v}/100</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${v}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  card: {
    width: '100%', maxWidth: 520,
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    padding: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { color: C.white, fontSize: 18, fontWeight: '800' },
  subtitle: { color: C.label, fontSize: 12, marginTop: 2 },
  close: { color: C.label, fontSize: 20, paddingHorizontal: 6, paddingVertical: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  kvLabel: { color: C.label, fontSize: 12 },
  kvValue: { color: C.white, fontSize: 16, fontWeight: '800' },
  muted: { color: C.label, marginTop: 6 },
  meterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  meterLabel: { color: C.text, fontSize: 13, fontWeight: '700' },
  meterValue: { color: C.white, fontSize: 12, fontWeight: '700' },
  meterTrack: { height: 8, backgroundColor: C.track, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: 8, backgroundColor: C.accent, borderRadius: 999 },
  primaryBtn: {
    marginTop: 12, alignSelf: 'flex-start',
    backgroundColor: C.accent, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  primaryText: { color: C.white, fontWeight: '800' },
});
