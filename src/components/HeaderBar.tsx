import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  title: string;
  onPressNotifications?: () => void;
  onPressStatus?: () => void;
  onPressReview?: () => void;     // NEW: open session picker
  inFlightDot?: boolean;
  dark?: boolean;
};

export default function HeaderBar({
  title,
  onPressNotifications,
  onPressStatus,
  onPressReview,                 // NEW
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
        <Text numberOfLines={1} style={[styles.title, { color: titleColor }]}>{title}</Text>

        <View style={styles.right}>
          {/* Review / picker */}
          <Pressable
            accessibilityLabel="Review sessions"
            onPress={onPressReview}
            hitSlop={10}
            style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="albums-outline" size={ICON_SIZE} color={iconColor} />
          </Pressable>

          {/* Notifications */}
          <Pressable
            accessibilityLabel="Notifications"
            onPress={onPressNotifications}
            hitSlop={10}
            style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="notifications-outline" size={ICON_SIZE} color={iconColor} />
          </Pressable>

          {/* Status */}
          <Pressable
            accessibilityLabel="Session status"
            onPress={onPressStatus}
            hitSlop={10}
            style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={{ position: 'relative' }}>
              <Ionicons name="cloud-upload-outline" size={ICON_SIZE} color={iconColor} />
              {inFlightDot && (
                <View style={styles.dotWrap}>
                  <View style={[styles.dot, { borderColor: bg }]} />
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700' },
  right: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  dotWrap: { position: 'absolute', right: -2, top: -2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', borderWidth: 2 },
});
