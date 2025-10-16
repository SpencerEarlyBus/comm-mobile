// src/screens/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/MobileAuthContext';
import Screen from '../components/Screen';
import HeaderBar from '../components/HeaderBar';
import { COLORS } from '../theme/colors';
import { COLORS as C} from '../theme/colors';


import { useLeftDrawer } from '../features/leftDrawer';
import { makeDrawerStyles } from '../features/drawerStyles';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import LeftDrawerPlaceholder from '../components/LeftDrawerMainAdditionalNav';


const HEADER_ROW_H = 56;
const DRAWER_WIDTH = 280;


const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.backend.root';

function formatDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Avatar({ name, email }: { name?: string; email?: string }) {
  const label = (name || email || 'U').trim();
  const initials =
    label
      .replace(/@.*/, '')
      .split(/[.\s_]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
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
  const { user, logout, fetchWithAuth, updateUser } = useAuth() as any;
  const insets = useSafeAreaInsets();

  const {
    email,
    username,
    role,
    created_at,
    email_verified,
    leaderboard_permissions,
    followed_leaderboard_tags,
  } = (user || {}) as {
    email?: string;
    username?: string;
    role?: string;
    created_at?: string;
    email_verified?: boolean;
    leaderboard_permissions?: string[];
    followed_leaderboard_tags?: string[];
  };

  const [followedTags, setFollowedTags] = useState<string[]>(followed_leaderboard_tags ?? []);


  //hamburger stuff 
  const headerHeight = (insets.top || 0) + HEADER_ROW_H;

  const {
    drawerOpen, openDrawer, closeDrawer,
    edgeSwipe, drawerDrag, drawerStyle, overlayStyle
  } = useLeftDrawer({ headerHeight, drawerWidth: DRAWER_WIDTH });

  const drawerStyles = makeDrawerStyles({
    headerHeight,
    drawerWidth: DRAWER_WIDTH,
    bgColor: C.bg,
    borderColor: C.border,
  });



  useEffect(() => {
    setFollowedTags(followed_leaderboard_tags ?? []);
  }, [followed_leaderboard_tags]);

  useEffect(() => {
    // refresh follows (auth required)
    (async () => {
      if (!email) return;
      try {
        const res = await fetchWithAuth(`${API_BASE}/mobile/leaderboards/follows`);
        if (!res.ok) return;
        const data = await res.json();
        const tags: string[] = data?.tags || [];
        setFollowedTags(tags);
        updateUser({ followed_leaderboard_tags: tags });
      } catch {}
    })();
  }, [email, fetchWithAuth, updateUser]);

  const verifiedColor = email_verified ? COLORS.success : COLORS.danger;
  const verifiedIcon = email_verified ? 'checkmark-circle' : 'close-circle';
  const verifiedLabel = email_verified ? 'Verified' : 'Unverified';

  const onLogout = async () => {
    try {
      await logout();
      Alert.alert('Signed out');
    } catch {}
  };

  return (
    <View style={styles.container}>
      <HeaderBar title="Profile" 
      onPressMenu={openDrawer}  
      onPressNotifications={() => Alert.alert('Notifications', 'Coming soon')}
      onPressStatus={() => {}} 
      dark />

      {/* Let Screen own the ScrollView; single horizontal inset */}
      <GestureDetector gesture={edgeSwipe}>
      <View style={{ flex: 1 }}>
      <Screen
        scroll
        footerAware
        contentStyle={[styles.content, { paddingBottom: 160 + insets.bottom }]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Avatar name={username} email={email} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{username || email || 'Profile'}</Text>
            <Text style={styles.subtle}>{email || '—'}</Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: `${verifiedColor}22`, borderColor: `${verifiedColor}66` },
                ]}
              >
                <Ionicons name={verifiedIcon as any} size={16} color={verifiedColor} />
                <Text style={[styles.badgeText, { color: verifiedColor }]}>{verifiedLabel}</Text>
              </View>
              {!!role && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: 'rgba(2,132,199,0.12)', borderColor: 'rgba(2,132,199,0.35)' },
                  ]}
                >
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.accent} />
                  <Text style={[styles.badgeText, { color: COLORS.accent }]}>{role}</Text>
                </View>
              )}
            </View>
            <Text style={styles.meta}>Member since {formatDate(created_at)}</Text>
          </View>
        </View>

        {/* ONE BOX: Permissions + Following (full width inside 20px gutter) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leaderboards</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Permissions</Text>
            <View style={styles.chipsWrap}>
              {leaderboard_permissions?.length ? (
                leaderboard_permissions.map((p, i) => <Chip key={i}>{p}</Chip>)
              ) : (
                <Text style={styles.subtle}>None</Text>
              )}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Following</Text>
            <View style={styles.chipsWrap}>
              {followedTags.length ? (
                followedTags.map((t, i) => <Chip key={i}>{t}</Chip>)
              ) : (
                <Text style={styles.subtle}>You’re not following any leaderboards yet</Text>
              )}
            </View>
          </View>
        </View>

        {/* Placeholder: Rank & Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rank & Stats</Text>
          <Text style={styles.valueMultiline}>
            Your leaderboard ranking will show up here.
          </Text>
        </View>

        {/* Actions */}
        <Pressable
          onPress={onLogout}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.92 }]}
        >
          <Ionicons name="log-out-outline" size={18} color={COLORS.white} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </Screen>
      </View>
      </GestureDetector>



      {drawerOpen && (
        <Pressable onPress={closeDrawer} style={StyleSheet.absoluteFill} pointerEvents="auto">
          <Animated.View style={[drawerStyles.overlay, overlayStyle]} />
        </Pressable>
      )}

      <GestureDetector gesture={drawerDrag}>
        <Animated.View style={[drawerStyles.drawer, drawerStyle]}>
          <LeftDrawerPlaceholder onClose={closeDrawer} />
        </Animated.View>
      </GestureDetector>


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Single source of truth for horizontal inset → boxes expand naturally
  content: { paddingHorizontal: 20, gap: 16 },

  headerRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: 20, letterSpacing: 1 },

  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  subtle: { color: COLORS.label },
  meta: { color: COLORS.track, marginTop: 4, fontSize: 12 },

  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontWeight: '700', fontSize: 12 },

  section: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },

  field: { gap: 6, flexShrink: 1, flexGrow: 1 },
  label: { color: COLORS.label, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  valueMultiline: { fontSize: 15, lineHeight: 20, color: COLORS.text },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: COLORS.track,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { color: COLORS.text, fontWeight: '700', fontSize: 12 },

  logoutBtn: {
    marginTop: 8,
    backgroundColor: COLORS.danger,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: { color: COLORS.white, fontWeight: '800' },
});
