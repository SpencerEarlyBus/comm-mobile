// src/components/Screen.tsx
import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  ViewStyle,
  ScrollViewProps,
  RefreshControlProps,
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

  /** Include safe-area top padding (default true). Set false if you render your own header above. */
  includeTopInset?: boolean;
  /** Include safe-area bottom padding (default true). Ignored if footerAware = true. */
  includeBottomInset?: boolean;

  /** Optional custom scroll component, defaults to RN ScrollView */
  ScrollComponent?: React.ComponentType<ScrollViewProps>;
  /** Props passed through to the scroll component */
  scrollProps?: ScrollViewProps;
  /** Convenience prop if you want to pass refreshControl directly */
  refreshControl?: React.ReactElement<RefreshControlProps>;
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
  ScrollComponent,
  scrollProps,
  refreshControl,
  includeTopInset = true,
  includeBottomInset = true,
}: Props) {
  const insets = useSafeAreaInsets();

  const paddingTop = includeTopInset ? insets.top : 0;
  const baseBottom = includeBottomInset ? insets.bottom : 0;
  const paddingBottom =
    baseBottom + (footerAware ? FOOTER_BAR_HEIGHT + extraBottom : 0);

  const ScrollImpl = ScrollComponent || ScrollView;

  // Pull out pieces we want to control/merge ourselves
  const {
    contentContainerStyle: userContentContainerStyle,
    refreshControl: rcFromProps,
    ...restScrollProps
  } = scrollProps || {};

  const mergedContentContainerStyle: any = [
    { paddingTop, paddingBottom },
    contentStyle as any,
  ];
  if (userContentContainerStyle) {
    // Allow caller to add more content container styles
    if (Array.isArray(userContentContainerStyle)) {
      mergedContentContainerStyle.push(...userContentContainerStyle);
    } else {
      mergedContentContainerStyle.push(userContentContainerStyle as any);
    }
  }

  const Wrapper = ({ children: inner }: { children: React.ReactNode }) => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
    >
      {scroll ? (
        <ScrollImpl
          style={{ flex: 1 }}
          contentContainerStyle={mergedContentContainerStyle}
          keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'interactive'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...restScrollProps}
          // Prefer explicit prop, fallback to scrollProps
          refreshControl={refreshControl ?? rcFromProps}
        >
          {inner}
        </ScrollImpl>
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
