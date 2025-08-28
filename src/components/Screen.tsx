// src/components/Screen.tsx
import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FOOTER_BAR_HEIGHT } from './FooterNav';

type Props = {
  children: React.ReactNode;
  /** If true, uses ScrollView with sensible keyboard/taps config */
  scroll?: boolean;
  /** Add extra bottom padding so content isn't hidden behind the footer bar */
  footerAware?: boolean;
  /** Optional absolutely-positioned background (e.g., a LinearGradient) */
  background?: React.ReactNode;
  /** Style for the main container */
  style?: StyleProp<ViewStyle>;
  /** Content container style (applies to ScrollView or inner View) */
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra vertical space under footer (e.g., if a FAB overlaps) */
  extraBottom?: number;
  /** iOS keyboard offset if you have a custom header; header was removed so default is 0 */
  keyboardOffset?: number;
};

export default function Screen({
  children,
  scroll = false,
  footerAware = false,
  background,
  style,
  contentStyle,
  extraBottom = 12,
  keyboardOffset = 0,
}: Props) {
  const insets = useSafeAreaInsets();

  const paddingTop = insets.top; // keep content clear of the notch/camera
  const paddingBottom =
    insets.bottom + (footerAware ? FOOTER_BAR_HEIGHT + extraBottom : 0);

  const Wrapper = ({ children: inner }: { children: React.ReactNode }) => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
    >
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            { paddingTop, paddingBottom },
            contentStyle as any,
          ]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'interactive'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingTop, paddingBottom }, contentStyle]}>
          {inner}
        </View>
      )}
    </KeyboardAvoidingView>
  );

  return (
    <View style={[{ flex: 1 }, style]}>
      {background /* e.g. LinearGradient with absolute fill */}
      <Wrapper>{children}</Wrapper>
      <StatusBar style="light" translucent backgroundColor="transparent" />
    </View>
  );
}
