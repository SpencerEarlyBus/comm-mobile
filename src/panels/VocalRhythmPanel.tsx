// src/panels/VocalRhythmPanel.tsx
import React, { useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { PanelProps } from './Panel.types';
import CollapsibleBox from '../components/CollapsibleBox';
import { COLORS as C } from '../theme/colors';
import { useSessionVocalFeaturesTxt } from '../hooks/useSessionVocalFeaturesTxt';
import { parseVocalFeaturesTxt } from '../utils/parseVocalFeaturesTxt';
import { errorMsg } from '../utils/errorMsg';

const P = { pad: 12, radius: 12 };

function Meter({ label, value }: { label: string; value?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value ?? 0)));
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

const VocalRhythmPanel: React.FC<PanelProps> = ({ sessionId }) => {
  // swap to the new hook that reads vocal_features_txt
  const { text, isLoading, isError, error, refetch } = useSessionVocalFeaturesTxt(sessionId, true);
  const onRetry = useCallback(() => { refetch(); }, [refetch]);

  const parsed = useMemo(() => (text ? parseVocalFeaturesTxt(text) : undefined), [text]);

  // human hint for WPM range
  const paceHint = useMemo(() => {
    const w = parsed?.wpm ?? 0;
    if (!w) return '–';
    if (w < 120) return 'A bit slow (optimal ≈ 120–160 WPM)';
    if (w > 160) return 'A bit fast (optimal ≈ 120–160 WPM)';
    return 'In the optimal range (≈ 120–160 WPM)';
  }, [parsed?.wpm]);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Description — collapsed by default */}
      <CollapsibleBox title="Vocal pace"               
                    initiallyCollapsed
                    backgroundColor={C.card}
                    borderColor={C.border}
                    headerTint={C.text}
                  >
        <Text style={{ color: C.label }}>
          This metric evaluates your speaking pace and cadence. We consider words per minute (WPM) and
          rhythm consistency over time. Optimal comprehension is often around 120–160 WPM.
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
            <Text style={styles.loadingText}>Loading vocal pace…</Text>
          </View>
        ) : isError ? (
          <View>
            <Text style={styles.errText}>Couldn’t load: {errorMsg(error)}</Text>
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !parsed ? (
          <Text style={styles.emptyText}>No vocal-features data available.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {/* Top-line pace */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Words per Minute</Text>
              <Text style={styles.bigValue}>
                {parsed.wpm != null ? `${Math.round(parsed.wpm)} WPM` : '—'}
              </Text>
              <Text style={styles.hint}>{paceHint}</Text>
            </View>

            {/* Required meters: Speech Rhythm & WPM Grade */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Scores</Text>
              <Meter label="Cadence Grade" value={parsed.speechRhythm} />
              <Meter label="WPM Grade" value={parsed.wpmGrade} />
            </View>

            {/* Quick stats */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Stats</Text>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Words counted</Text>
                <Text style={styles.kvValue}>{parsed.wordsCounted ?? '—'}</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Speaking time</Text>
                <Text style={styles.kvValue}>
                  {parsed.speakingTimeSec != null ? `${Math.round(parsed.speakingTimeSec)}s` : '—'}
                </Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Window</Text>
                <Text style={styles.kvValue}>
                  {parsed.windowSec != null ? `${Math.round(parsed.windowSec)}s` : '—'}
                </Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Silence penalty</Text>
                <Text style={styles.kvValue}>
                  {parsed.silencePenalty != null ? Math.round(parsed.silencePenalty) : '—'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </CollapsibleBox>
    </View>
  );
};

export default VocalRhythmPanel;

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

  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: P.radius,
    padding: P.pad,
    gap: 8,
  },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '800' },
  bigValue: { color: C.white, fontSize: 20, fontWeight: '900' },
  hint: { color: C.label, fontSize: 12, marginTop: 2 },

  inlineStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 2,
  },
  kvLabel: { color: C.label, fontSize: 12 },
  kvValue: { color: C.white, fontSize: 16, fontWeight: '800' },

  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  meterLabel: { color: C.label, fontSize: 12, width: 118 },
  meterTrack: {
    flex: 1,
    height: 8,
    backgroundColor: C.track,   // blue-tinted track
    borderRadius: 999,
    overflow: 'hidden',
  },
  meterFill: {
    height: 8,
    backgroundColor: C.accent,  // blue bar fill
    borderRadius: 999,
  },
  meterValue: { color: C.white, fontSize: 12, fontWeight: '700', marginLeft: 6, width: 44, textAlign: 'right' },

  rawText: { color: C.text, fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});
