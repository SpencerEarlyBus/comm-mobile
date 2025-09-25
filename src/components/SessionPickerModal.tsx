// src/components/SessionPickerModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, View, Text, FlatList, Pressable, TextInput, ActivityIndicator,
  Animated, Easing, useWindowDimensions, PanResponder, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FOOTER_BAR_HEIGHT } from '../components/FooterNav';
import { Ionicons } from '@expo/vector-icons';
import { useSessionsSearch, SessionRow } from '../hooks/useSessionsSearch';
import { C, S } from '../theme/tokens';

type Item = SessionRow & {
  created_at?: string;
  // if your ingest API already returns progress, this will be picked up
  // progress?: { percent: number; stage: string };
};

// ---- helpers ----
function fmt(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

/**
 * Bucket raw backend statuses into UI categories.
 * Maps "created" and "analyzing" (and other ingest in-flight states) → "processing".
 * Removes "queued" as a top-level category by folding similar states into "processing".
 */
// ADD this at top (same as what we used in SessionsScreen)
function bucketStatus(raw?: string): 'completed' | 'processing' | 'failed' {
  const s = (raw || '').toLowerCase();
  if (['finalized','completed','done','success','ready'].includes(s)) return 'completed';
  if (['failed','error'].includes(s)) return 'failed';
  return 'processing';
}


type Props = {
  visible: boolean;
  items?: Item[];                    // optional for client-side mode
  currentId?: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  serverDriven?: boolean;            // default true → use server search
  drawerWidthPct?: number;           // optional, default 0.9 (90% of screen)
  enableSwipeToClose?: boolean;      // optional, default true
};

// 🚫 Removed "queued" from chips
const STATUS = ['completed', 'processing', 'failed'] as const;

export default function SessionPickerModal({
  visible,
  items = [],
  currentId,
  onClose,
  onSelect,
  serverDriven = true,
  drawerWidthPct = 0.9,
  enableSwipeToClose = true,
}: Props) {


  useEffect(() => {
    if (visible) {
      setStatus(undefined); // All
      setQ('');
    }
  }, [visible]);



  // --- search / filters ---
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined); // one of STATUS or undefined
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
  const [qDebounced, setQDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Respect header/footer
  const insets = useSafeAreaInsets();
  const TOP_OFFSET = insets.top || 0;
  const BOTTOM_OFFSET = (insets.bottom || 0) + FOOTER_BAR_HEIGHT + 6;

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isRefetching
  } = useSessionsSearch({ q: qDebounced, status, order, limit: 50 }, serverDriven && visible);

  // Normalize rows (server mode)
  const rowsServer: Item[] = useMemo(
    () => (data?.pages ?? []).flatMap((p) => (p.items || []) as Item[]),
    [data]
  );

  // Normalize rows (client mode)
  const rowsClient: Item[] = useMemo(() => {
    let out = items.slice();

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter((it) =>
        (it.topic || '').toLowerCase().includes(needle) ||
        (it.leaderboard_tag || '').toLowerCase().includes(needle) ||
        (it.status || '').toLowerCase().includes(needle)
      );
    }

    // ✅ bucketed category filter
    if (status) out = out.filter(it => bucketStatus(it.status) === status);

    out.sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return order === 'newest' ? db - da : da - db;
    });
    return out;
  }, [items, q, status, order]);

  // For server rows, also apply bucket filter client-side to satisfy the new semantics
  const dataRows: Item[] = useMemo(() => {
    const base = serverDriven ? rowsServer : rowsClient;
    if (!status) return base;
    return base.filter((it) => bucketStatus(it.status) === status);
  }, [serverDriven, rowsServer, rowsClient, status]);

  // --- right drawer animation ---
  const { width } = useWindowDimensions();
  const SHEET_W = Math.min(420, Math.round(width * drawerWidthPct));
  const anim = useRef(new Animated.Value(0)).current;      // 0=hidden, 1=shown
  const [mounted, setMounted] = useState(visible);         // keep Modal open during close animation

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [SHEET_W, 0] });
  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });

  // --- swipe to close (drag toward right edge to close) ---
  const panX = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        enableSwipeToClose && Math.abs(g.dx) > 8 && Math.abs(g.dy) < 12,
      onPanResponderMove: (_, g) => {
        const dx = Math.max(0, g.dx); // only allow rightward drag
        panX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        const shouldClose = g.vx > 0.8 || g.dx > SHEET_W * 0.33;
        if (shouldClose) {
          Animated.timing(panX, {
            toValue: SHEET_W,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }).start(() => {
            panX.setValue(0);
            onClose();
          });
        } else {
          Animated.timing(panX, {
            toValue: 0,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.timing(panX, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }).start();
      },
    })
  ).current;

  const sheetTransform = [{ translateX: Animated.add(translateX, panX) }];

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop (respects header/footer) */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: TOP_OFFSET,
          bottom: BOTTOM_OFFSET,
          backgroundColor: C.black,
          opacity: backdropOpacity,
        }}
      />
      {/* Tap-through area to close (matches visible backdrop area) */}
      <Pressable
        onPress={onClose}
        style={{
          position: 'absolute',
          left: 0,
          right: SHEET_W,
          top: TOP_OFFSET,
          bottom: BOTTOM_OFFSET,
        }}
      />

      {/* Right drawer */}
      <Animated.View
        {...(enableSwipeToClose ? pan.panHandlers : {})}
        style={{
          position: 'absolute',
          right: 0,
          top: TOP_OFFSET,
          bottom: BOTTOM_OFFSET,
          width: SHEET_W,
          backgroundColor: C.bg,
          borderLeftWidth: 1,
          borderLeftColor: C.border,
          paddingBottom: S.sm,
          transform: sheetTransform,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 16,
              shadowOffset: { width: -4, height: 0 },
            },
            android: { elevation: 12 },
          }),
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.md, paddingBottom: S.sm }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, flex: 1 }}>Pick a session</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
        </View>

        {/* Sticky controls */}
        <View
          style={{
            paddingHorizontal: S.md,
            paddingBottom: S.sm,
            borderBottomWidth: 1,
            borderColor: C.border,
            backgroundColor: C.headerGlass,
          }}
        >
          {/* Search row */}
          <View style={{ flexDirection: 'row', columnGap: 8, alignItems: 'center' }}>
            <Ionicons name="search" size={18} color={C.subtext} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search by topic, tag, status…"
              placeholderTextColor={C.subtext}
              style={{
                flex: 1,
                color: C.text,
                backgroundColor: C.panelBg,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
              }}
              returnKeyType="search"
            />
            <Pressable
              onPress={() => setOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
              style={({ pressed }) => [
                {
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: C.border,
                  backgroundColor: C.panelBg,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={{ color: C.text, fontWeight: '700' }}>
                {order === 'newest' ? 'Newest' : 'Oldest'}
              </Text>
            </Pressable>
          </View>

          {/* Status chips (no "queued") */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <FilterChip label="All" active={!status} onPress={() => setStatus(undefined)} />
            {STATUS.map((s) => (
              <FilterChip key={s} label={s} active={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
        </View>

        {/* List */}
        {isLoading && serverDriven ? (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text style={{ color: C.subtext, marginTop: 6 }}>Loading…</Text>
          </View>
        ) : (
          <FlatList
            data={dataRows}
            keyExtractor={(s) => s.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ padding: S.md, paddingBottom: 12 }}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (serverDriven && hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            ListFooterComponent={
              serverDriven && isFetchingNextPage
                ? (
                  <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                    <ActivityIndicator />
                  </View>
                )
                : null
            }
            renderItem={({ item }) => {
              const active = currentId === item.id;
              const uiStatus = bucketStatus(item.status);
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    {
                      borderWidth: 1,
                      borderColor: active ? C.accent : C.border,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: active ? 'rgba(14,165,233,0.12)' : C.panelBg,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: '700', color: C.text }} numberOfLines={1}>
                      {item.topic || 'Session'}
                    </Text>
                    <Text style={{ textTransform: 'capitalize', color: C.subtext }}>
                      {uiStatus}
                    </Text>
                  </View>

                  <View style={{ marginTop: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: C.subtext }}>{fmt(item.created_at)}</Text>

                    {/* optional pill for leaderboard tag */}
                    {!!item.leaderboard_tag && (
                      <View
                        style={{
                          paddingVertical: 2,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: C.panelBg,
                          borderWidth: 1,
                          borderColor: C.border,
                        }}
                      >
                        <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>
                          {item.leaderboard_tag}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 16 }}>
                <Text style={{ color: C.subtext }}>No sessions found.</Text>
              </View>
            }
          />
        )}
      </Animated.View>
    </Modal>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? C.accent : C.border,
          backgroundColor: active ? 'rgba(14,165,233,0.12)' : C.panelBg,
        },
        pressed && { opacity: 0.9 },
      ]}
      hitSlop={6}
    >
      <Text style={{ color: active ? C.accent : C.text, fontWeight: '700', fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}
