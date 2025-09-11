// components/SessionPickerModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSessionsSearch, SessionRow } from '../hooks/useSessionsSearch';
import { C, S } from '../theme/tokens';

type Item = SessionRow & { created_at?: string };

function fmt(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

type Props = {
  visible: boolean;
  items?: Item[];                    // optional for client-side mode
  currentId?: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  serverDriven?: boolean;            // default true → use server search
};

const STATUS = ['completed', 'processing', 'queued', 'failed'] as const;

export default function SessionPickerModal({
  visible,
  items = [],
  currentId,
  onClose,
  onSelect,
  serverDriven = true,
}: Props) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');

  // debounce q for server
  const [qDebounced, setQDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // SERVER mode
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useSessionsSearch({ q: qDebounced, status, order, limit: 50 }, serverDriven && visible);

  const rowsServer: Item[] = useMemo(() => {
    const pages = data?.pages ?? [];
    return pages.flatMap((p) => p.items || []);
  }, [data]);

  // CLIENT mode
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
    if (status) out = out.filter(it => it.status === status);
    out.sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return order === 'newest' ? db - da : da - db;
    });
    return out;
  }, [items, q, status, order]);

  const dataRows = serverDriven ? rowsServer : rowsClient;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      {/* backdrop */}
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />

      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: C.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
        paddingBottom: 8, maxHeight: '78%',
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8
      }}>
        {/* header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.md, paddingBottom: S.sm }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, flex: 1 }}>Pick a session</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
        </View>

        {/* sticky controls */}
        <View style={{
          paddingHorizontal: S.md, paddingBottom: S.sm,
          borderBottomWidth: 1, borderColor: C.border,
          backgroundColor: 'rgba(15,23,42,0.92)'
        }}>
          {/* search row */}
          <View style={{ flexDirection: 'row', columnGap: 8, alignItems: 'center' }}>
            <Ionicons name="search" size={18} color={C.subtext} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search by topic, tag, status…"
              placeholderTextColor={C.subtext}
              style={{
                flex: 1, color: C.text, backgroundColor: '#0b1220',
                borderWidth: 1, borderColor: C.border, borderRadius: 10,
                paddingVertical: 8, paddingHorizontal: 10
              }}
              returnKeyType="search"
            />
            <Pressable
              onPress={() => setOrder(o => o === 'newest' ? 'oldest' : 'newest')}
              style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
                borderWidth: 1, borderColor: C.border, backgroundColor: '#0b1220' },
                pressed && { opacity: 0.9 }]}
            >
              <Text style={{ color: C.text, fontWeight: '700' }}>
                {order === 'newest' ? 'Newest' : 'Oldest'}
              </Text>
            </Pressable>
          </View>

          {/* status chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <FilterChip label="All" active={!status} onPress={() => setStatus(undefined)} />
            {STATUS.map(s => (
              <FilterChip key={s} label={s} active={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
        </View>

        {/* list */}
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
            onEndReached={() => { if (serverDriven && hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
            ListFooterComponent={
              serverDriven && (isFetchingNextPage || isRefetching) ? (
                <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                  <ActivityIndicator />
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const active = currentId === item.id;
              return (
                <Pressable
                  onPress={() => { onSelect(item.id); onClose(); }}
                  style={({ pressed }) => [
                    {
                      borderWidth: 1,
                      borderColor: active ? C.accent : C.border,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: active ? '#0b2533' : '#0b1220',
                    },
                    pressed && { opacity: 0.9 }
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: '700', color: C.text }} numberOfLines={1}>
                      {item.topic || 'Session'}
                    </Text>
                    <Text style={{ textTransform: 'capitalize', color: C.subtext }}>{item.status}</Text>
                  </View>
                  <View style={{ marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: C.subtext }}>{fmt(item.created_at)}</Text>
                    {!!item.leaderboard_tag && (
                      <View style={{
                        paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999,
                        backgroundColor: '#0f172a', borderWidth: 1, borderColor: C.border,
                      }}>
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
      </View>
    </Modal>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
          borderWidth: 1, borderColor: active ? C.accent : C.border,
          backgroundColor: active ? '#0b2533' : '#0b1220',
        },
        pressed && { opacity: 0.9 }
      ]}
      hitSlop={6}
    >
      <Text style={{ color: active ? C.accent : C.text, fontWeight: '700', fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}
