// src/panels/ContentRelevancePanel.tsx
import React, { useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { PanelProps } from './Panel.types';
import { useSessionTextB } from '../hooks/useSessionTextB';
import { errorMsg } from '../utils/errorMsg';
import CollapsibleBox from '../components/CollapsibleBox';
import { COLORS as C } from '../theme/colors';

// ---- helpers (replace your current extractScore + useRelevanceScores) ----
type Metric = { key: string; label: string; max: number; value?: number; pct?: number };

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Accepts multiple label variants (e.g., "Imagery & Examples" OR "Imagery and Examples")
function extractScoreV2(src: string, labels: string[], expectedMax: number):
  | { value: number; max: number }
  | undefined {
  for (const raw of labels) {
    const name = escapeRe(raw);

    // 1) "**Label (25/30):** ..."   (handles bullets/asterisks)
    const re1 = new RegExp(
      `[\\-•\\s]*\\*{0,2}\\s*${name}\\s*\\((\\d+(?:\\.\\d+)?)\\s*\\/\\s*(\\d+)\\)\\s*:\\s*\\*{0,2}`,
      'i'
    );

    // 2) "Label: 25/30"
    const re2 = new RegExp(`${name}\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)\\s*\\/\\s*(\\d+)`, 'i');

    // 3) "Label (/30): 25"
    const re3 = new RegExp(`${name}\\s*\\(\\s*\\/\\s*${expectedMax}\\s*\\)\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)`, 'i');

    // 4) Fallback "Label: 25"
    const re4 = new RegExp(`${name}\\s*[:\\-]\\s*(\\d+(?:\\.\\d+)?)\\b`, 'i');

    for (const re of [re1, re2, re3, re4]) {
      const m = src.match(re);
      if (m) {
        const val = parseFloat(m[1]);
        const max = m[2] ? parseFloat(m[2]) : expectedMax;
        if (Number.isFinite(val) && Number.isFinite(max) && max > 0) {
          return { value: val, max };
        }
      }
    }
  }
  return undefined;
}

function useRelevanceScores(text?: string) {
  return React.useMemo<Metric[]>(() => {
    if (!text) return [];

    const defs: { key: string; labels: string[]; label: string; max: number }[] = [
      { key: 'directness', labels: ['Directness'], label: 'Directness', max: 30 },
      {
        key: 'imagery',
        labels: ['Imagery & Examples', 'Imagery and Examples'],
        label: 'Imagery & Examples',
        max: 20,
      },
      { key: 'focus', labels: ['Focus'], label: 'Focus', max: 20 },
      { key: 'coverage', labels: ['Coverage'], label: 'Coverage', max: 20 },
      { key: 'accuracy', labels: ['Accuracy'], label: 'Accuracy', max: 10 },
    ];

    return defs.map((d) => {
      const res = extractScoreV2(text, d.labels, d.max);
      const value = res?.value;
      const max = res?.max ?? d.max;
      const pct = value != null ? Math.max(0, Math.min(100, (value / max) * 100)) : undefined;
      return { key: d.key, label: d.label, max, value, pct };
    });
  }, [text]);
}

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <View style={{ marginTop: 8 }}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterRight}>{Math.round(value)}/{max}</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const ContentRelevancePanel: React.FC<PanelProps> = ({ sessionId }) => {
  const { text, isLoading, isError, error, refetch } = useSessionTextB(sessionId, true);
  const onRetry = useCallback(() => { refetch(); }, [refetch]);

  const scores = useRelevanceScores(text);
  const hasAnyScore = scores.some(s => Number.isFinite(s.value));

  // If all five were found, show an overall out of 100
  const overallOutOf100 = useMemo(() => {
    const wanted = {
      Directness: 30, 'Imagery & Examples': 20, Focus: 20, Coverage: 20, Accuracy: 10,
    } as const;
    const found = scores.reduce((acc, s) => acc + (s.value ?? 0), 0);
    const max = Object.values(wanted).reduce((a, b) => a + b, 0);
    return Math.round(Math.max(0, Math.min(100, (found / max) * 100)));
  }, [scores]);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Description — collapsed by default */}
      <CollapsibleBox title="Content relevance" initiallyCollapsed>
        <Text style={{ color: C.label }}>
          This metric assesses how relevant your presentation was to the given topic. It considers
          directness, use of examples, focus, coverage, and accuracy.
        </Text>
      </CollapsibleBox>

      {/* Scores — bars above the notes */}
      <CollapsibleBox
        title="Relevance scores"
        initiallyCollapsed={false}
        backgroundColor={C.card}
        headerTint={C.text}
        borderColor={C.border}
      >
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading scores…</Text>
          </View>
        ) : isError ? (
          <View>
            <Text style={styles.errText}>Couldn’t load: {errorMsg(error)}</Text>
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !text ? (
          <Text style={{ color: C.label }}>No relevance data available.</Text>
        ) : !hasAnyScore ? (
          <Text style={{ color: C.label }}>No sub-scores found in the document.</Text>
        ) : (
          <View>
            {/* Overall (only if all 5 present) */}
            {scores.filter(s => s.value != null).length >= 5 && (
              <View style={{ marginBottom: 6 }}>
                <View style={styles.meterHeader}>
                  <Text style={[styles.meterLabel, { fontWeight: '800' }]}>Overall</Text>
                  <Text style={styles.meterRight}>{overallOutOf100}/100</Text>
                </View>
                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${overallOutOf100}%` }]} />
                </View>
              </View>
            )}

            {/* Individual meters */}
            {scores.map(s => (
              s.value != null ? (
                <Meter key={s.key} label={s.label} value={s.value} max={s.max} />
              ) : (
                <Text key={s.key} style={{ color: C.label, marginTop: 8 }}>
                  {s.label}: —
                </Text>
              )
            ))}
          </View>
        )}
      </CollapsibleBox>

      {/* Notes — expanded by default */}
      <CollapsibleBox
        title="Relevance notes"
        initiallyCollapsed={false}
        backgroundColor={C.card}
        headerTint={C.text}
        borderColor={C.border}
      >
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading relevance notes…</Text>
          </View>
        ) : isError ? (
          <View>
            <Text style={styles.errText}>Couldn’t load notes: {errorMsg(error)}</Text>
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : text ? (
          <ScrollView
            nestedScrollEnabled
            contentContainerStyle={{ paddingVertical: 2 }}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 320 }}
          >
            <Text style={styles.mono} selectable>
              {text}
            </Text>
          </ScrollView>
        ) : (
          <Text style={{ color: C.label }}>No content-relevance notes available.</Text>
        )}
      </CollapsibleBox>
    </View>
  );
};

export default ContentRelevancePanel;

const styles = StyleSheet.create({
  centerBox: { paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: C.label },
  errText: { color: C.danger, marginBottom: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  retryText: { color: C.white, fontWeight: '700' },
  mono: {
    color: C.text,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },

  // meters
  meterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  meterLabel: { color: C.label, fontSize: 12, fontWeight: '600' },
  meterRight: { color: C.text, fontSize: 12, fontWeight: '700' },
  meterTrack: {
    height: 8,
    backgroundColor: C.track,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  meterFill: { height: 8, backgroundColor: C.accent, borderRadius: 999 },
});
