// src/screens/SessionsScreen.tsx
import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/api';

export default function SessionsScreen() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await api.get('/sessions')).data, // your backend route
  });

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={data ?? []}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 12, borderBottomWidth: 0.5 }}>
            <Text style={{ fontWeight: '600' }}>{item.topic ?? 'Session'}</Text>
            <Text>{item.overall_score ?? '-'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>No sessions yet.</Text>}
      />
    </View>
  );
}
