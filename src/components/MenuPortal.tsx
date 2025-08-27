// src/components/MenuPortal.tsx
import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMenu } from '../context/MenuContext';
import { useAuth } from '../context/MobileAuthContext';

export default function MenuPortal() {
  const nav = useNavigation<any>();
  const { leftOpen, rightOpen, closeLeft, closeRight } = useMenu();
  const { logout, isAuthenticated, authReady } = useAuth();

  const go = (route: string) => {
    closeLeft();
    nav.navigate(route);
  };

  const doLogout = async () => {
    closeRight();
    await logout();
    nav.reset({ index: 0, routes: [{ name: 'Home' }] }); // ← Home, not Login
  };

  return (
    <>
      {/* Left hamburger menu */}
      <Modal transparent visible={leftOpen} animationType="fade" onRequestClose={closeLeft}>
        <Pressable style={{ flex: 1 }} onPress={closeLeft}>
          <View
            style={{
              position: 'absolute',
              top: 60,
              left: 12,
              backgroundColor: 'white',
              borderRadius: 12,
              paddingVertical: 6,
              minWidth: 200,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 5,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}
          >
            <Item label="Home" onPress={() => go('Home')} />
            <Item label="Sessions" onPress={() => go('Sessions')} />
            <Item label="Recorder" onPress={() => go('Recorder')} />
            {authReady && !isAuthenticated && (
              <>
                <Divider />
                <Item label="Log in" onPress={() => go('Login')} />
                <Item label="Sign up" onPress={() => go('Signup')} />
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Right user menu */}
      <Modal transparent visible={rightOpen} animationType="fade" onRequestClose={closeRight}>
        <Pressable style={{ flex: 1 }} onPress={closeRight}>
          <View
            style={{
              position: 'absolute',
              top: 60,
              right: 12,
              backgroundColor: 'white',
              borderRadius: 12,
              paddingVertical: 6,
              minWidth: 160,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 5,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}
          >
            {authReady && isAuthenticated ? (
              <>
                <Item label="Sessions" onPress={() => { closeRight(); nav.navigate('Sessions'); }} />
                <Item label="Recorder" onPress={() => { closeRight(); nav.navigate('Recorder'); }} />
                <Divider />
                <Item label="Log out" onPress={doLogout} danger />
              </>
            ) : (
              <>
                <Item label="Log in" onPress={() => { closeRight(); nav.navigate('Login'); }} />
                <Item label="Sign up" onPress={() => { closeRight(); nav.navigate('Signup'); }} />
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Item({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: pressed ? '#f3f4f6' : 'transparent',
      })}
    >
      <Text style={{ fontSize: 16, color: danger ? '#dc2626' : '#111827' }}>{label}</Text>
    </Pressable>
  );
}
function Divider() {
  return <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 }} />;
}
