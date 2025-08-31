import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  ViewStyle,
  TextStyle,
} from 'react-native';

// Enable layout animation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  title: string;
  initiallyCollapsed?: boolean;         // default true
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  headerStyle?: ViewStyle;
  titleStyle?: TextStyle;
  headerTint?: string;                  // default '#0f172a'
  borderColor?: string;                 // default '#e5e7eb'
  backgroundColor?: string;             // default '#fff'
  rightAdornment?: React.ReactNode;     // optional (e.g., buttons)
  onToggle?: (collapsed: boolean) => void;
};

const CollapsibleBox: React.FC<Props> = ({
  title,
  initiallyCollapsed = true,
  children,
  containerStyle,
  headerStyle,
  titleStyle,
  headerTint = '#0f172a',
  borderColor = '#e5e7eb',
  backgroundColor = '#fff',
  rightAdornment,
  onToggle,
}) => {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => {
      const next = !c;
      onToggle?.(next);
      return next;
    });
  }, [onToggle]);

  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor,
          borderRadius: 12,
          backgroundColor,
          overflow: 'hidden',
          marginBottom: 10,
        },
        containerStyle,
      ]}
    >
      <Pressable
        onPress={toggle}
        style={[
          {
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          headerStyle,
        ]}
      >
        <Text style={[{ fontSize: 16, fontWeight: '700', color: headerTint }, titleStyle]}>
          {title}
        </Text>
        {rightAdornment ?? (
          <Text style={{ color: '#64748b' }}>{collapsed ? '▾' : '▴'}</Text>
        )}
      </Pressable>

      {!collapsed && <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>{children}</View>}
    </View>
  );
};

export default CollapsibleBox;
