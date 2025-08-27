// src/components/HeaderMenu.tsx
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/MobileAuthContext';

export default function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const nav = useNavigation<any>();
  const { logout, isAuthenticated, authReady } = useAuth();

  const go = (route: string) => {
    setOpen(false);
    nav.navigate(route);
  };

  const doLogout = async () => {
    setOpen(false);
    await logout();
    nav.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={{ marginLeft: 8 }}>
      {/* Hamburger button */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={10}
        style={{ padding: 6 }}
      >
        <Text style={{ fontSize: 22 }}>☰</Text>
      </Pressable>

      {/* Dropdown */}
      {open && (
        <>
          {/* Click-away overlay */}
          <Pressable
            onPress={() => setOpen(false)}
            style={{
              position: 'absolute',
              top: 0, left: -8, right: 0, bottom: 0,
            }}
          />

          <View
            style={{
              position: 'absolute',
              top: 36,
              left: -8,
              backgroundColor: 'white',
              borderRadius: 10,
              paddingVertical: 6,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
              minWidth: 180,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              zIndex: 1000,
            }}
          >
            <MenuItem label="Home" onPress={() => go('Home')} />
            <MenuItem label="Sessions" onPress={() => go('Sessions')} />
            <MenuItem label="Recorder" onPress={() => go('Recorder')} />
            <Divider />
            <MenuItem
              label={authReady && isAuthenticated ? 'Log out' : 'Log in'}
              onPress={authReady && isAuthenticated ? doLogout : () => go('Login')}
              danger={!isAuthenticated ? false : true}
            />
          </View>
        </>
      )}
    </View>
  );
}

function MenuItem({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: pressed ? '#f3f4f6' : 'transparent',
      })}
    >
      <Text style={{ fontSize: 16, color: danger ? '#dc2626' : '#111827' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 }} />;
}
