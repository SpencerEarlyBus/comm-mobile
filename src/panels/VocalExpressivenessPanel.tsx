// src/panels/VocalExpressivenessPanel.tsx
import React, { useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { PanelProps } from './Panel.types';
import CollapsibleBox from '../components/CollapsibleBox';
import { COLORS as C } from '../theme/colors';
import { errorMsg } from '../utils/errorMsg';

// 🔽 new hook + parser (same ones used for VocalRhythm)
import { useSessionVocalFeaturesTxt } from '../hooks/useSessionVocalFeaturesTxt';
import { parseVocalFeaturesTxt } from '../utils/parseVocalFeaturesTxt';

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

const VocalExpressivenessPanel: React.FC<PanelProps> = ({ sessionId }) => {
  // ⬅️ swap to vocal-features hook
  const { text, isLoading, isError, error, refetch } = useSessionVocalFeaturesTxt(sessionId, true);
  const onRetry = useCallback(() => { refetch(); }, [refetch]);

  const parsed = useMemo(() => (text ? parseVocalFeaturesTxt(text) : undefined), [text]);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Description — collapsed by default */}
      <CollapsibleBox title="Vocal expressiveness" initiallyCollapsed>
        <Text style={{ color: C.label }}>
          This metric assesses how engaging your voice is, focusing on pitch variation and energy stability.
          Strong expressiveness uses varied pitch at key moments and maintains a steady, confident volume.
        </Text>
      </CollapsibleBox>

      {/* Results (meters) */}
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
            <Text style={styles.loadingText}>Loading expressiveness…</Text>
          </View>
        ) : isError ? (
          <View>
            <Text style={styles.errText}>Couldn’t load: {errorMsg(error)}</Text>
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !parsed ? (
          <Text style={styles.emptyText}>No vocal-expressiveness data available.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Expressiveness components</Text>
              <Meter label="Pitch Variability" value={parsed.pitchVariability} />
              <Meter label="Energy Consistency" value={parsed.energyConsistency} />
            </View>
          </View>
        )}
      </CollapsibleBox>

    </View>
  );
};

export default VocalExpressivenessPanel;

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

  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  meterLabel: { color: C.label, fontSize: 12, width: 140 },
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

  rawText: { color: C.text, fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});
