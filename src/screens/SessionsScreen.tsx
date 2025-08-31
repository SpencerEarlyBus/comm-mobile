import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';
import HeaderBar from '../components/HeaderBar';
import MetricDial from '../components/MetricDial';
import SessionPickerModal from '../components/SessionPickerModal';
import { PANEL_REGISTRY } from '../panels/PanelRegistry';
import type { PanelKey } from '../panels/Panel.types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FOOTER_BAR_HEIGHT } from '../components/FooterNav';




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
  { key: 'gesture_score',         label: 'Gesture' },   // target dial
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
function SessionSummaryCard({ s }: { s: MobileSession }) {
  return (
    <View
      style={{
        marginHorizontal: 16, marginTop: 6,
        borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
        backgroundColor: '#ffffff', padding: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>
          {s.topic || 'Session'}
        </Text>
        <Text style={{ color: '#64748b', marginTop: 4 }} numberOfLines={1}>
          {formatDate(s.created_at)}{s.leaderboard_tag ? ` • ${s.leaderboard_tag}` : ''}
        </Text>
      </View>

      <MetricDial
        label="Overall"
        value={Math.max(0, Math.min(100, Number(s.overall_score ?? 0)))}
        size={84}
        stroke={8}
        active={false}
      />
    </View>
  );
}

function InsightsCard() {
  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      <View
        style={{
          borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
          backgroundColor: '#f8fafc', padding: 14,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
          AI Insights (coming soon)
        </Text>
        <Text style={{ marginTop: 6, color: '#475569' }}>
          This area will summarize your performance and suggest targeted improvements based on recent sessions.
        </Text>
        <Text style={{ marginTop: 10, color: '#0ea5e9', fontWeight: '700' }}>
          ↑ Tip: tap a dial above to learn more about that score
        </Text>
      </View>
    </View>
  );
}





export default function SessionsScreen() {
  const { fetchWithAuth } = useAuth();
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const footerExtra = (insets.bottom || 10) + 6;
  const bottomPad = FOOTER_BAR_HEIGHT + footerExtra;
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
    refetchInterval: 20000,
  });

  const sourceSession = useMemo(() => {
    const sessions = data ?? [];
    if (!sessions.length) return undefined;
    if (selectedSessionId) return sessions.find(s => s.id === selectedSessionId) ?? sessions[0];
    const completed = sessions.find(s => s.status === 'completed');
    return completed ?? sessions[0];
  }, [data, selectedSessionId]);

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

  //const gestureSelected = selectedMetric === 'gesture_score';
  const showSummary = selectedMetric == null;
  const SelectedPanel =
  (selectedMetric && PANEL_REGISTRY[selectedMetric as PanelKey]) || null;

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <HeaderBar
        title="Sessions"
        onPressNotifications={onPressNotifications}
        onPressStatus={onPressStatus}
        onPressReview={() => setPickerOpen(true)}
        inFlightDot={anyInFlight}
        dark
      />

      {/* Dials stay fixed */}
      <View style={{ paddingVertical: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, columnGap: 12 }}
        >
          {dialMetrics.map(m => (
            <MetricDial
              key={m.key}
              label={m.label}
              value={m.value}
              active={selectedMetric === m.key}
              onPress={() => setSelectedMetric(prev => (prev === m.key ? null : m.key))}
            />
          ))}
        </ScrollView>
      </View>

      {/* Everything below dials can scroll */}
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {showSummary && !!sourceSession && (
            <>
              <SessionSummaryCard s={sourceSession} />
              <InsightsCard />
            </>
          )}

          {!!SelectedPanel && !!sourceSession && (
            <SelectedPanel sessionId={sourceSession.id} />
          )}
          <View style={{ height: bottomPad }} />
        </ScrollView>
      </View>

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