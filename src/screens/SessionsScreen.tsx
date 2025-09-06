// features/sessions/SessionsScreen.tsx
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';
import HeaderBar from '../components/HeaderBar';
import MetricDial from '../components/MetricDial';
import SessionPickerModal from '../components/SessionPickerModal';
import { PANEL_REGISTRY } from '../panels/PanelRegistry';
import type { PanelKey } from '../panels/Panel.types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FOOTER_BAR_HEIGHT } from '../components/FooterNav';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { AppState } from 'react-native';
import { focusManager } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { navGo } from '../navigation/navRef';


import Card from '../components/Card';
import AppCard from '../components/AppCard';
import { C, S } from '../theme/tokens'; // { colors, spacing, radii }

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.api.domain';

type ScoresJson = Record<string, any>;

type MobileSession = {
  id: string;
  topic?: string | null;
  status: string;
  created_at?: string;
  leaderboard_tag?: string | null;
  overall_score?: number | null;
  scores_json?: ScoresJson | null;
};

const METRIC_KEYS: { key: string; label: string }[] = [
  { key: 'reinforced_engagement', label: 'Engaged' },
  { key: 'content_relevance',     label: 'Relevance' },
  { key: 'vocal_rhythm',          label: 'Pace' },
  { key: 'vocal_expressiveness',  label: 'Expressive' },
  { key: 'interpretability',      label: 'Interpretable' },
  { key: 'filler_usage',          label: 'Fillers' },
  { key: 'gesture_score',         label: 'Gesture' },
  { key: 'posture_score',         label: 'Posture' },
  { key: 'motion_score',          label: 'Motion' },
];

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function getMetricValue(session: MobileSession | undefined, key: string): number {
  const sj = session?.scores_json || {};
  let v = sj[key] ?? sj?.metrics?.[key];
  if (v == null && typeof sj === 'object') {
    const lower = key.toLowerCase();
    for (const k of Object.keys(sj)) {
      if (k.toLowerCase() === lower && typeof (sj as any)[k] === 'number') { v = (sj as any)[k]; break; }
    }
    if (!v && (sj as any).metrics && typeof (sj as any).metrics === 'object') {
      for (const k of Object.keys((sj as any).metrics)) {
        if (k.toLowerCase() === lower && typeof (sj as any).metrics[k] === 'number') { v = (sj as any).metrics[k]; break; }
      }
    }
  }
  if (typeof v !== 'number' || !isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

/** --- Cards --- */
/** --- Cards --- */
function SessionSummaryCard({ s }: { s: MobileSession }) {
  const score = Math.max(0, Math.min(100, Number(s.overall_score ?? 0)));
  let tier = 'Rising';
  if (score >= 90) tier = 'Legend';
  else if (score >= 80) tier = 'Elite';
  else if (score >= 70) tier = 'Giga Aura';
  else if (score >= 60) tier = 'Advanced';

  return (
    <AppCard style={{ marginHorizontal: S.md, marginTop: S.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: stacked info */}
        <View style={{ flex: 1, paddingRight: S.md }}>
          <Text style={styles.h2} numberOfLines={2}>
            {s.topic || 'Session'}
          </Text>

          {/* created at */}
          <Text style={[styles.subtle, { marginTop: 4 }]} numberOfLines={1}>
            {formatDate(s.created_at)}
          </Text>

          {/* chips row: leaderboard tag + tier */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <View
              style={{
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: C.accent,
              }}
            >
              <Text style={{ color: C.bg, fontWeight: '700', fontSize: 12 }}>{tier}</Text>
            </View>
          </View>
        </View>

        {/* Right: dial */}
        <MetricDial label="Overall" value={score} size={84} stroke={8} active={false} />
      </View>
    </AppCard>
  );
}

function LeaderboardAdjustmentsCard({ s }: { s: MobileSession }) {
  const score = Math.max(0, Math.min(100, Number(s.overall_score ?? 0)));
  let tier = 'Rising';
  if (score >= 90) tier = 'Legend';
  else if (score >= 80) tier = 'Elite';
  else if (score >= 70) tier = 'Pro';
  else if (score >= 60) tier = 'Advanced';

  return (
    <AppCard style={{ marginHorizontal: S.md, marginTop: S.md }}>
      <Text style={styles.h2}>Leaderboard impact</Text>

      <Text style={[styles.body, { marginTop: S.xs }]}>
        This session’s overall score is <Text style={styles.semibold}>{score}</Text>. You’re tracking in the{' '}
        <Text style={styles.semibold}>{tier}</Text> bracket
        {s.leaderboard_tag ? (
          <> for <Text style={styles.semibold}>{s.leaderboard_tag}</Text>.</>
        ) : '.'}
      </Text>

      <Text style={[styles.subtle, { marginTop: S.xs }]}>
        Keep improving your weakest dial to climb faster. Scores above 80 typically boost placement within 1–2 refresh cycles.
      </Text>

      <View style={{ flexDirection: 'row', columnGap: 10, marginTop: S.sm }}>
        <Pressable
          onPress={() => Alert.alert('Leaders', 'Leaderboard screen coming soon!')}
          style={({ pressed }) => [
            styles.buttonPrimary,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonPrimaryText}>View leaderboard</Text>
        </Pressable>

        {!!s.topic && (
          <Pressable
            onPress={() => Alert.alert('Tip', `Focus on improving "${s.topic}" next time to maximize gains.`)}
            style={({ pressed }) => [
              styles.buttonSecondary,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonSecondaryText}>Personalized tip</Text>
          </Pressable>
        )}
      </View>
    </AppCard>
  );
}

function InsightsCard() {
  return (
    <AppCard style={{ marginHorizontal: S.md, marginTop: S.md }}>
      <Text style={styles.h2}>AI Insights (coming soon)</Text>
      <Text style={[styles.body, { marginTop: 6 }]}>
        This area will summarize your performance and suggest targeted improvements based on recent sessions.
      </Text>
      <Text style={{ marginTop: 10, color: C.accent, fontWeight: '700' }}>
        ↑ Tip: tap a dial above to learn more about that score
      </Text>
    </AppCard>
  );
}



function EmptyState({ bottomPad }: { bottomPad: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.lg }}>
      <Ionicons name="sparkles-outline" size={36} color={C.accent} />
      <Text style={[styles.h2, { marginTop: 8 }]}>No sessions yet</Text>

      <Text style={[styles.body, { textAlign: 'center', marginTop: 6 }]}>
        Tap the record button below to run your first session. Your dials and feedback will appear here.
      </Text>

      <Pressable
        onPress={async () => { await Haptics.selectionAsync(); navGo('Recorder'); }}
        style={({ pressed }) => [
          styles.buttonPrimary,
          { marginTop: 12, paddingHorizontal: 16 },
          pressed && styles.buttonPressed,
        ]}
        hitSlop={6}
      >
        <Text style={styles.buttonPrimaryText}>Go to Recorder</Text>
      </Pressable>

      {/* Arrow that points to the footer’s center button */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: bottomPad - 0,   // just above the footer
          alignSelf: 'center',
          alignItems: 'center',
        }}
      >
        <Ionicons name="arrow-down-circle" size={28} color={C.accent} />
        <Text style={{ color: C.subtext, fontSize: 12, marginTop: 4 }}>Record here</Text>
      </View>
    </View>
  );
}




export default function SessionsScreen() {
  const { fetchWithAuth } = useAuth();
  const isFocused = useIsFocused();
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false); 

  const insets = useSafeAreaInsets();
  const footerExtra = (insets.bottom || 10) + 6;
  const bottomPad = FOOTER_BAR_HEIGHT + footerExtra;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      // pause/reactivate React Query focus when app bg/fg changes
      focusManager.setFocused(state === 'active');
    });
    return () => sub.remove();
  }, []);


  const fetchSessions = useCallback(async (): Promise<MobileSession[]> => {
    const res = await fetchWithAuth(`${API_BASE}/mobile/sessions?limit=50`);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Failed to load sessions: ${res.status} ${txt}`);
    }
    return res.json();
  }, [fetchWithAuth]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['mobile-sessions', 'list'],
    queryFn: fetchSessions,

    // v5: only boolean | "always"
    refetchOnMount: true,
    refetchOnWindowFocus: true,

    // keep results fresh for a while
    staleTime: 30_000,
    gcTime: 600_000,

    // only run when this screen is focused
    enabled: isFocused,

    // v5: function arg is the query object; read from query.state.data
    refetchInterval: (query) => {
      const rows = (query.state.data as MobileSession[] | undefined) ?? [];
      const active = rows.some(
        (s) => s.status === 'queued' || s.status === 'processing'
      );
      return active ? 5000 : false;
    },

    // trim payload to what you render
    select: (rows: MobileSession[]) =>
      rows.map((r) => ({
        id: r.id,
        topic: r.topic,
        status: r.status,
        created_at: r.created_at,
        leaderboard_tag: r.leaderboard_tag,
        overall_score: r.overall_score,
        scores_json: r.scores_json,
      })),
  });

  const sourceSession = useMemo(() => {
    const sessions = data ?? [];
    if (!sessions.length) return undefined;
    if (selectedSessionId) return sessions.find(s => s.id === selectedSessionId) ?? sessions[0];
    const completed = sessions.find(s => s.status === 'completed');
    return completed ?? sessions[0];
  }, [data, selectedSessionId]);
  const hasSessions = (data?.length ?? 0) > 0;


  const anyInFlight = useMemo(
    () => (data ?? []).some(s => s.status === 'queued' || s.status === 'processing'),
    [data]
  );

  const dialMetrics = useMemo(() => {
    return METRIC_KEYS.map(m => ({
      key: m.key,
      label: m.label,
      value: getMetricValue(sourceSession, m.key),
    }));
  }, [sourceSession]);

  const onPressNotifications = () =>
    Alert.alert('Notifications', 'Notifications center coming soon!');
  const onPressStatus = () => {
    const active = (data ?? []).filter(s => s.status === 'queued' || s.status === 'processing');
    Alert.alert(
      'Session Status',
      active.length
        ? `Active: ${active.length} session(s) in flight.\n\n` +
          active.map(a => `• ${a.topic || 'Session'} – ${a.status}`).join('\n')
        : 'No active uploads or processing.'
    );
  };

  const showSummary = selectedMetric == null;
  const SelectedPanel =
    (selectedMetric && PANEL_REGISTRY[selectedMetric as PanelKey]) || null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Subtle gradient BG */}
      <LinearGradient
        colors={['#0b1220', '#0b1220']}
        style={StyleSheet.absoluteFill}
      />

      <HeaderBar
        title="Sessions"
        onPressNotifications={onPressNotifications}
        onPressStatus={onPressStatus}
        onPressReview={() => setPickerOpen(true)}
        inFlightDot={anyInFlight}
        dark
      />

      {/* Sticky, glassy metric dials bar */}
{/* If there are no sessions, show an empty-state landing */}
{!hasSessions && !isFetching ? (
  <EmptyState bottomPad={bottomPad} />
) : (
  <>
    {/* Sticky, glassy metric dials bar */}
    <View
      style={[
        {
          paddingVertical: 8,
          backgroundColor: 'rgba(15,23,42,0.75)',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: C.border,
        },
        scrolled && {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: S.md, columnGap: S.md }}
      >
        {dialMetrics.map((m) => (
          <MetricDial
            key={m.key}
            label={m.label}
            value={m.value}
            active={selectedMetric === m.key}
            onPress={async () => {
              await Haptics.selectionAsync();
              setSelectedMetric((prev) => (prev === m.key ? null : m.key));
            }}
          />
        ))}
      </ScrollView>
    </View>

    {/* Everything below dials can scroll */}
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 2)}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            tintColor={C.accent}
            colors={[C.accent]}
            refreshing={isFetching}
            onRefresh={() => refetch()}
          />
        }
      >
        {showSummary && !!sourceSession && (
          <>
            <SessionSummaryCard s={sourceSession} />
            <LeaderboardAdjustmentsCard s={sourceSession} />
            <InsightsCard />
          </>
        )}

        {!!SelectedPanel && !!sourceSession && <SelectedPanel sessionId={sourceSession.id} />}

        {/* Spacer so the footer nav never covers content */}
        <View style={{ height: FOOTER_BAR_HEIGHT + (insets.bottom || 0) + 12 }} />
      </ScrollView>
    </View>
  </>
)}

      <SessionPickerModal
        visible={pickerOpen}
        items={(data ?? []) as any}
        currentId={sourceSession?.id}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => setSelectedSessionId(id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '700', color: C.text },
  body: { fontSize: 14, color: C.text },
  subtle: { fontSize: 12, color: C.subtext },
  semibold: { fontWeight: '700', color: C.text },

  buttonPrimary: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: C.accent,
  },
  buttonPrimaryText: { color: C.bg, fontWeight: '700' },

  buttonSecondary: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  buttonSecondaryText: { color: '#0f172a', fontWeight: '700' },

  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});
