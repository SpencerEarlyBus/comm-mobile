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
} from 'react-native';
import HeaderBar from '../components/HeaderBar';
import { COLORS } from '../theme/colors';
import LeaderboardCard, { LeaderboardItem } from '../components/LeaderboardCard';
import { useAuth } from '../context/MobileAuthContext';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.backend.root';

type ListResponse = {
  ok: boolean;
  total: number;
  limit: number;
  offset: number;
  items: LeaderboardItem[];
};

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

  const canLoadMore = items.length < total;

  // ---- Load user's followed leaderboards
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
    } catch {
      // ignore; keep current state
    }
  }, [fetchWithAuth, isAuthenticated]);

  // ---- Fetch leaderboard page
  const fetchPage = useCallback(
    async (opts?: { reset?: boolean }) => {
      const nextOffset = opts?.reset ? 0 : offset;
      const url = new URL(`${API_BASE}/mobile/leaderboards`);
      url.searchParams.set('visibility', 'public');
      url.searchParams.set('is_active', 'true');
      url.searchParams.set('sort', 'updated'); // surface recent/active
      url.searchParams.set('order', 'desc');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(nextOffset));
      if (query.trim()) url.searchParams.set('q', query.trim());

      const res = await fetch(url.toString());
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
    [query, offset]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchPage({ reset: true }), loadFollows()]);
    } catch {
      // consider toast
    } finally {
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

  // initial load & when auth state changes
  useEffect(() => {
    runSearch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadFollows();
  }, [loadFollows]);

  // ---- Follow / Unfollow (optimistic)
  const toggleFollow = useCallback(
    async (it: LeaderboardItem) => {
      if (!isAuthenticated) {
        Alert.alert('Sign in required', 'Please sign in to follow leaderboards.');
        return;
      }
      const tag = it.tag;
      const currentlyFollowing = followed.has(tag);

      // optimistic flip
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

      {/* Plain View to avoid extra top padding; sticky header will sit flush under HeaderBar */}
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.text} />}

            // keep search locked under header
            stickyHeaderIndices={[0]}
            contentInsetAdjustmentBehavior="never"
            ListHeaderComponent={
              <View style={styles.stickySearch}>
                {/* full-bleed row (no horizontal padding) */}
                <View style={styles.searchRow}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  screen: { flex: 1 }, // list sits directly under HeaderBar
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 20, // list items have 20px inset
    paddingBottom: 40, // small; device insets handled elsewhere
    gap: 12,
  },

  // Full-bleed sticky bar directly under HeaderBar (no extra top padding)
  stickySearch: {
    backgroundColor: COLORS.bg,
    zIndex: 10,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // optional separation
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // no padding here → truly edge-to-edge
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // controls get their own margins so header stays full-bleed
  search: {
    flex: 1,
    marginLeft: 20, // visual inset
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
    marginRight: 20, // visual inset
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
});
