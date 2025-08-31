import React from 'react';
import { Modal, View, Text, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Item = {
  id: string;
  topic?: string | null;
  created_at?: string;
  status: string;
  leaderboard_tag?: string | null;
};

function fmt(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function SessionPickerModal({
  visible,
  items,
  currentId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  items: Item[];
  currentId?: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />

      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: 16, maxHeight: '70%',
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', flex: 1 }}>Pick a session</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#0f172a" />
          </Pressable>
        </View>

        <FlatList
          data={items}
          keyExtractor={(s) => s.id}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const active = currentId === item.id;
            return (
              <Pressable
                onPress={() => { onSelect(item.id); onClose(); }}
                style={{
                  borderWidth: 1, borderColor: active ? '#0ea5e9' : '#e5e7eb',
                  borderRadius: 12, padding: 12, backgroundColor: active ? '#f0f9ff' : 'white'
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700' }} numberOfLines={1}>
                    {item.topic || 'Session'}
                  </Text>
                  <Text style={{ textTransform: 'capitalize', color: '#334155' }}>{item.status}</Text>
                </View>
                <View style={{ marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#64748b' }}>{fmt(item.created_at)}</Text>
                  <Text style={{ color: '#64748b' }}>{item.leaderboard_tag || ''}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
