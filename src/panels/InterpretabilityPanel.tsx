// src/panels/InterpretabilityPanel.tsx
import React, { useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { PanelProps } from './Panel.types';
import CollapsibleBox from '../components/CollapsibleBox';
import { COLORS as C } from '../theme/colors';
import { errorMsg } from '../utils/errorMsg';
import { useSessionInterpretabilityTxt } from '../hooks/useSessionInterpretabilityTxt';
import { parseInterpretabilityTxt, normalizeGradeToScore } from '../utils/parseInterpretabilityTxt';

const P = { pad: 12, radius: 12 };

function GradeMeter({
  label,
  grade,
  help,
}: {
  label: string;
  grade?: number | null;
  help?: string;
}) {
  const pct = Math.max(0, Math.min(100, normalizeGradeToScore(grade)));
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterRight}>
          {Number.isFinite(grade ?? NaN) ? `${(grade as number).toFixed(2)}` : '—'} grade
        </Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${pct}%` }]} />
      </View>
      {!!help && <Text style={styles.meterHelp}>{help}</Text>}
    </View>
  );
}

const InterpretabilityPanel: React.FC<PanelProps> = ({ sessionId }) => {
  const { text, isLoading, isError, error, refetch } = useSessionInterpretabilityTxt(sessionId, true);
  const onRetry = useCallback(() => { refetch(); }, [refetch]);

  const parsed = useMemo(() => (text ? parseInterpretabilityTxt(text) : undefined), [text]);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Info (collapsed) */}
      <CollapsibleBox title="Interpretability" initiallyCollapsed>
        <Text style={{ color: C.label }}>
          We estimate the reading grade level needed to understand your transcript using standard
          readability indices. Aim for an <Text style={{ fontWeight: '800', color: C.text }}>8–9</Text> grade level
          for broad accessibility.
        </Text>
      </CollapsibleBox>

      {/* Results */}
      <CollapsibleBox
        title="Results"
        initiallyCollapsed={false}
        backgroundColor={C.card}
        headerTint={C.text}
        borderColor={C.border}
      >
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading interpretability…</Text>
          </View>
        ) : isError ? (
          <View>
            <Text style={styles.errText}>Couldn’t load: {errorMsg(error)}</Text>
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !parsed ? (
          <Text style={styles.emptyText}>No interpretability data available.</Text>
        ) : (
          <View style={{ gap: 12 }}>


            <View style={styles.card}>
              <Text style={styles.cardTitle}>Readability metrics</Text>

              <GradeMeter
                label="Flesch–Kincaid"
                grade={parsed.fk}
                help="Estimated school grade level."
              />
              <GradeMeter
                label="SMOG Index"
                grade={parsed.smog}
                help="Uses polysyllable density (syllables per word)."
              />
              <GradeMeter
                label="Automated Readability (ARI)"
                grade={parsed.ari}
                help="Uses characters per word."
              />
              <GradeMeter
                label="Coleman–Liau Index"
                grade={parsed.cli}
                help="Uses letters per 100 words & sentence density."
              />

              <Text style={styles.tip}>
                Ideal window is <Text style={{ fontWeight: '800', color: C.text }}>8–9</Text>. Bars reflect how close
                each metric’s grade is to that window (100% = in-range).
              </Text>
            </View>
          </View>
        )}
      </CollapsibleBox>
    </View>
  );
};

export default InterpretabilityPanel;

const styles = StyleSheet.create({
  centerBox: { paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: C.label },
  errText: { color: C.danger, marginBottom: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8, backgroundColor: C.accent,
  },
  retryText: { color: C.white, fontWeight: '700' },
  emptyText: { color: C.label },

  inlineStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  kvLabel: { color: C.label, fontSize: 12 },
  kvValue: { color: C.white, fontSize: 16, fontWeight: '800' },

  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: P.radius,
    padding: P.pad,
    gap: 10,
  },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '800' },
  tip: { color: C.label, fontSize: 12, marginTop: 8 },

  meterHeader: {
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
  },
  meterFill: {
    height: 8,
    backgroundColor: C.accent,
    borderRadius: 999,
  },

  meterHelp: {
    color: C.label,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },

  rawText: { color: C.text, fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});
