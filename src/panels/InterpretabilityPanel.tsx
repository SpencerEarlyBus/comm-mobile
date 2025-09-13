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


function BarRow({
  label,
  percent,
  rightText,
  subRight,
  help,
}: {
  label: string;
  percent?: number | null;     // 0..100
  rightText?: string;          // e.g. "93.9/100"
  subRight?: string;           // e.g. "grade 8.49"
  help?: string;
}) {
  const p = Math.max(0, Math.min(100, Number.isFinite(percent as number) ? (percent as number) : 0));
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterLabel}>{label}</Text>
        <View style={{ alignItems: 'flex-end' }}>
          {!!rightText && <Text style={styles.meterRight}>{rightText}</Text>}
          {!!subRight && <Text style={styles.meterHelp}>{subRight}</Text>}
        </View>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${p}%` }]} />
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
      <CollapsibleBox title="Interpretability"               
                    initiallyCollapsed
                    backgroundColor={C.card}
                    borderColor={C.border}
                    headerTint={C.text}
                  >
        <Text style={{ color: C.label }}>
          We estimate the reading grade level needed to understand your transcript using standard
          readability indices. Aim for an <Text style={{ fontWeight: '800', color: C.text }}>8–9</Text> grade level
          for broad accessibility.

    Flesch-Kincaid Grade Level: Estimated school grade level needed to understand your transcript. 
    SMOG Index: Grade estimate that takes into account syllables per word within the transcript. 
    Automated Readability Index (ARI): Grade estimate that takes into account characters per word within the transcript. 
    Coleman-Liau Index: Grade estimate that takes into account letters per 100 words and the average number of sentences within the same 100 words. 


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


          {/* Readability bands */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Readability (band scores)</Text>

            <BarRow
              label="Flesch–Kincaid"
              percent={parsed.fkBand}
              rightText={parsed.fkBand != null ? `${parsed.fkBand.toFixed(1)}/100` : '—'}
              subRight={parsed.fk != null ? `grade ${parsed.fk.toFixed(2)}` : undefined}
            />
            <BarRow
              label="SMOG Index"
              percent={parsed.smogBand}
              rightText={parsed.smogBand != null ? `${parsed.smogBand.toFixed(1)}/100` : '—'}
              subRight={parsed.smog != null ? `grade ${parsed.smog.toFixed(2)}` : undefined}
            />
            <BarRow
              label="Automated Readability (ARI)"
              percent={parsed.ariBand}
              rightText={parsed.ariBand != null ? `${parsed.ariBand.toFixed(1)}/100` : '—'}
              subRight={parsed.ari != null ? `grade ${parsed.ari.toFixed(2)}` : undefined}
            />
            <BarRow
              label="Coleman–Liau Index"
              percent={parsed.cliBand}
              rightText={parsed.cliBand != null ? `${parsed.cliBand.toFixed(1)}/100` : '—'}
              subRight={parsed.cli != null ? `grade ${parsed.cli.toFixed(2)}` : undefined}
            />

            {!!parsed.readabilityScore && (
              <Text style={styles.tip}>
                Aggregate readability score: <Text style={{ fontWeight: '800', color: C.text }}>
                  {parsed.readabilityScore.toFixed(2)}/100
                </Text>
              </Text>
            )}
          </View>

          {/* Language control */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Language control</Text>

            <BarRow
              label="Repetition control"
              percent={parsed.repetitionBand}
              rightText={parsed.repetitionBand != null ? `${parsed.repetitionBand.toFixed(1)}/100` : '—'}
              help="Trigram duplicate penalty (higher is better)."
            />

            <BarRow
              label="Structure signals"
              percent={parsed.structureBand}
              rightText={parsed.structureBand != null ? `${parsed.structureBand.toFixed(1)}/100` : '—'}
              help="Opening, signposts, and closing cues."
            />


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
