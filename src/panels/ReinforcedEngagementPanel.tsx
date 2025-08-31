import React, { useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import type { PanelProps } from './Panel.types';
import { useSessionJsonA } from '../hooks/useSessionJsonA';
import { errorMsg } from '../utils/errorMsg';
import CollapsibleBox from '../components/CollapsibleBox';

const ReinforcedEngagementPanel: React.FC<PanelProps> = ({ sessionId }) => {
  const { data, isLoading, isError, error, refetch } = useSessionJsonA(sessionId, true);
  const onRetry = useCallback(() => { refetch(); }, [refetch]);

  const pretty = useMemo(() => (data ? JSON.stringify(data, null, 2) : ''), [data]);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Description — collapsed by default */}
      <CollapsibleBox title="Reinforced Engagement" initiallyCollapsed>
        <Text style={{ color: '#475569' }}>
          We analyze attention signals (pace, emphasis, pauses) and content alignment to estimate
          moments where engagement is reinforced. Tap below to view the JSON breakdown.
        </Text>
      </CollapsibleBox>

      {/* JSON box — EXPANDED by default (user can collapse) */}
      <CollapsibleBox
        title="Engagement JSON"
        initiallyCollapsed={false}                // 👈 expanded by default
        borderColor="#e5e7eb"
        backgroundColor="#0b1220"
        headerTint="#e2e8f0"
      >
        {isLoading ? (
          <View style={{ paddingVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: '#cbd5e1' }}>Loading engagement JSON…</Text>
          </View>
        ) : isError ? (
          <View>
            <Text style={{ color: '#ef4444', marginBottom: 8 }}>
              Couldn’t load JSON: {errorMsg(error)}
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
        ) : pretty ? (
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ paddingVertical: 2 }}
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
              {pretty}
            </Text>
          </ScrollView>
        ) : (
          <Text style={{ color: '#94a3b8' }}>No reinforced-engagement data available.</Text>
        )}
      </CollapsibleBox>
    </View>
  );
};

export default ReinforcedEngagementPanel;
