import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import HeaderBar from '../components/HeaderBar';
import { COLORS } from '../theme/colors';
import LeaderboardCard, { LeaderboardItem } from '../components/LeaderboardCard';
import { useAuth } from '../context/MobileAuthContext';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.backend.root';

type ListResponse = {
  ok: boolean;
  total: number;
  limit: number;
  offset: number;
  items: LeaderboardItem[];
};

type Scope = 'public' | 'accessible' | 'followed';

const DRAWER_WIDTH = 280;
const SCREEN_WIDTH = Dimensions.get('window').width;
const HEADER_H = 56; // keep in sync with your <HeaderBar/> visual height

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function ExploreLeaderboardsScreen({ navigation }: any) {
  const { isAuthenticated, fetchWithAuth } = useAuth() as any;

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [scope, setScope] = useState<Scope>('public');

  // Drawer state
  const drawerX = useSharedValue(-DRAWER_WIDTH);
  const dragStartX = useSharedValue(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    drawerX.value = withTiming(0, { duration: 220 });
  }, [drawerX]);

  const closeDrawer = useCallback(() => {
    drawerX.value = withTiming(-DRAWER_WIDTH, { duration: 200 }, (finished) => {
      if (finished) runOnJS(setDrawerOpen)(false);
    });
  }, [drawerX]);

  // Data
  const canLoadMore = items.length < total;

  const loadFollows = useCallback(async () => {
    if (!isAuthenticated) {
      setFollowed(new Set());
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}/mobile/leaderboards/follows`);
      if (!res.ok) return;
      const data = await res.json();
      const tags: string[] = data?.tags || [];
      setFollowed(new Set(tags));
    } catch {}
  }, [fetchWithAuth, isAuthenticated]);

  const fetchPage = useCallback(
    async (opts?: { reset?: boolean }) => {
      const nextOffset = opts?.reset ? 0 : offset;
      const url = new URL(`${API_BASE}/mobile/leaderboards`);
      url.searchParams.set('scope', scope);
      url.searchParams.set('is_active', 'true');
      url.searchParams.set('sort', 'updated');
      url.searchParams.set('order', 'desc');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(nextOffset));
      if (query.trim()) url.searchParams.set('q', query.trim());

      const run = scope === 'public' ? fetch : fetchWithAuth;

      const res = await run(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ListResponse;

      if (opts?.reset) {
        setItems(data.items || []);
        setOffset((data.items || []).length);
      } else {
        setItems((prev) => [...prev, ...(data.items || [])]);
        setOffset(nextOffset + (data.items?.length || 0));
      }
      setTotal(data.total || 0);
    },
    [query, offset, scope, fetchWithAuth]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchPage({ reset: true }), loadFollows()]);
    } catch {} finally {
      setRefreshing(false);
    }
  }, [fetchPage, loadFollows]);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      await fetchPage({ reset: true });
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadFollows();
  }, [loadFollows]);

  // Gestures (horizontal only, below header)
  const edgeSwipe = Gesture.Pan()
    .activeOffsetX([-14, 14]) // require meaningful horizontal move
    .failOffsetY([-12, 12])   // fail if vertical motion grows
    .onStart((e) => {
      const fromLeftEdge = e.absoluteX < 20;
      const belowHeader = e.absoluteY > HEADER_H;
      if (!drawerOpen && !(fromLeftEdge && belowHeader)) return;
      dragStartX.value = drawerX.value;
    })
    .onUpdate((e) => {
      const nextX = clamp(dragStartX.value + e.translationX, -DRAWER_WIDTH, 0);
      drawerX.value = nextX;
    })
    .onEnd((_e) => {
      const shouldOpen = drawerX.value > -DRAWER_WIDTH * 0.6;
      if (shouldOpen) runOnJS(openDrawer)();
      else runOnJS(closeDrawer)();
    });

  const drawerDrag = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onStart((_e) => {
      dragStartX.value = drawerX.value;
    })
    .onUpdate((e) => {
      const nextX = clamp(dragStartX.value + e.translationX, -DRAWER_WIDTH, 0);
      drawerX.value = nextX;
    })
    .onEnd((_e) => {
      const shouldOpen = drawerX.value > -DRAWER_WIDTH * 0.6;
      if (shouldOpen) runOnJS(openDrawer)();
      else runOnJS(closeDrawer)();
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => {
    const openAmt = 1 - Math.max(0, Math.min(1, Math.abs(drawerX.value) / DRAWER_WIDTH));
    return { opacity: withTiming(openAmt * 0.5, { duration: 120 }) };
  });

  const toggleFollow = useCallback(
    async (it: LeaderboardItem) => {
      if (!isAuthenticated) {
        Alert.alert('Sign in required', 'Please sign in to follow leaderboards.');
        return;
      }
      const tag = it.tag;
      const currentlyFollowing = followed.has(tag);

      setFollowed((prev) => {
        const next = new Set(prev);
        if (currentlyFollowing) next.delete(tag);
        else next.add(tag);
        return next;
      });

      try {
        if (currentlyFollowing) {
          const res = await fetchWithAuth(
            `${API_BASE}/mobile/leaderboards/follows/${encodeURIComponent(tag)}`,
            { method: 'DELETE' }
          );
          if (!res.ok) throw new Error('unfollow failed');
        } else {
          const res = await fetchWithAuth(`${API_BASE}/mobile/leaderboards/follows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag }),
          });
          if (!res.ok) throw new Error('follow failed');
        }
      } catch {
        // revert on error
        setFollowed((prev) => {
          const next = new Set(prev);
          if (currentlyFollowing) next.add(tag);
          else next.delete(tag);
          return next;
        });
      }
    },
    [followed, fetchWithAuth, isAuthenticated]
  );

  const renderItem = useCallback(
    ({ item }: { item: LeaderboardItem }) => (
      <LeaderboardCard
        item={item}
        isFollowing={followed.has(item.tag)}
        onToggleFollow={toggleFollow}
        onPress={() => {
          // navigation.navigate('LeaderboardDetail', { tag: item.tag });
        }}
      />
    ),
    [followed, toggleFollow]
  );

  const keyExtractor = useCallback((it: LeaderboardItem) => it.id, []);

  return (
    <View style={styles.container}>
      <HeaderBar title="Explore" dark onPressNotifications={() => {}} onPressStatus={() => {}} />

      {/* Edge swipe applies only to content below the header */}
      <GestureDetector gesture={edgeSwipe}>
        <View style={styles.screen}>
          {loading && items.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading leaderboards…</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.text} />
              }
              stickyHeaderIndices={[0]}
              contentInsetAdjustmentBehavior="never"
              ListHeaderComponent={
                <View style={styles.stickySearch}>
                  <View style={styles.searchRow}>
                    <Pressable
                      onPress={openDrawer}
                      style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.8 }]}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Open categories menu"
                    >
                      <Text style={styles.menuBtnText}>☰</Text>
                    </Pressable>

                    <TextInput
                      placeholder="Search leaderboards…"
                      placeholderTextColor={COLORS.label}
                      value={query}
                      onChangeText={setQuery}
                      style={styles.search}
                      returnKeyType="search"
                      onSubmitEditing={runSearch}
                    />
                    <Pressable
                      onPress={runSearch}
                      style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.92 }]}
                    >
                      <Text style={styles.searchBtnText}>Search</Text>
                    </Pressable>
                  </View>
                </View>
              }
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No leaderboards yet</Text>
                  <Text style={styles.emptySub}>Try a different search or check back soon.</Text>
                </View>
              }
              ListFooterComponent={
                canLoadMore ? (
                  <Pressable
                    onPress={() => fetchPage()}
                    style={({ pressed }) => [styles.loadMore, pressed && { opacity: 0.96 }]}
                  >
                    <Text style={styles.loadMoreText}>Load more</Text>
                  </Pressable>
                ) : items.length > 0 ? (
                  <Text style={styles.endText}>No more leaderboards to show</Text>
                ) : null
              }
            />
          )}
        </View>
      </GestureDetector>

      {/* OVERLAY, below header only */}
      {drawerOpen && (
        <Pressable
          onPress={closeDrawer}
          style={StyleSheet.absoluteFill}
          pointerEvents="auto"
          accessibilityRole="button"
          accessibilityLabel="Close categories menu"
        >
          <Animated.View style={[styles.overlay, overlayStyle]} />
        </Pressable>
      )}

      {/* DRAWER, below header only */}
      <GestureDetector gesture={drawerDrag}>
        <Animated.View style={[styles.drawer, drawerStyle]}>
          <Text style={styles.drawerTitle}>Active Leaderboards</Text>

          <Pressable style={styles.catItem} onPress={() => { /* TODO */ }}>
            <Text style={styles.catText}>Current Events</Text>
          </Pressable>
          <Pressable style={styles.catItem} onPress={() => { /* TODO */ }}>
            <Text style={styles.catText}>History</Text>
          </Pressable>
          <Pressable style={styles.catItem} onPress={() => { /* TODO */ }}>
            <Text style={styles.catText}>Math</Text>
          </Pressable>
          <Pressable style={styles.catItem} onPress={() => { /* TODO */ }}>
            <Text style={styles.catText}>Sales/Pitching</Text>
          </Pressable>
          <Pressable style={styles.catItem} onPress={() => { /* TODO */ }}>
            <Text style={styles.catText}>Augmented Leaderboards</Text>
          </Pressable>
          <Pressable style={styles.catItem} onPress={() => { /* TODO */ }}>
            <Text style={styles.catText}>Private Leaderboards</Text>
          </Pressable>

          <View style={{ height: 14 }} />
          <Pressable onPress={closeDrawer} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  screen: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },

  stickySearch: {
    backgroundColor: COLORS.bg,
    zIndex: 10,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBtn: {
    marginLeft: 12,
    marginRight: 8,
    height: 40,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  menuBtnText: { color: COLORS.text, fontSize: 18, fontWeight: '800' },

  search: {
    flex: 1,
    marginLeft: 8,
    marginVertical: 8,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchBtn: {
    marginRight: 20,
    marginLeft: 8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  searchBtnText: { color: COLORS.white, fontWeight: '800' },

  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 40, gap: 10 },
  loadingText: { color: COLORS.text },

  emptyBox: { alignItems: 'center', gap: 6, paddingTop: 60 },
  emptyTitle: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  emptySub: { color: COLORS.label },

  loadMore: {
    alignSelf: 'center',
    marginTop: 12,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  loadMoreText: { color: COLORS.text, fontWeight: '700' },
  endText: { color: COLORS.label, textAlign: 'center', marginTop: 14 },

  // Overlay below header
  overlay: {
    position: 'absolute',
    top: HEADER_H,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },

  // Drawer below header
  drawer: {
    position: 'absolute',
    top: HEADER_H,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: COLORS.bg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border,
    paddingTop: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 0 },
    elevation: 6,
  },
  drawerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginVertical: 8 },
  catItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  catText: { color: COLORS.text, fontWeight: '700' },
  closeBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    marginTop: 8,
  },
  closeBtnText: { color: COLORS.white, fontWeight: '800' },
});
