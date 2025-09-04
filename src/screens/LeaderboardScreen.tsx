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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import Screen from '../components/Screen';
import HeaderBar from '../components/HeaderBar';
import { COLORS as C } from '../theme/colors';
import { useAuth } from '../context/MobileAuthContext';

// If your MetricDial path/props differ, tweak here:
import MetricDial from '../components/MetricDial';

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
  const PAGE = 25;
  const [standings, setStandings] = React.useState<StandingItem[]>([]);
  const [standTotal, setStandTotal] = React.useState<number>(0);
  const [standLoading, setStandLoading] = React.useState(false);
  const [standOffset, setStandOffset] = React.useState(0);

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
        const url = `${API_BASE}/mobile/leaderboards/${encodeURIComponent(
          tag
        )}/standings?limit=${PAGE}&offset=${reset ? 0 : standOffset}`;
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
    // Also refresh standings if a tag is selected
    if (selectedTag) await loadStandings(selectedTag, { reset: true });
    setRefreshing(false);
  }, [loadMyBoards, loadFollowed, selectedTag, loadStandings]);

  // Build quick lookup
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
      // initial standings load
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

  // Normalize elo to arc
  const normalizeElo = (elo: number | null | undefined) => {
    if (elo == null) return 0;
    const MIN = 800, MAX = 2400;
    const clamped = Math.max(MIN, Math.min(MAX, elo));
    return Math.round(((clamped - MIN) / (MAX - MIN)) * 100); // 0..100
  };

  const DIAL_SIZE = 84;

  const handleDialPress = async (tag: string) => {
    await Haptics.selectionAsync();
    setSelectedTag((prev) => {
      if (prev === tag) return prev;
      // reset standings for new tag
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

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* BG */}
      <LinearGradient colors={['#0b1220', '#0b1220']} style={StyleSheet.absoluteFill} />

      <HeaderBar
        title="Leaderboards"
        onPressNotifications={() => {}}
        onPressStatus={() => {}}
        dark
      />

      {/* Sticky dial bar */}
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
            dialItems.map(d => {
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.white}
            />
          ),
        }}
      >
        <View style={styles.rootTight}> 
          {/* Selected board: Your stats */}
          {selectedTag ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {selectedName}
                </Text>
                <Text style={styles.tag}>@{selectedTag}</Text>
              </View>

              {selectedMy ? (
                <>
                  <View style={styles.row}>
                    <Text style={styles.kvLabel}>Rating</Text>
                    <Text style={styles.kvValue}>
                      {selectedMy.rating.rating ?? '—'}
                      {fmtDelta(selectedMy.rating.rating_delta_last)}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.kvLabel}>Rank</Text>
                    <Text style={styles.kvValue}>
                      {selectedMy.rating.rank && selectedMy.rating.board_size
                        ? `#${selectedMy.rating.rank} of ${selectedMy.rating.board_size}`
                        : '—'}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.kvLabel}>Sessions</Text>
                    <Text style={styles.kvValue}>{selectedMy.rating.session_count}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.kvLabel}>Avg Score</Text>
                    <Text style={styles.kvValue}>
                      {selectedMy.rating.average_score != null
                        ? Math.round(selectedMy.rating.average_score)
                        : '—'}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>
                    You’re following this board but haven’t recorded on it yet.
                  </Text>
                  <Text style={styles.muted}>
                    Record a session with this leaderboard tag to get placed.
                  </Text>
                </>
              )}
            </View>
          ) : null}

          {/* Standings */}
          {selectedTag ? (
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: 36, textAlign: 'center' }]}>#</Text>
                <Text style={[styles.th, { flex: 1 }]}>User</Text>
                <Text style={[styles.th, { width: 70, textAlign: 'right' }]}>Rating</Text>
                <Text style={[styles.th, { width: 72, textAlign: 'right' }]}>Avg</Text>
                <Text style={[styles.th, { width: 72, textAlign: 'right' }]}>Sessions</Text>
              </View>

              {standLoading && standings.length === 0 ? (
                <Text style={[styles.muted, { padding: 12 }]}>Loading standings…</Text>
              ) : standings.length === 0 ? (
                <Text style={[styles.muted, { padding: 12 }]}>No entries yet.</Text>
              ) : (
                standings.map((row, idx) => {
                  const place = idx + 1 + Math.max(0, standOffset - standings.length);
                  const isYou = sameEmail(row.user_email, youEmail);
                  const name =
                    row.display_name ||
                    (row.user_email ? row.user_email.split('@')[0] : 'Anonymous');

                  return (
                    <View
                      key={`${row.user_email}-${idx}`}
                      style={[
                        styles.tr,
                        isYou && { backgroundColor: 'rgba(14,165,233,0.12)' },
                      ]}
                    >
                      <Text style={[styles.td, styles.rankCell]}>{place}</Text>

                      <View style={styles.participantCell}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {initials(row.display_name, row.user_email)}
                          </Text>
                        </View>
                        <View style={styles.participantTextCol}>
                          <Text style={styles.name} numberOfLines={1}>{name}</Text>
                          {!!row.user_email && (
                            <Text style={styles.subName} numberOfLines={1}>{row.user_email}</Text>
                          )}
                        </View>
                      </View>


                      <Text style={[styles.td, styles.num]}>{Math.round(row.rating)}</Text>
                      <Text style={[styles.td, styles.num]}>
                        {row.average_score != null ? Math.round(row.average_score) : '—'}
                      </Text>
                      <Text style={[styles.td, styles.num]}>{row.session_count}</Text>
                    </View>
                  );
                })
              )}

              {/* Pager */}
              <View style={{ padding: 8 }}>
                {standOffset < standTotal ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.loadMore,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.997 }] },
                    ]}
                    onPress={() => loadStandings(selectedTag, { reset: false })}
                    disabled={standLoading}
                  >
                    <Text style={styles.loadMoreText}>
                      {standLoading ? 'Loading…' : 'Load more'}
                    </Text>
                  </Pressable>
                ) : standings.length > 0 ? (
                  <Text style={[styles.muted, { textAlign: 'center', paddingVertical: 6 }]}>
                    End of standings
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sticky dial bar
  dialsBar: {
    paddingVertical: 8,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  dialsBarShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  dialsContent: {
    paddingHorizontal: 12,   
    alignItems: 'center',
  },

  container: { flex: 1, backgroundColor: C.bg },
  contentTight: {
    paddingHorizontal: 12,  // symmetric gutters like Sessions
    paddingTop: 8,
  },
  rootTight: {
    flex: 1,
    // no paddingTop; keeps it snug under the dials bar
    // bottom padding handled by Screen.footerAware
    gap: 12,
  },

  subtitle: { fontSize: 14, color: C.label },
  muted: { fontSize: 14, color: C.label },

  // Your stats card
  card: {

    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.text, flexShrink: 1, paddingRight: 8 },
  tag: { fontSize: 12, color: C.label },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  kvLabel: { color: C.label, fontSize: 12 },
  kvValue: { color: C.white, fontSize: 14, fontWeight: '700' },

  // Standings table
  tableCard: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  th: { color: C.label, fontSize: 12, fontWeight: '600' },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  td: { color: C.text, fontSize: 14 },
  rankCell: {
    width: 36,
    textAlign: 'center',
    color: C.white,
    fontWeight: '700',
  },
  num: { width: 72, textAlign: 'right', color: C.white, fontWeight: '700' },

  name: { color: C.white, fontSize: 14, fontWeight: '700' },
  subName: { color: C.label, fontSize: 11 },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.white, fontSize: 12, fontWeight: '700' },

  youPill: {
    marginLeft: 8,
    fontSize: 10,
    color: C.activeLabelText,
    backgroundColor: C.activeLabelBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '700',
  },

  loadMore: {
    marginTop: 4,
    alignSelf: 'center',
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadMoreText: { color: C.white, fontSize: 13, fontWeight: '700' },

  participantCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantTextCol: {
    flex: 1,
    marginLeft: 8, // replace gap
  },

  dialWrap: {
    marginRight: 16,
  },
  dialInner: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialCenterOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,     // gives the Text some breathing room
  },
  eloText: {
    color: C.white,
    fontWeight: '800',
    fontSize: 18,             // base; will auto-shrink if needed
    textAlign: 'center',
    includeFontPadding: false,
  },



});
