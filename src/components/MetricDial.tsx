import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

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
  size = 78,
  stroke = 8,
  active = false,
  onPress,
}: Props) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (clamped / 100);
  const baseColor = active ? '#0ea5e9' : '#0f172a'; // sky-500 when active, slate-900 otherwise
  const trackColor = '#e5e7eb';

  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', width: size }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={stroke}
            fill="none"
          />
          {/* Progress */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={baseColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${progress}, ${circumference}`}
            // Start at 12 o'clock
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: baseColor }}>
            {Math.round(clamped)}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 6,
          fontSize: 12,
          fontWeight: active ? '700' : '600',
          color: active ? '#0ea5e9' : '#334155',
          textAlign: 'center',
          width: size,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
