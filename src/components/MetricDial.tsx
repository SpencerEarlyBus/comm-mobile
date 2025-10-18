import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const COLORS = {
  accent: '#0ea5e9',
  text: '#e2e8f0',
  label: '#cbd5e1',
  track: 'rgba(148,163,184,0.25)',
  ringBg: 'rgba(15,23,42,0.85)',
  activeArc: '#5eb718',
  activeLabelBg: '#5eb718',
  activeLabelText: '#0b1220',
};

type Props = {
  label?: string;
  /** Arc fill percentage (0..100) */
  value: number;
  size?: number;
  stroke?: number;
  active?: boolean;
  onPress?: () => void;
  /** NEW: hide built-in number */
  showValue?: boolean;
  /** NEW: custom center content (e.g., 4-digit ELO) */
  center?: React.ReactNode;
  showLabel?: boolean; 
};

export default function MetricDial({
  label,
  value,
  size = 84,
  stroke = 10,
  active = false,
  onPress,
  showValue = true,
  center,
  showLabel = true, 
}: Props) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = useMemo(() => circumference * (clamped / 100), [circumference, clamped]);
  const arcColor = active ? COLORS.activeArc : COLORS.accent;

  // dynamic center font for default value
  const centerFont = Math.max(14, Math.round(size * 0.22));

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
          <Circle cx={size / 2} cy={size / 2} r={radius} fill={COLORS.ringBg} />
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={COLORS.track} strokeWidth={stroke} fill="none" />
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

        {/* Center */}
        <View style={styles.center}>
          {center ?? (showValue ? (
            <Text
              style={[styles.value, {
                color: COLORS.text,
                fontSize: centerFont,
                textShadowColor: 'rgba(0,0,0,0.6)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {Math.round(clamped)}
            </Text>
          ) : null)}
        </View>
      </View>

      {/* Label */}
      {showLabel && !!label && (
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
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  center: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  value: { fontWeight: '800', letterSpacing: 0.2 },
  labelWrap: { marginTop: 6, alignItems: 'center' },
  label: { fontSize: 12, textAlign: 'center' },
});
