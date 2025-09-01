import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const COLORS = {
  accent: '#0ea5e9',            // inactive arc
  text: '#e2e8f0',              // number in center
  label: '#cbd5e1',             // label (inactive)
  track: 'rgba(148,163,184,0.25)',
  ringBg: 'rgba(15,23,42,0.85)',

  // Active look
  activeArc: '#ffffff',
  activeLabelBg: '#ffffff',
  activeLabelText: '#0b1220',
};

type Props = {
  label: string;
  value: number;        // 0..100
  size?: number;        // px
  stroke?: number;      // px
  active?: boolean;     // highlighted?
  onPress?: () => void;
};

export default function MetricDial({
  label,
  value,
  size = 84,
  stroke = 10,
  active = false,
  onPress,
}: Props) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = useMemo(() => circumference * (clamped / 100), [circumference, clamped]);

  const arcColor = active ? COLORS.activeArc : COLORS.accent;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${Math.round(clamped)} percent`}
      style={({ pressed }) => [
        styles.container,
        { width: size },
        pressed && styles.pressed,
      ]}
      hitSlop={6}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          {/* Inner bg ring for contrast on dark */}
          <Circle cx={size / 2} cy={size / 2} r={radius} fill={COLORS.ringBg} />

          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={COLORS.track}
            strokeWidth={stroke}
            fill="none"
          />

          {/* Progress (same stroke thickness active/inactive) */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={arcColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash}, ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>

        {/* Value */}
        <View style={styles.center}>
          <Text
            style={[
              styles.value,
              {
                color: COLORS.text,
                textShadowColor: 'rgba(0,0,0,0.6)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              },
            ]}
          >
            {Math.round(clamped)}
          </Text>
        </View>
      </View>

      {/* Label: white pill when active, subtle text otherwise */}
      <View
        style={[
          styles.labelWrap,
          active && {
            backgroundColor: COLORS.activeLabelBg,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          },
          { width: size },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: active ? COLORS.activeLabelText : COLORS.label, fontWeight: active ? '800' : '600' },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  center: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  labelWrap: { marginTop: 6, alignItems: 'center' },
  label: { fontSize: 12, textAlign: 'center' },
});
