// src/panels/FillerUsagePanel.tsx
import React, { useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { PanelProps } from './Panel.types';
import { useSessionTextA } from '../hooks/useSessionTextA';                  // transcript
import { useSessionFillersTxt } from '../hooks/useSessionFillersTxt';        // fillers stats
import { errorMsg } from '../utils/errorMsg';
import CollapsibleBox from '../components/CollapsibleBox';
import { HighlightedTranscript, dedupeTrailingSentences } from '../utils/highlightFillers';
import { COLORS as C } from '../theme/colors';

const P = { pad: 12, radius: 12 };

// --- helpers for adjusted counts (post-dedupe) ---
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function countWords(s: string): number {
  // count word-like tokens (handles "I'm" etc.)
  return (s.match(/[A-Za-z0-9']+/g) || []).length;
}

function buildTermsRegex(terms: string[] | undefined) {
  if (!terms?.length) return null;
  const pattern = terms
    .map(t => escapeRx(t).replace(/\s+/g, '\\s+')) // allow flexible whitespace inside phrases
    .filter(Boolean)
    .join('|');
  if (!pattern) return null;
  // case-insensitive, non-overlapping global matches; "word-ish" boundaries
  return new RegExp(`(?:(?<=^)|(?<=[^A-Za-z]))(${pattern})(?:(?=$)|(?=[^A-Za-z]))`, 'gi');
}

function countFillersIn(text: string, terms: string[] | undefined): number {
  const rx = buildTermsRegex(terms);
  if (!rx) return 0;
  let count = 0;
  while (rx.exec(text)) count++;
  return count;
}

function Meter({ label, value, right }: { label: string; value: number; right?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={{ marginTop: 8 }}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterRight}>{right ?? `${v}%`}</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${v}%` }]} />
      </View>
    </View>
  );
}

export default function FillerUsagePanel({ sessionId }: PanelProps) {
  // Transcript
  const { text: transcript, isLoading: tLoading, isError: tErr, error: tError, refetch: refetchT } =
    useSessionTextA(sessionId, true);

  // Fillers stats (provides `terms` and categories)
  const { stats, isLoading: fLoading, isError: fErr, error: fError, refetch: refetchF } =
    useSessionFillersTxt(sessionId, true);

  const onRetry = useCallback(() => { refetchT(); refetchF(); }, [refetchT, refetchF]);

  // 1) Clean transcript by removing trailing repeated sentences/phrases
  const cleanedTranscript = useMemo(
    () => (transcript ? dedupeTrailingSentences(transcript) : ''),
    [transcript]
  );

  // 2) Recompute counts from cleaned transcript
  const adjusted = useMemo(() => {
    const totalWords = cleanedTranscript ? countWords(cleanedTranscript) : 0;
    const fillerWords = cleanedTranscript ? countFillersIn(cleanedTranscript, stats?.terms || []) : 0;

    // density as simple ratio (we can't reproduce server "weighted" exactly on client)
    const densityPct = totalWords > 0 ? Math.round((fillerWords / totalWords) * 100) : undefined;

    return { totalWords, fillerWords, densityPct };
  }, [cleanedTranscript, stats?.terms]);

  // Keep a fallback to server density if for some reason adjusted can't be computed
  const densityPct = adjusted.densityPct != null
    ? adjusted.densityPct
    : (stats?.density != null
        ? Math.round((stats.density <= 1 ? stats.density : stats.density / 100) * 100)
        : undefined);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Description */}
      <CollapsibleBox title="Filler Usage" initiallyCollapsed>
        <Text style={{ color: C.label }}>
          This metric tracks verbal fillers (e.g., “um”, “uh”, “like”) and estimates your filler density.
          Lower density generally improves clarity and confidence.
        </Text>
      </CollapsibleBox>

      {/* Stats */}
      <CollapsibleBox
        title="Filler density & categories"
        initiallyCollapsed={false}
        backgroundColor={C.card}
        headerTint={C.text}
        borderColor={C.border}
      >
        {(fLoading) ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading filler stats…</Text>
          </View>
        ) : fErr ? (
          <View>
            <Text style={styles.errText}>Couldn’t load: {errorMsg(fError)}</Text>
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !stats ? (
          <Text style={styles.emptyText}>No filler analysis available.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={styles.card}>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Total words (after de-dupe)</Text>
                <Text style={styles.kvValue}>{adjusted.totalWords}</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Filler words (after de-dupe)</Text>
                <Text style={styles.kvValue}>{adjusted.fillerWords}</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Filler density (adjusted)</Text>
                <Text style={styles.kvValue}>
                  {densityPct != null ? `${densityPct}%` : '—'}
                </Text>
              </View>

              {typeof stats.overallScore === 'number' && (
                <View style={[styles.inlineStat, { marginTop: 6 }]}>
                  <Text style={styles.kvLabel}>Overall score</Text>
                  <Text style={styles.kvValue}>{Math.round(stats.overallScore)}</Text>
                </View>
              )}
            </View>

            {/* Category tallies (server-calculated; still useful context) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>By category</Text>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Critical (“um”, “uh”)</Text>
                <Text style={styles.kvValue}>{stats.byCategory?.critical ?? 0}</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Hesitation (“like”, “you know”)</Text>
                <Text style={styles.kvValue}>{stats.byCategory?.hesitation ?? 0}</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Confidence lacking (“sort of”)</Text>
                <Text style={styles.kvValue}>{stats.byCategory?.confidence ?? 0}</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={styles.kvLabel}>Self-correction (“I guess”)</Text>
                <Text style={styles.kvValue}>{stats.byCategory?.self_correction ?? 0}</Text>
              </View>

              {densityPct != null && (
                <>
                  <View style={{ height: 8 }} />
                  {/* Lower density is better → invert for the bar */}
                  <Meter label="Filler density" value={100 - densityPct} right={`${densityPct}%`} />
                  <Text style={styles.tip}>
                    Aim for a lower density. Practice pausing instead of using fillers.
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
      </CollapsibleBox>

      {/* Transcript with highlighted fillers */}
      <CollapsibleBox
        title="Transcript (highlighted fillers)"
        initiallyCollapsed={false}
        backgroundColor={C.card}
        headerTint={C.text}
        borderColor={C.border}
      >
        {tLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading transcript…</Text>
          </View>
        ) : tErr ? (
          <View>
            <Text style={styles.errText}>Couldn’t load transcript: {errorMsg(tError)}</Text>
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : transcript ? (
          <ScrollView
            nestedScrollEnabled
            contentContainerStyle={{ padding: 14 }}
            showsVerticalScrollIndicator={false}
          >
            <HighlightedTranscript text={cleanedTranscript} terms={stats?.terms || []} />
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>No transcript available.</Text>
        )}
      </CollapsibleBox>
    </View>
  );
}

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
    marginTop: 2,
  },
  kvLabel: { color: C.label, fontSize: 12 },
  kvValue: { color: C.white, fontSize: 16, fontWeight: '800' },

  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: P.radius,
    padding: P.pad,
    gap: 6,
  },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '800', marginBottom: 2 },
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
  meterFill: { height: 8, backgroundColor: C.accent, borderRadius: 999 },
  tip: { color: C.label, fontSize: 12, marginTop: 8 },
});
