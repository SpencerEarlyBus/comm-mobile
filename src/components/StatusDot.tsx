import React from 'react';
import { View } from 'react-native';

export default function StatusDot({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <View
      style={{
        position: 'absolute',
        right: -1,
        top: -1,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#22c55e', // green for “in progress” (change to taste)
        borderWidth: 1,
        borderColor: 'white',
      }}
    />
  );
}
