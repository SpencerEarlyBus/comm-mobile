import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS as C } from '../theme/colors';
import { S } from '../theme/spacing';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;         // default: true
  bordered?: boolean;       // default: true
  backgroundColor?: string; // default: C.card
};

export default function AppCard({
  children,
  style,
  padded = true,
  bordered = true,
  backgroundColor = C.card,
}: Props) {
  return (
    <View
      style={[
        styles.base,
        { backgroundColor },
        bordered && styles.bordered,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  padded: {
    padding: S.md,
  },
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
});
