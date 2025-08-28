// src/screens/ProfileScreen.tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/MobileAuthContext';
import Screen from '../components/Screen';

function formatDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Avatar({ name, email }: { name?: string; email?: string }) {
  const label = (name || email || 'U').trim();
  const initials = label
    .replace(/@.*/, '')
    .split(/[.\s_]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('') || 'U';
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{children}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth() as any;
  const insets = useSafeAreaInsets();

  // Access extended fields from backend payload
  const {
    email,
    username,
    role,
    created_at,
    email_verified,
    leaderboard_permissions,
    leaderboard_preference,
    report_preference,
    phrase_sentence,
    unique_fillers,
    unique_gesture_csv_path,
  } = (user || {}) as {
    email?: string;
    username?: string;
    role?: string;
    created_at?: string;
    email_verified?: boolean;
    leaderboard_permissions?: string[];
    leaderboard_preference?: string;
    report_preference?: string;
    phrase_sentence?: string;
    unique_fillers?: string[];
    unique_gesture_csv_path?: string;
  };

  const verifiedColor = email_verified ? '#16a34a' : '#ef4444';
  const verifiedIcon = email_verified ? 'checkmark-circle' : 'close-circle';
  const verifiedLabel = email_verified ? 'Verified' : 'Unverified';

  const onLogout = async () => {
    try {
      await logout();
      Alert.alert('Signed out');
    } catch {}
  };

  const fillers = useMemo(() => (unique_fillers ?? []).slice(0, 20), [unique_fillers]);

  return (
    <Screen scroll footerAware contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: 160 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Avatar name={username} email={email} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{username || email || 'Profile'}</Text>
          <Text style={styles.subtle}>{email || '—'}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: `${verifiedColor}22`, borderColor: `${verifiedColor}66` }]}>
              <Ionicons name={verifiedIcon as any} size={16} color={verifiedColor} />
              <Text style={[styles.badgeText, { color: verifiedColor }]}>{verifiedLabel}</Text>
            </View>
            {!!role && (
              <View style={[styles.badge, { backgroundColor: 'rgba(2,132,199,0.12)', borderColor: 'rgba(2,132,199,0.35)' }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#0284c7" />
                <Text style={[styles.badgeText, { color: '#0284c7' }]}>{role}</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta}>Member since {formatDate(created_at)}</Text>
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.cardRow}>
          <View style={styles.field}>
            <Text style={styles.label}>Leaderboard view</Text>
            <Text style={styles.value}>{leaderboard_preference || '—'}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Report view</Text>
            <Text style={styles.value}>{report_preference || '—'}</Text>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Leaderboard permissions</Text>
          <View style={styles.chipsWrap}>
            {(leaderboard_permissions && leaderboard_permissions.length > 0)
              ? leaderboard_permissions.map((p, i) => <Chip key={i}>{p}</Chip>)
              : <Text style={styles.subtle}>None</Text>}
          </View>
        </View>
      </View>

      {/* Communication */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Communication</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Phrase sentence</Text>
          <Text style={styles.valueMultiline}>{phrase_sentence || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Unique fillers</Text>
          <View style={styles.chipsWrap}>
            {fillers.length
              ? fillers.map((f, i) => <Chip key={i}>{f}</Chip>)
              : <Text style={styles.subtle}>None detected yet</Text>}
          </View>
        </View>
      </View>

      {/* Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Gesture CSV path</Text>
          <Text style={styles.valueMonospace}>{unique_gesture_csv_path || '—'}</Text>
        </View>
      </View>

      {/* Actions */}
      <Pressable onPress={onLogout} style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.9 }]}>
        <Ionicons name="log-out-outline" size={18} color="white" />
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16 },
  headerRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#0ea5e9',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  avatarText: { color: 'white', fontWeight: '800', fontSize: 20, letterSpacing: 1 },

  title: { fontSize: 20, fontWeight: '800' },
  subtle: { color: '#64748b' },
  meta: { color: '#475569', marginTop: 4, fontSize: 12 },

  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontWeight: '700', fontSize: 12 },

  section: {
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 14, padding: 14, gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },

  cardRow: { flexDirection: 'row', gap: 12 },
  field: { gap: 6, flexShrink: 1, flexGrow: 1 },
  label: { color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 16, fontWeight: '700' },
  valueMultiline: { fontSize: 15, lineHeight: 20, color: '#0f172a' },
  valueMonospace: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), color: '#0f172a' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },

  logoutBtn: {
    marginTop: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: { color: 'white', fontWeight: '800' },
});
