// components/HeaderBar.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  title: string;
  onPressMenu?: () => void;        // NEW: open left drawer
  onPressNotifications?: () => void;
  onPressStatus?: () => void;
  onPressReview?: () => void;
  inFlightDot?: boolean;
  dark?: boolean;
};

export default function HeaderBar({
  title,
  onPressMenu,                    // NEW
  onPressNotifications,
  onPressStatus,
  onPressReview,
  inFlightDot = false,
  dark = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const base = 390;
  const scale = Math.min(Math.max(width / base, 0.9), 1.15);
  const ICON_SIZE = Math.round(22 * scale);

  const bg = dark ? 'rgba(15, 23, 42, 0.96)' : '#ffffff';
  const border = dark ? 'rgba(148,163,184,0.25)' : '#e5e7eb';
  const titleColor = dark ? '#ffffff' : '#111827';
  const iconColor = dark ? '#ffffff' : '#0f172a';

  return (
    <View style={{ backgroundColor: bg, paddingTop: insets.top, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border }}>
      <View style={styles.row}>
        {/* Left cluster: menu + title */}
        <View style={styles.left}>
          {!!onPressMenu && (
            <Pressable
              accessibilityLabel="Open menu"
              onPress={onPressMenu}
              hitSlop={10}
              style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="menu-outline" size={ICON_SIZE} color={iconColor} />
            </Pressable>
          )}
          <Text numberOfLines={1} style={[styles.title, { color: titleColor }]}>{title}</Text>
        </View>

        {/* Right cluster */}
        <View style={styles.right}>
          {onPressReview && (
            <Pressable
              accessibilityLabel="Review sessions"
              onPress={onPressReview}
              hitSlop={10}
              style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="albums-outline" size={ICON_SIZE} color={iconColor} />
            </Pressable>
          )}

          <Pressable
            accessibilityLabel="Notifications"
            onPress={onPressNotifications}
            hitSlop={10}
            style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="notifications-outline" size={ICON_SIZE} color={iconColor} />
          </Pressable>

          {/* If you bring back a status icon, place it here */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', columnGap: 8, flexShrink: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  right: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
});
