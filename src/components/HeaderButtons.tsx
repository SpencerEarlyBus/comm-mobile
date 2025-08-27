// src/components/HeaderButtons.tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMenu } from '../context/MenuContext';

export function HeaderHamburger() {
  const { openLeft } = useMenu();
  return (
    <Pressable onPress={openLeft} hitSlop={10} style={{ paddingHorizontal: 8 }}>
      <Text style={{ fontSize: 22 }}>☰</Text>
    </Pressable>
  );
}

export function HeaderUser() {
  const { openRight } = useMenu();
  return (
    <Pressable onPress={openRight} hitSlop={10} style={{ paddingHorizontal: 8 }}>
      {/* Simple user glyph; swap for @expo/vector-icons if desired */}
      <View style={{
        width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#111827',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Text style={{ fontSize: 14 }}>👤</Text>
      </View>
    </Pressable>
  );
}
