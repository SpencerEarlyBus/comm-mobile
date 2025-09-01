import React, { useCallback } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import type { PanelProps } from './Panel.types';
import { useSessionTextB } from '../hooks/useSessionTextB';
import { errorMsg } from '../utils/errorMsg';

const ContentRelevancePanel: React.FC<PanelProps> = ({ sessionId }) => {
  const { text, isLoading, isError, error, refetch } = useSessionTextB(sessionId, true);

  const onRetry = useCallback(() => { refetch(); }, [refetch]);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Info box */}
      <View
        style={{
          borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
          backgroundColor: '#fff', padding: 14, marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
          Content relevance
        </Text>
        <Text style={{ marginTop: 6, color: '#475569' }}>
          This metric assesses how relevant the presentation was with respect to the topic provided. 
          It considers your directness, use of examples, focus, coverage, and accuracy.   
        </Text>
      </View>

      {/* Text output box */}
      <View
        style={{
          borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
          backgroundColor: '#0b1220',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <View style={{ padding: 18, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: '#cbd5e1' }}>Loading relevance notes…</Text>
          </View>
        ) : isError ? (
          <View style={{ padding: 14 }}>
            <Text style={{ color: '#ef4444', marginBottom: 8 }}>
              Couldn’t load notes: {errorMsg(error)}
            </Text>
            <Pressable
              onPress={onRetry}
              style={{
                alignSelf: 'flex-start',
                paddingVertical: 6, paddingHorizontal: 12,
                borderRadius: 8, backgroundColor: '#0ea5e9',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        ) : text ? (
          <ScrollView
            nestedScrollEnabled
            contentContainerStyle={{ padding: 14 }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                color: '#e2e8f0',
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 18,
              }}
              selectable
            >
              {text}
            </Text>
          </ScrollView>
        ) : (
          <View style={{ padding: 14 }}>
            <Text style={{ color: '#64748b' }}>No content-relevance notes available.</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default ContentRelevancePanel;
