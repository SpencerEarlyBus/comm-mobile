// src/panels/ReinforcedEngagementPanel.tsx
import React, { useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { PanelProps } from './Panel.types';
import { useSessionJsonA } from '../hooks/useSessionJsonA';
import { errorMsg } from '../utils/errorMsg';
import CollapsibleBox from '../components/CollapsibleBox';
import { COLORS as C } from '../theme/colors';

type Engagement = {
  frame_count?: number;
  by_metric?: Record<string, number>;   // 0..1
  fractions?: { body?: number; vocal?: number; expressive?: number; any?: number };
  engaged_flags?: { body?: boolean; vocal?: boolean; expressive?: boolean; any?: boolean };
};

type Item = {
  phrase: string;
  impact?: number; // 0..100
  why?: string;
  start?: number;
  end?: number;
  start_ms?: number;
  end_ms?: number;
  engagement?: Engagement;
  pause_ms_after?: number;
  has_pause_after?: boolean;
};

type REJson = {
  topic?: string;
  summary?: string;
  items?: Item[];
  overall_score?: number; // 0..100
  sources?: Record<string, string>;
  config?: Record<string, unknown>;
};

const P = {
  pad: 12,
  radius: 12,
};

const pct = (v?: number | null) =>
  typeof v === 'number' && isFinite(v) ? Math.round(v * 100) : 0;

function Meter({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={styles.meterRow}>
      <Text style={styles.meterLabel}>{label}</Text>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${v}%` }]} />
      </View>
      <Text style={styles.meterValue}>{v}%</Text>
    </View>
  );
}

export default function ReinforcedEngagementPanel({ sessionId }: PanelProps) {
  const { data, isLoading, isError, error, refetch } = useSessionJsonA(sessionId, true);
  const onRetry = useCallback(() => { refetch(); }, [refetch]);

  const json = data as REJson | undefined;

  const { topItem, itemsSorted } = useMemo(() => {
    const list = Array.isArray(json?.items) ? [...json!.items] : [];
    // Sort by impact desc (fallback 0)
    list.sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0));
    return { topItem: list[0], itemsSorted: list };
  }, [json]);

  const pretty = useMemo(() => (data ? JSON.stringify(data, null, 2) : ''), [data]);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Description — collapsed by default */}
      <CollapsibleBox title="Reinforced Engagement" initiallyCollapsed>
        <Text style={{ color: C.label }}>
          This composite metric aligns the key ideas in your talk with engagement indicators
          (gestures, vocal variety, effective pauses, etc.) to estimate how compelling those
          moments were.
        </Text>
      </CollapsibleBox>

      {/* Summary + top metric */}
      <CollapsibleBox title="Highlights" initiallyCollapsed={false} backgroundColor={C.card} headerTint={C.text} borderColor={C.border}>
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading highlights…</Text>
          </View>
        ) : isError ? (
          <View>
            <Text style={styles.errText}>Couldn’t load: {errorMsg(error)}</Text>
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !json ? (
          <Text style={styles.emptyText}>No data available.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {/* Summary */}
            {!!json.summary && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Summary</Text>
                <Text style={styles.body}>{json.summary}</Text>
              </View>
            )}

            {/* Overall score */}
            {typeof json.overall_score === 'number' && (
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Reinforced Engagement</Text>
                
              </View>
            )}

            {/* Top key phrase */}
            {!!topItem && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Top key phrase</Text>
                <Text style={styles.phrase}>"{topItem.phrase}"</Text>

                <View style={styles.inlineStat}>
                  <Text style={styles.kvLabel}>Impact</Text>
                  <Text style={styles.kvValue}>{Math.round(topItem.impact ?? 0)}</Text>
                </View>

                {!!topItem.why && <Text style={styles.body}>{topItem.why}</Text>}

                {/* Pause after */}
                <View style={styles.inlineStat}>
                  <Text style={styles.kvLabel}>Pause after</Text>
                  <Text style={styles.kvValue}>
                    {topItem.has_pause_after ? 'True' : 'False'}
                  </Text>
                </View>

                {/* Engagement breakdown (fractions) */}
                {!!topItem.engagement?.fractions && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    <Text style={styles.subheading}>Engagement breakdown</Text>
                    <Meter label="Body Engagement" value={pct(topItem.engagement.fractions.body)} />
                    <Meter label="Vocal Engagement" value={pct(topItem.engagement.fractions.vocal)} />
                    <Meter label="Expression" value={pct(topItem.engagement.fractions.expressive)} />
                  </View>
                )}

              </View>
            )}
          </View>
        )}
      </CollapsibleBox>

      {/* Other key phrases list (besides top) */}
      {!isLoading && !isError && !!itemsSorted && itemsSorted.length > 1 && (
        <CollapsibleBox
          title="Other key phrases"
          initiallyCollapsed={false}
          backgroundColor={C.card}
          headerTint={C.text}
          borderColor={C.border}
        >
          <View style={{ gap: 10 }}>
            {itemsSorted.slice(1).map((it, idx) => (
              <View key={`${it.phrase}-${idx}`} style={styles.rowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.phraseSmall} numberOfLines={2}>"{it.phrase}"</Text>
                  {!!it.why && <Text style={styles.why}>{it.why}</Text>}
                </View>
                <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>
                  <Text style={styles.kvLabel}>Impact</Text>
                  <Text style={styles.kvValue}>{Math.round(it.impact ?? 0)}</Text>
                  <Text style={[styles.kvLabel, { marginTop: 4 }]}>Pause</Text>
                  <Text style={styles.kvValue}>
                    {it.has_pause_after ? 'True' : 'False'}
                  </Text>
                </View>

                {/* Quick mini breakdown (fractions only) */}
                {!!it.engagement?.fractions && (
                  <View style={{ marginTop: 10, width: '100%' }}>
                    <Meter label="Body Engagement" value={pct(it.engagement.fractions.body)} />
                    <Meter label="Vocal Engagement" value={pct(it.engagement.fractions.vocal)} />
                    <Meter label="Expression" value={pct(it.engagement.fractions.expressive)} />
                  </View>
                )}
              </View>
            ))}
          </View>
        </CollapsibleBox>
      )}

    </View>
  );
}

function prettyMetric(key: string) {
  // posture_engaged -> Posture
  const base = key.replace(/_engaged$/i, '');
  return base
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  centerBox: { paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: C.label },
  errText: { color: C.danger, marginBottom: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8, backgroundColor: C.accent,
  },
  retryText: { color: 'white', fontWeight: '700' },
  emptyText: { color: C.label },

  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: P.radius,
    padding: P.pad,
    gap: 8,
  },
  rowCard: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: P.radius,
    padding: P.pad,
    gap: 6,
  },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '800' },
  body: { color: C.text, fontSize: 14 },

  phrase: { color: C.white, fontSize: 16, fontWeight: '800' },
  phraseSmall: { color: C.white, fontSize: 14, fontWeight: '800' },
  why: { color: C.label, fontSize: 12, marginTop: 2 },

  inlineStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 2,
  },
  kvLabel: { color: C.label, fontSize: 12 },
  kvValue: { color: C.white, fontSize: 16, fontWeight: '800' },

  subheading: { color: C.label, fontSize: 12, fontWeight: '700' },

  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  meterLabel: { color: C.label, fontSize: 12, width: 86 },
  meterTrack: {
    flex: 1,
    height: 8,
    backgroundColor: C.track,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meterFill: {
    height: 8,
    backgroundColor: C.accent,
    borderRadius: 999,
  },
  meterValue: { color: C.white, fontSize: 12, fontWeight: '700', marginLeft: 6, width: 44, textAlign: 'right' },

  rawJson: {
    color: C.text,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});
