// src/components/FooterNav.tsx
import React from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navGo } from '../navigation/navRef';
import { useUIChrome } from '../context/UIChromeContext';
import { useAuth } from '../context/MobileAuthContext';
import { C } from '../theme/tokens';

type Props = { currentRoute?: string };
export const FOOTER_BAR_HEIGHT = 64;

export default function FooterNav({ currentRoute }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { hidden } = useUIChrome();
  const { authReady, isAuthenticated } = useAuth() as any;

  const base = 390;
  const scale = Math.min(Math.max(width / base, 0.9), 1.15);
  const ICON_SIZE = Math.round(22 * scale);
  const REC_BTN = Math.round(44 * scale);
  const REC_BTN_CLAMP = Math.min(Math.max(REC_BTN, 40), 52);

  const isActive = (r: string) => currentRoute === r;

  // 🔒 Hide footer on Home (login/signup) or if not authed, or if UI chrome requests hidden
  const shouldHide =
    hidden ||
    currentRoute === 'Home' ||
    (authReady && !isAuthenticated);

  if (shouldHide) return null;

  return (
    <View pointerEvents="box-none" style={{ ...StyleSheet.absoluteFillObject }}>
      <View
        style={[
          styles.bar,
          {
            paddingBottom: (insets.bottom || 10) + 6,
            paddingTop: 8,
            paddingHorizontal: Math.round(12 * scale),
          },
        ]}
      >
        {/* 1. Sessions */}
        <NavSlot>
          <TabButton
            label="Sessions"
            active={isActive('Sessions')}
            iconActive="albums"
            iconInactive="albums-outline"
            iconSize={ICON_SIZE}
            onPress={() => navGo('Sessions')}
          />
        </NavSlot>

        {/* 2. Leaderboard */}
        <NavSlot>
          <TabButton
            label="Leaders"
            active={isActive('Leaderboard')}
            iconActive="trophy"
            iconInactive="trophy-outline"
            iconSize={ICON_SIZE}
            onPress={() => navGo('Leaderboard')}
          />
        </NavSlot>

        {/* 3. Record — red when active */}
        <NavSlot>
          <Pressable onPress={() => navGo('Recorder')} hitSlop={10}>
            {({ pressed }) => {
              const recorderActive = isActive('Recorder');
              return (
                <View style={styles.recWrapper}>
                  <View
                    style={[
                      styles.recordBtn,
                      recorderActive && styles.recordBtnActive,
                      {
                        width: REC_BTN_CLAMP,
                        height: REC_BTN_CLAMP,
                        borderRadius: REC_BTN_CLAMP / 2,
                      },
                      pressed && { transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    <Ionicons
                      name="videocam"
                      size={ICON_SIZE + 2}
                      color={recorderActive ? C.white : C.black}
                    />
                  </View>
                </View>
              );
            }}
          </Pressable>
        </NavSlot>

        {/* 4. Topics */}
        <NavSlot>
          <TabButton
            label="Explore"
            active={isActive('TopicsToday')}
            iconActive="bulb"
            iconInactive="bulb-outline"
            iconSize={ICON_SIZE}
            onPress={() => navGo('TopicsToday')}
          />
        </NavSlot>

        {/* 5. Profile */}
        <NavSlot>
          <TabButton
            label="Profile"
            active={isActive('Profile')}
            iconActive="person-circle"
            iconInactive="person-circle-outline"
            iconSize={ICON_SIZE}
            onPress={() => navGo('Profile')}
          />
        </NavSlot>
      </View>
    </View>
  );
}

function NavSlot({ children }: { children: React.ReactNode }) {
  return <View style={styles.slot}>{children}</View>;
}

function TabButton({
  label,
  active,
  iconActive,
  iconInactive,
  iconSize,
  onPress,
}: {
  label: string;
  active: boolean;
  iconActive: any;
  iconInactive: any;
  iconSize: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tab} hitSlop={8}>
      <Ionicons
        name={active ? iconActive : iconInactive}
        size={iconSize}
        color={active ? C.white : C.label}
      />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    minHeight: FOOTER_BAR_HEIGHT,
    backgroundColor: C.bgGlass,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 68,
  },

  tab: { alignItems: 'center', justifyContent: 'center' },
  label: { color: C.label, fontSize: 12, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  labelActive: { color: C.white },

  recordBtn: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  recordBtnActive: {
    backgroundColor: C.danger,
    borderColor: '#fca5a5',
  },
  recWrapper: { alignItems: 'center', justifyContent: 'center' },
});
