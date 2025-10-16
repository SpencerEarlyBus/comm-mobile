// src/screens/LeaderboardScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import Screen from '../components/Screen';
import HeaderBar from '../components/HeaderBar';
import MetricsOnlyModal from '../components/MetricsOnlyModal';
import { COLORS as C } from '../theme/colors';
import AppCard from '../components/AppCard';
import { T } from '../theme/typography';
import { S } from '../theme/spacing';
import { useAuth } from '../context/MobileAuthContext';
import MetricDial from '../components/MetricDial';
import { Ionicons } from '@expo/vector-icons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLeftDrawer } from '../features/leftDrawer';
import { makeDrawerStyles } from '../features/drawerStyles';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import LeftDrawerPlaceholder from '../components/LeftDrawerMainAdditionalNav';


const HEADER_ROW_H = 56;
const DRAWER_WIDTH = 280;


type MyRating = {
  rating: number | null;
  season_rating: number | null;
  rating_delta_last: number | null;
  average_score: number | null;
  session_count: number;
  last_updated: string | null;
  rank: number | null;
  board_size: number | null;
  last_session_id: string | null;
};

type MyBoard = {
  leaderboard: {
    id: string;
    name: string;
    tag: string;
    description?: string | null;
    organization?: string | null;
    visibility: string;
    diffLevel: string;
    created_at?: string | null;
    updated_at?: string | null;
    season?: any;
    metrics?: Record<string, number> | null;
  };
  participant: {
    id: string;
    display_name?: string | null;
    user_email?: string | null;
    joined_at?: string | null;
  };
  rating: MyRating;
};

type FollowedBoard = {
  id: string;
  name: string;
  tag: string;
  description?: string | null;
  organization?: string | null;
  visibility: string;
  diffLevel: string;
  season?: any;
  metrics?: Record<string, number> | null;
};

type StandingItem = {
  display_name?: string | null;
  user_email?: string | null;
  rating: number;
  average_score: number | null;
  session_count: number;
  last_updated: string | null;
  metrics_average?: Record<string, number> | null;   // ← we’ll show this in the modal
  last_session_id?: string | null;
};

export default function LeaderboardScreen() {
  const { isAuthenticated, fetchWithAuth } = useAuth();
  const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

  const [refreshing, setRefreshing] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  // My participating boards
  const [myBoards, setMyBoards] = React.useState<MyBoard[]>([]);
  const [loadingMy, setLoadingMy] = React.useState(false);

  // Followed boards
  const [followedBoards, setFollowedBoards] = React.useState<FollowedBoard[]>([]);
  const [loadingFollowed, setLoadingFollowed] = React.useState(false);

  // Selected dial
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);

  // Standings state
  const PAGE = 10;
  const [standings, setStandings] = React.useState<StandingItem[]>([]);
  const [standTotal, setStandTotal] = React.useState<number>(0);
  const [standLoading, setStandLoading] = React.useState(false);
  const [standOffset, setStandOffset] = React.useState(0);

  const COLS = {
    RANK: 36,   // "#"
    ICON: 34,   // avatar (26px fits comfortably)
    NUM: 72,    // rating / avg / sessions
    CHEV: 48,   // trailing chevron
  } as const;


  //hamburger stuff 
  const insets = useSafeAreaInsets();
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


  // Modal state (metrics-only)
  const [detail, setDetail] = React.useState<{
    name: string;
    metrics?: Record<string, number> | null;
  } | null>(null);

  const loadMyBoards = React.useCallback(async () => {
    if (!isAuthenticated) {
      setMyBoards([]);
      return;
    }
    setLoadingMy(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/mobile/leaderboards/my`);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setMyBoards((data?.items || []) as MyBoard[]);
    } catch {
      // ignore
    } finally {
      setLoadingMy(false);
    }
  }, [API_BASE, fetchWithAuth, isAuthenticated]);

  const loadFollowed = React.useCallback(async () => {
    if (!isAuthenticated) {
      setFollowedBoards([]);
      return;
    }
    setLoadingFollowed(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/mobile/leaderboards/follows`);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setFollowedBoards((data?.items || []) as FollowedBoard[]);
    } catch {
      // ignore
    } finally {
      setLoadingFollowed(false);
    }
  }, [API_BASE, fetchWithAuth, isAuthenticated]);

  // Load standings for current selectedTag
  const loadStandings = React.useCallback(
    async (tag: string, opts?: { reset?: boolean }) => {
      if (!tag) return;
      const reset = !!opts?.reset;
      if (reset) {
        setStandings([]);
        setStandOffset(0);
        setStandTotal(0);
      }
      setStandLoading(true);
      try {
        const url =
          `${API_BASE}/mobile/leaderboards/${encodeURIComponent(tag)}/standings` +
          `?limit=${PAGE}&offset=${reset ? 0 : standOffset}&include=metrics`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const items = (data?.items || []) as StandingItem[];
        const total = Number(data?.total || 0);
        setStandings((prev) => (reset ? items : [...prev, ...items]));
        setStandTotal(total);
        setStandOffset((prev) => (reset ? items.length : prev + items.length));
      } catch {
        // ignore
      } finally {
        setStandLoading(false);
      }
    },
    [API_BASE, standOffset]
  );

  // Refresh both on focus
  useFocusEffect(
    React.useCallback(() => {
      loadMyBoards();
      loadFollowed();
    }, [loadMyBoards, loadFollowed])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadMyBoards(), loadFollowed()]);
    if (selectedTag) await loadStandings(selectedTag, { reset: true });
    setRefreshing(false);
  }, [loadMyBoards, loadFollowed, selectedTag, loadStandings]);

  // Quick lookup for my boards
  const myByTag = React.useMemo(
    () => new Map(myBoards.map((b) => [b.leaderboard.tag, b] as const)),
    [myBoards]
  );

  // Dial list = union of followed + participated
  const dialItems = React.useMemo(() => {
    const tags = new Set<string>();
    followedBoards.forEach((b) => tags.add(b.tag));
    myBoards.forEach((b) => tags.add(b.leaderboard.tag));
    const out = Array.from(tags).map((tag) => {
      const mine = myByTag.get(tag) || null;
      const fb = followedBoards.find((b) => b.tag === tag) || null;
      const name = mine?.leaderboard.name || fb?.name || tag;
      const rating = mine?.rating?.rating ?? null;
      const participated = !!mine;
      return { tag, name, rating, participated };
    });
    out.sort((a, b) => {
      if (a.participated !== b.participated) return a.participated ? -1 : 1;
      if (a.participated && b.participated) {
        return (b.rating || 0) - (a.rating || 0);
      }
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [followedBoards, myBoards, myByTag]);

  // Default dial selection + standings fetch
  React.useEffect(() => {
    if (!selectedTag && dialItems.length) {
      const first = dialItems[0].tag;
      setSelectedTag(first);
      loadStandings(first, { reset: true });
    } else if (selectedTag && !dialItems.find((d) => d.tag === selectedTag)) {
      const next = dialItems[0]?.tag ?? null;
      setSelectedTag(next);
      if (next) loadStandings(next, { reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialItems, selectedTag]);

  // Selected board data
  const selectedMy = selectedTag ? myByTag.get(selectedTag) || null : null;
  const selectedFollowed =
    selectedTag ? followedBoards.find((b) => b.tag === selectedTag) || null : null;
  const selectedName =
    selectedMy?.leaderboard.name || selectedFollowed?.name || selectedTag || '';

  // Normalize elo to arc 0..100
  const normalizeElo = (elo: number | null | undefined) => {
    if (elo == null) return 0;
    const MIN = 800, MAX = 2400;
    const clamped = Math.max(MIN, Math.min(MAX, elo));
    return Math.round(((clamped - MIN) / (MAX - MIN)) * 100);
  };

  const DIAL_SIZE = 84;

  const handleDialPress = async (tag: string) => {
    await Haptics.selectionAsync();
    setSelectedTag((prev) => {
      if (prev === tag) return prev;
      loadStandings(tag, { reset: true });
      return tag;
    });
  };

  const onContentScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (!scrolled && y > 2) setScrolled(true);
    if (scrolled && y <= 2) setScrolled(false);
  };

  const fmtDelta = (d: number | null) => {
    if (d == null || d === 0) return '';
    return ` (${d > 0 ? '+' : ''}${Math.round(d)})`;
  };

  const initials = (name?: string | null, email?: string | null) => {
    const base = name?.trim() || email?.split('@')[0] || '?';
    const parts = base.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  };

  const sameEmail = (a?: string | null, b?: string | null) =>
    (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

  const youEmail = selectedMy?.participant.user_email || null;


  const youMetricsAvg = React.useMemo(() => {
    if (!youEmail) return null;
    const row = standings.find((r) =>
      (r.user_email || '').trim().toLowerCase() === (youEmail || '').trim().toLowerCase()
    );
    return row?.metrics_average ?? null;
  }, [standings, youEmail]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* BG */}
      <LinearGradient colors={['#0b1220', '#0b1220']} style={StyleSheet.absoluteFill} />

      <HeaderBar
        title="Leaderboards"
        onPressMenu={openDrawer}     
        onPressNotifications={() => Alert.alert('Notifications', 'Coming soon')}
        onPressStatus={() => {}}
        dark
      />

      {/* Sticky dial bar */}
      <GestureDetector gesture={edgeSwipe}>
      <View style={{ flex: 1 }}>
      <View style={[styles.dialsBar, scrolled && styles.dialsBarShadow]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dialsContent}
        >
          {dialItems.length === 0 ? (
            <Text style={styles.muted}>
              Follow boards or record with a leaderboard tag to get started.
            </Text>
          ) : (
            dialItems.map((d) => {
              const eloText = d.rating != null ? String(Math.round(d.rating)) : '—';
              return (
                <View key={d.tag} style={{ marginRight: 16 }}>
                  <MetricDial
                    label={d.name}
                    size={DIAL_SIZE}
                    value={normalizeElo(d.rating)}
                    active={selectedTag === d.tag}
                    onPress={() => handleDialPress(d.tag)}
                    showValue={false}
                    center={
                      <Text
                        style={{
                          color: '#fff',
                          fontWeight: '800',
                          fontSize: Math.max(14, Math.round(DIAL_SIZE * 0.22)),
                          textAlign: 'center',
                        }}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        {eloText}
                      </Text>
                    }
                  />
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Content */}
      <Screen
        scroll
        footerAware
        includeTopInset={false}
        contentStyle={styles.contentTight}
        ScrollComponent={ScrollView}
        scrollProps={{
          onScroll: onContentScroll,
          scrollEventThrottle: 16,
          refreshControl: (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.white} />
          ),
        }}
      >
        <View style={styles.rootTight}>
          {/* Selected board: Your stats */}
          {selectedTag ? (
            selectedMy ? (
              <AppCard style={{ marginHorizontal: S.md, marginTop: S.md }}>
                <Pressable
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setDetail({ name: `${selectedName} — You`, metrics: youMetricsAvg ?? null });
                  }}
                  hitSlop={6}
                  style={({ pressed }) => [pressed && { opacity: 0.96 }]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text style={T.h2} numberOfLines={1}>{selectedName}</Text>
                    <Text style={[T.subtle, { marginLeft: S.sm }]}>@{selectedTag}</Text>
                  </View>

                  <View style={{ marginTop: S.sm, rowGap: 6 }}>
                    <View style={styles.row}>
                      <Text style={T.subtle}>Rating</Text>
                      <Text style={T.semibold}>
                        {selectedMy.rating.rating ?? '—'}
                        {fmtDelta(selectedMy.rating.rating_delta_last)}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={T.subtle}>Rank</Text>
                      <Text style={T.semibold}>
                        {selectedMy.rating.rank && selectedMy.rating.board_size
                          ? `#${selectedMy.rating.rank} of ${selectedMy.rating.board_size}`
                          : '—'}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={T.subtle}>Sessions</Text>
                      <Text style={T.semibold}>{selectedMy.rating.session_count}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={T.subtle}>Avg Score</Text>
                      <Text style={T.semibold}>
                        {selectedMy.rating.average_score != null ? Math.round(selectedMy.rating.average_score) : '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ctaRow}>
                    <View style={styles.ctaPill}>
                      <Ionicons name="stats-chart" size={14} color={C.bg} />
                      <Text style={styles.ctaPillText}>View Metrics</Text>
                    </View>
                  </View>

                </Pressable>
              </AppCard>
            ) : (
              <AppCard style={{ marginHorizontal: S.md, marginTop: S.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={T.h2} numberOfLines={1}>{selectedName}</Text>
                  <Text style={[T.subtle, { marginLeft: S.sm }]}>@{selectedTag}</Text>
                </View>
                <Text style={[T.body, { marginTop: S.xs }]}>
                  You’re following this board but haven’t recorded on it yet.
                </Text>
                <Text style={[T.subtle, { marginTop: S.xs }]}>
                  Record a session with this leaderboard tag to get placed.
                </Text>
              </AppCard>
            )
          ) : null}


          {/* Standings */}
          {selectedTag ? (
            <AppCard padded={false} style={{ marginHorizontal: S.md, marginTop: S.md }}>
              {/* Header with fixed columns */}
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: COLS.RANK, textAlign: 'center' }]}>#</Text>

                {/* icon header (centered) */}
                <View style={{ width: COLS.ICON, alignItems: 'center' }}>
                  <Ionicons name="person-circle-outline" size={16} color={C.label} />
                </View>

                <Text style={[styles.th, { width: COLS.NUM, textAlign: 'right' }]}>Rating</Text>
                <Text style={[styles.th, { width: COLS.NUM, textAlign: 'right' }]}>Avg</Text>
                <Text style={[styles.th, { width: COLS.NUM, textAlign: 'right' }]}>Sessions</Text>

                {/* spacer to align with chevron column */}
                <View style={{ width: COLS.CHEV }} />
              </View>

              {standLoading && standings.length === 0 ? (
                <Text style={[T.subtle, { padding: S.md }]}>Loading standings…</Text>
              ) : standings.length === 0 ? (
                <Text style={[T.subtle, { padding: S.md }]}>No entries yet.</Text>
              ) : (
                standings.map((row, idx) => {
                  const place = idx + 1 + Math.max(0, standOffset - standings.length);
                  const isYou = sameEmail(row.user_email, youEmail);
                  const name = row.display_name || (row.user_email ? row.user_email.split('@')[0] : 'Anonymous');

                  return (
                    <Pressable
                      key={`${row.user_email}-${idx}`}
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        setDetail({ name, metrics: row.metrics_average ?? null });
                      }}
                      android_ripple={{ color: 'rgba(14,165,233,0.12)', borderless: false }}
                      accessibilityRole="button"
                      accessibilityLabel={`Row ${place}, rating ${Math.round(row.rating)}, average ${row.average_score ?? '—'}, sessions ${row.session_count}`}
                      style={({ pressed }) => [
                        styles.tr,
                        isYou && styles.trYou,
                        pressed && styles.trPressed,
                      ]}
                      hitSlop={6}
                    >
                      {/* Rank */}
                      <Text style={[styles.td, { width: COLS.RANK, textAlign: 'center', color: C.label }]}>
                        {place}
                      </Text>

                      {/* Avatar (centered) */}
                      <View style={{ width: COLS.ICON, alignItems: 'center' }}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {initials(row.display_name, row.user_email)}
                          </Text>
                        </View>
                      </View>

                      {/* Numbers */}
                      <Text style={[styles.td, { width: COLS.NUM, textAlign: 'right' }]}>
                        {Math.round(row.rating)}
                      </Text>
                      <Text style={[styles.td, { width: COLS.NUM, textAlign: 'right' }]}>
                        {row.average_score != null ? Math.round(row.average_score) : '—'}
                      </Text>
                      <Text style={[styles.td, { width: COLS.NUM, textAlign: 'right' }]}>
                        {row.session_count}
                      </Text>

                      {/* Trailing chevron */}
                      <View style={{ width: COLS.CHEV, alignItems: 'flex-end' }}>
                        <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                      </View>
                    </Pressable>
                  );
                })
              )}

              <View style={{ padding: S.sm }}>
                {standOffset < standTotal ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.loadMore,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.997 }] },
                    ]}
                    onPress={() => loadStandings(selectedTag, { reset: false })}
                    disabled={standLoading}
                  >
                    <Text style={styles.loadMoreText}>{standLoading ? 'Loading…' : 'Load more'}</Text>
                  </Pressable>
                ) : standings.length > 0 ? (
                  <Text style={[T.subtle, { textAlign: 'center', paddingVertical: 6 }]}>
                    End of standings
                  </Text>
                ) : null}
              </View>
            </AppCard>
          ) : null}

        </View>
      </Screen>
      </View>
      </GestureDetector>

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

    {/* */}
    <MetricsOnlyModal
      visible={!!detail}
      onClose={() => setDetail(null)}
      name={detail?.name ?? ''}
      metrics={detail?.metrics ?? {}}
    />
    </View>
  );
}

/** ---------- Metrics-only modal (local to this screen) ---------- */


function MetricBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={{ marginTop: 10 }}>
      <View style={mstyles.meterHeader}>
        <Text style={mstyles.meterLabel}>{label}</Text>
        <Text style={mstyles.meterValue}>{v}/100</Text>
      </View>
      <View style={mstyles.meterTrack}>
        <View style={[mstyles.meterFill, { width: `${v}%` }]} />
      </View>
    </View>
  );
}

/** ------------------------ Styles ------------------------ */
const styles = StyleSheet.create({
  // Top dials bar stays as-is
  dialsBar: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.headerGlass,
  },
  dialsBarShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  dialsContent: { paddingRight: 8, alignItems: 'center' },

  muted: { color: C.label },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },

  trYou: { backgroundColor: 'rgba(14,165,233,0.10)' }, // highlight your row
  trPressed: { backgroundColor: 'rgba(14,165,233,0.08)' },


  // Screen padding uses spacing tokens
  contentTight: { paddingTop: S.sm, paddingHorizontal: S.md, paddingBottom: 90 },
  rootTight: { gap: S.sm },

  // NOTE: no `card` or `tableCard` here — AppCard handles the container look

  // Standings table inside AppCard
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.md,
    paddingTop: S.md,
    paddingBottom: S.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  th: { color: C.label, fontSize: 12, fontWeight: '700' },

  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  td: { color: C.text, fontSize: 14 },
  rankCell: { width: 36, textAlign: 'center', color: C.label },

  participantCell: { flex: 1, flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  avatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(148,163,184,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: C.text, fontWeight: '800', fontSize: 12 },
  participantTextCol: { flex: 1 },
  name: { color: C.text, fontWeight: '700', fontSize: 14 },
  subName: { color: C.subtext, fontSize: 12, marginTop: 2 },

  num: { width: 72, textAlign: 'right', color: C.text },

  loadMore: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  loadMoreText: { color: C.bg, fontWeight: '700' },

  ctaRow: {
    marginTop: S.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  // Blue pill (matches buttonPrimary colors but smaller + rounded)
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ctaPillText: { color: C.bg, fontWeight: '800', fontSize: 12 },

  // Light variant for the “not participating” card
  ctaPillAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ctaPillAltText: { color: '#0f172a', fontWeight: '800', fontSize: 12 },

});



const mstyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.md,
  },
  // Same card look as AppCard
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: S.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.xs,
  },
  title: T.h2,                 // typography token
  close: { color: C.label, fontSize: 20, paddingHorizontal: 6, paddingVertical: 2 },
  muted: T.subtle,             // typography token

  meterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  meterLabel: { ...T.body, fontWeight: '700' },  // readable label
  meterValue: { color: C.text, fontSize: 12, fontWeight: '700' },
  meterTrack: { height: 8, backgroundColor: C.track, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: 8, backgroundColor: C.accent, borderRadius: 999 },






  
});









