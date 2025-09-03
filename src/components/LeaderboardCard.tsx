// src/components/LeaderboardCard.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export type LeaderboardItem = {
  id: string;
  name: string;
  tag: string;
  description?: string | null;
  example_topic?: string | null;
  organization?: string | null;
  visibility: 'public' | 'org' | 'private' | string;
  diffLevel?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  season?: { label?: string; start?: string; end?: string } | null;
  metrics?: Record<string, number> | null;
};

type Props = {
  item: LeaderboardItem;
  onPress?: (item: LeaderboardItem) => void;
  isFollowing?: boolean;
  onToggleFollow?: (item: LeaderboardItem) => void;
};

export default function LeaderboardCard({ item, onPress, isFollowing, onToggleFollow }: Props) {
  const visColor =
    item.visibility === 'public' ? '#10b981' : item.visibility === 'org' ? '#f59e0b' : '#94a3b8';

  return (
    <Pressable onPress={() => onPress?.(item)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.96 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>{item.name}</Text>

        <View style={styles.headerRight}>
          {!!item.diffLevel && (
            <View style={styles.diffPill}>
              <Text style={styles.diffText}>{item.diffLevel}</Text>
            </View>
          )}

          {onToggleFollow && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onToggleFollow(item); }}
              style={({ pressed }) => [
                styles.followBtn,
                isFollowing ? styles.following : styles.follow,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={[styles.followText, isFollowing ? styles.followingText : styles.followText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {!!item.organization && <Text style={styles.org} numberOfLines={1}>{item.organization}</Text>}

      {!!item.description && <Text style={styles.desc} numberOfLines={3}>{item.description}</Text>}

      {!!item.example_topic && (
        <View style={styles.exampleWrap}>
          <Text style={styles.exampleLabel}>Example topic</Text>
          <Text style={styles.exampleText} numberOfLines={2}>{item.example_topic}</Text>
        </View>
      )}

      <View style={styles.footerRow}>
        <View style={[styles.badge, { borderColor: `${visColor}55`, backgroundColor: `${visColor}1A` }]}>
          <Text style={[styles.badgeText, { color: visColor }]}>{item.visibility}</Text>
        </View>
        {!!item.season?.label && (
          <View style={[styles.badge, { borderColor: COLORS.border, backgroundColor: COLORS.track }]}>
            <Text style={[styles.badgeText, { color: COLORS.text }]}>{item.season.label}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '800', color: COLORS.text, fontSize: 16, flexShrink: 1 },
  diffPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: COLORS.white },
  diffText: { color: COLORS.activeLabelText, fontWeight: '800', fontSize: 12 },
  org: { color: COLORS.label, fontSize: 12 },
  desc: { color: COLORS.text, fontSize: 14, lineHeight: 19 },
  exampleWrap: { gap: 4, marginTop: 4 },
  exampleLabel: { color: COLORS.label, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  exampleText: { color: COLORS.text, fontSize: 14, fontStyle: 'italic' },
  footerRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontWeight: '700', fontSize: 12 },

  // Follow button styles
  followBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  follow: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  following: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  followText: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
  followingText: { color: COLORS.activeLabelText },
});
