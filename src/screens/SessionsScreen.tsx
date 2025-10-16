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
  Modal,
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
import RatingReportModal from '../components/RatingReportModal';
import { useLeftDrawer } from '../features/leftDrawer';
import { makeDrawerStyles } from '../features/drawerStyles';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import LeftDrawerPlaceholder from '../components/LeftDrawerMainAdditionalNav';
import { useWindowDimensions } from 'react-native';


import Card from '../components/Card';
import AppCard from '../components/AppCard';
import { C, S } from '../theme/tokens'; // { colors, spacing, radii }

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.api.domain';


const HEADER_H = 56;
const DRAWER_WIDTH = 280;


type ScoresJson = Record<string, any>;

type MobileSession = {
  id: string;
  topic?: string | null;
  status: string;
  created_at?: string;
  leaderboard_tag?: string | null;
  overall_score?: number | null;
  scores_json?: ScoresJson | null;
  notes?: string | null;                  
  leaderboard_info?: any | null;  
};


type IngestItem = {
  id: string;
  status: string;
  client_session_id: string;
  mobile_session_id?: string | null;
  created_at?: string | null;
};
const bucketStatus = (raw?: string): 'completed' | 'processing' | 'failed' => {
  const s = (raw || '').toLowerCase();
  if (['finalized','completed','done','success','ready'].includes(s)) return 'completed';
  if (['failed','error'].includes(s)) return 'failed';
  return 'processing';
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

function LeaderboardAdjustmentsCard({ s, onPressReport }: { s: MobileSession; onPressReport: () => void }) {
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
          onPress={() => navGo('Leaderboard')}
          style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonPrimaryText}>View leaderboard</Text>
        </Pressable>

        {!!s.topic && (
          <Pressable
            onPress={onPressReport}
            style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonSecondaryText}>Rating Report</Text>
          </Pressable>
        )}
      </View>
    </AppCard>
  );
}

// SessionsScreen.tsx (or move to its own file if you prefer)
function InsightsCard({ notes }: { notes?: string | null }) {
  const parsedLines = React.useMemo(() => {
    if (!notes) return null;

    // Try JSON first
    try {
      const j = JSON.parse(notes);
      if (Array.isArray(j)) {
        const arr = j.map(String).map(s => s.trim()).filter(Boolean);
        return arr.length ? arr.slice(0, 5) : null;
      }
      if (j && typeof j === 'object') {
        const maybe = [
          j.motivational || j.motivation,
          j.strength || j.positive || j.good,
          j.suggestion || j.improvement || j.tip,
        ].filter(Boolean).map(String);
        return maybe.length ? maybe.slice(0, 5) : null;
      }
    } catch {
      // not JSON; fall through to plain text
    }

    // Plain text: split on lines
    const lines = String(notes)
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
    return lines.length ? lines.slice(0, 5) : null;
  }, [notes]);

  const hasInsights = !!parsedLines && parsedLines.length > 0;

  return (
    <AppCard style={{ marginHorizontal: S.md, marginTop: S.md }}>
      <Text style={styles.h2}>Session Insights</Text>

      {hasInsights ? (
        <View style={{ marginTop: S.xs }}>
          {parsedLines!.map((line, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: idx ? 6 : 8 }}>
              <Text style={[styles.body, { marginRight: 8 }]}>•</Text>
              <Text style={[styles.body, { flex: 1 }]}>{line}</Text>
            </View>
          ))}
          <Text style={{ marginTop: 10, color: C.accent, fontWeight: '700' }}>
            ↑ Tip: tap a dial above to learn more about each score
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.body, { marginTop: 6 }]}>
            No AI insights for this session yet. Run a new session or try again in a bit.
          </Text>
          <Text style={{ marginTop: 10, color: C.accent, fontWeight: '700' }}>
            ↑ Tip: tap a dial above to learn more about each score
          </Text>
        </>
      )}
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


  const [reportOpen, setReportOpen] = useState(false);
  const [reportInfo, setReportInfo] = useState<any | undefined>(undefined);

  const openReportFor = useCallback((s?: MobileSession) => {
    const info = s?.leaderboard_info ?? null; // can be object or JSON string
    if (!info) {
      Alert.alert('Rating Report', 'No rating update is available yet for this session.');
      return;
    }
    setReportInfo(info);
    setReportOpen(true);
  }, []);
  const HEADER_ROW_H = 56;
  const headerHeight = (insets.top || 0) + HEADER_ROW_H;

  const {
    drawerOpen, openDrawer, closeDrawer,
    edgeSwipe, drawerDrag, drawerStyle, overlayStyle
  } = useLeftDrawer({ headerHeight, drawerWidth: DRAWER_WIDTH });

  const drawerStyles = makeDrawerStyles({
    headerHeight,
    drawerWidth: DRAWER_WIDTH,
    bgColor: C.bg,
    borderColor: C.border,
  });

  const { width, height } = useWindowDimensions();
  // mirror the same footer calc we used in the modal
  const FOOTER_PAD_BOTTOM = (insets.bottom || 10) + 6;
  const FOOTER_PAD_TOP = 8;
  const footerTotal = FOOTER_BAR_HEIGHT + FOOTER_PAD_TOP + FOOTER_PAD_BOTTOM;
  const openPickerEdgeSwipe = Gesture.Pan()
    .minDistance(18)
    .failOffsetY([-12, 12])
    .hitSlop({ left: -8 })
    .onEnd((e) => {
      'worklet';
      // leftward drag from right edge
      if (e.translationX < -24) {
        runOnJS(setPickerOpen)(true);
      }
    });



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
    const j = await res.json();

    // tolerate both old (array) and new ({items}) shapes
    const items = Array.isArray(j) ? j : j?.items;
    return Array.isArray(items) ? items : [];
  }, [fetchWithAuth]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['mobile-sessions', 'list'],
    queryFn: fetchSessions,

    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    gcTime: 600_000,
    enabled: isFocused,

    // v5: query arg is the query object; read from query.state.data
    refetchInterval: (query) => {
      const rowsMaybe = query.state.data as unknown;
      const rows = Array.isArray(rowsMaybe) ? rowsMaybe as MobileSession[] : [];
      const active = rows.some((s) => s.status === 'queued' || s.status === 'processing');
      return active ? 5000 : false;
    },

    // trim payload to what you render
    select: (rowsMaybe: unknown) => {
      const rows = Array.isArray(rowsMaybe) ? (rowsMaybe as MobileSession[]) : [];
      return rows.map((r) => ({
        id: r.id,
        topic: r.topic,
        status: r.status,
        created_at: r.created_at,
        leaderboard_tag: r.leaderboard_tag,
        overall_score: r.overall_score,
        scores_json: r.scores_json,
        notes: r.notes ?? null,                
        leaderboard_info: r.leaderboard_info ?? null, 
      }));
    },
  });

  const sourceSession = useMemo(() => {
    const sessions = data ?? [];
    if (!sessions.length) return undefined;
    if (selectedSessionId) return sessions.find(s => s.id === selectedSessionId) ?? sessions[0];
    const completed = sessions.find(s => s.status === 'completed');
    return completed ?? sessions[0];
  }, [data, selectedSessionId]);
  const hasSessions = (Array.isArray(data) ? data.length : 0) > 0;


  const anyInFlight = useMemo(
    () => (Array.isArray(data) ? data : []).some(s => s.status === 'queued' || s.status === 'processing'),
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




  // ---- fetch ingests (only when picker is open) ----
  const fetchIngests = React.useCallback(async (): Promise<IngestItem[]> => {
    const res = await fetchWithAuth(`${API_BASE}/mobile/ingests?order=newest&limit=100`);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Failed to load ingests: ${res.status} ${txt}`);
    }
    const j = await res.json();
    const items = j?.items;
    return Array.isArray(items) ? items : [];
  }, [fetchWithAuth]);

  const {
    data: ingests = [],
    isFetching: isFetchingIngests,
    refetch: refetchIngests,
  } = useQuery({
    queryKey: ['mobile-ingests', 'list'],
    queryFn: fetchIngests,
    enabled: isFocused && pickerOpen,   // ✅ only when picker is open & screen focused
    // no refetchInterval here
    staleTime: 5_000,                   // small cache so closing/reopening still refreshes
    gcTime: 300_000,
  });

  // When the picker opens, force a fresh pull once
  useEffect(() => {
    if (pickerOpen) {
      refetchIngests();
    }
  }, [pickerOpen, refetchIngests]);




  // ---- NEW: normalize for the picker (merge sessions + ingests) ----
  type PickerRow = {
    id: string;                  // what the picker needs for selection (+ our "ingest:" prefix when unlinked)
    topic?: string | null;
    status: string;              // raw; picker buckets it to "processing"/etc
    created_at?: string | null;
    leaderboard_tag?: string | null;
    _kind: 'session' | 'ingest';
    _selectable: boolean;        // disable press for ingests without a mobile_session_id
  };

  const pickerItems: PickerRow[] = React.useMemo(() => {
    const sessions = (data ?? []) as MobileSession[];

    const sessionRows: PickerRow[] = sessions.map(s => ({
      id: s.id,
      topic: s.topic,
      status: s.status,
      created_at: s.created_at ?? null,
      leaderboard_tag: s.leaderboard_tag ?? null,
      _kind: 'session',
      _selectable: true,
    }));

    const ingestRows: PickerRow[] = ingests.map(i => {
      const selectable = !!i.mobile_session_id; // only navigable when a session exists
      return {
        id: selectable ? (i.mobile_session_id as string) : `ingest:${i.client_session_id}`,
        topic: 'Upload / Analysis', // optional: you can enrich this if you store a topic in metadata
        status: i.status,           // picker will bucket this to "processing" for created/analyzing/etc
        created_at: i.created_at ?? null,
        leaderboard_tag: null,
        _kind: 'ingest',
        _selectable: selectable,
      };
    });

    // Merge & de-dupe (prefer the session entry if both exist)
    const byId = new Map<string, PickerRow>();
    for (const r of [...ingestRows, ...sessionRows]) {
      if (!byId.has(r.id) || byId.get(r.id)!._kind === 'ingest') {
        byId.set(r.id, r);
      }
    }

    // sort newest first (modal can also re-sort, but this makes the initial list nice)
    return Array.from(byId.values()).sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return db - da;
    });
  }, [data, ingests]);



  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* BG */}
      <LinearGradient colors={['#0b1220', '#0b1220']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <HeaderBar
        title="Sessions"
        onPressMenu={openDrawer}
        onPressNotifications={onPressNotifications}
        onPressStatus={onPressStatus}
        onPressReview={() => setPickerOpen(true)}
        inFlightDot={anyInFlight}
        dark
      />

      {/* CONTENT wrapped with edge-swipe — put ALL your content here */}
      <GestureDetector gesture={Gesture.Simultaneous(edgeSwipe)}>
        <View style={{ flex: 1 }}>
          {!hasSessions && !isFetching ? (
            <EmptyState bottomPad={bottomPad} />
          ) : (
            <>
              {/* Sticky dials bar */}
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


              {/* Right-edge swipe catcher (between header and footer) */}
              <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                <View
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: headerHeight,                  // below header
                    bottom: FOOTER_BAR_HEIGHT,          // above footer (min height)
                    width: 24,                          // edge width
                  }}
                  pointerEvents="auto"
                >
                  <GestureDetector gesture={openPickerEdgeSwipe}>
                    <View style={{ flex: 1 }} />
                  </GestureDetector>
                </View>
              </View>


              
              {/* Scrollable body */}
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
                      <LeaderboardAdjustmentsCard
                        s={sourceSession}
                        onPressReport={() => openReportFor(sourceSession)}
                      />
                      <InsightsCard notes={sourceSession.notes} />
                    </>
                  )}

                  {!!SelectedPanel && !!sourceSession && (
                    <SelectedPanel sessionId={sourceSession.id} />
                  )}

                  <View style={{ height: FOOTER_BAR_HEIGHT + (insets.bottom || 0) + 12 }} />
                </ScrollView>
              </View>
            </>
          )}
        </View>
      </GestureDetector>

      {/* Overlay + Drawer LAST so they sit on top */}
      {drawerOpen && (
        <Pressable onPress={closeDrawer} style={StyleSheet.absoluteFill} pointerEvents="auto">
          <Animated.View style={[drawerStyles.overlay, overlayStyle]} />
        </Pressable>
      )}

      <GestureDetector gesture={drawerDrag}>
        <Animated.View style={[drawerStyles.drawer, drawerStyle]}>
          <LeftDrawerPlaceholder onClose={closeDrawer} />
        </Animated.View>
      </GestureDetector>

      {/* Modals */}


      
    <SessionPickerModal
      visible={pickerOpen}
      serverDriven={false}
      items={pickerItems as any}
      currentId={sourceSession?.id}
      onClose={() => setPickerOpen(false)}
      onSelect={(id) => {
        if (id.startsWith('ingest:')) {
          Alert.alert('Processing', 'This upload is still processing. Try again shortly.');
          return;
        }
        setSelectedSessionId(id);
      }}

      // NEW: make right-drawer match left-drawer sizing
      headerHeight={headerHeight}         // = (insets.top || 0) + HEADER_ROW_H
      drawerWidthPx={DRAWER_WIDTH+50}        // = 280
    />

      <RatingReportModal
        visible={reportOpen}
        info={reportInfo}
        onClose={() => setReportOpen(false)}
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
