// src/screens/RecorderScreen.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Button, Alert, Text, Linking, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, Camera, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { CAMERA } from '../native/camera';

type Status = 'granted' | 'denied' | 'undetermined' | 'restricted' | 'unknown';

export default function RecorderScreen() {
  const camRef = useRef<CameraView | null>(null);
  const [recording, setRecording] = useState(false);

  // hooks (still useful for request APIs)
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();

  // local state we control/update explicitly
  const [perm, setPerm] = useState<{ cam: Status; mic: Status }>({
    cam: 'unknown',
    mic: 'unknown',
  });

  const refreshPerms = useCallback(async () => {
    const cam = await Camera.getCameraPermissionsAsync();
    const mic = await Camera.getMicrophonePermissionsAsync();
    setPerm({
      cam: (cam?.status as Status) ?? 'unknown',
      mic: (mic?.status as Status) ?? 'unknown',
    });
    console.log('REFRESH perm ->', cam?.status, mic?.status);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPerms();
    }, [refreshPerms])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshPerms();
    });
    return () => sub.remove();
  }, [refreshPerms]);

  const requestBoth = async () => {
    const c = perm.cam === 'granted' ? camPerm : await requestCam();
    const m = perm.mic === 'granted' ? micPerm : await requestMic();
    const camOK = (c?.status ?? perm.cam) === 'granted';
    const micOK = (m?.status ?? perm.mic) === 'granted';
    await refreshPerms(); // pull latest after requesting
    if (!camOK || !micOK) {
      Alert.alert(
        'Permissions needed',
        'Please enable Camera and Microphone in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  const start = async () => {
    if (!(await requestBoth())) return;
    setRecording(true);
    const vid = await camRef.current?.recordAsync({ maxDuration: 180 });
    setRecording(false);
    if (!vid?.uri) return;
    Alert.alert('Recorded!', `File at: ${vid.uri}`);
  };

  const stop = () => camRef.current?.stopRecording();

  const granted = perm.cam === 'granted' && perm.mic === 'granted';
  const undetermined = perm.cam === 'undetermined' || perm.mic === 'undetermined';

  return (
    <View style={{ flex: 1 }}>
      {/* Debug panel — remove later */}
      <View style={{ padding: 10, backgroundColor: '#111827' }}>
        <Text style={{ color: 'white' }}>camPerm: {String(perm.cam)}</Text>
        <Text style={{ color: 'white' }}>micPerm: {String(perm.mic)}</Text>
      </View>

      {!granted ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 12 }}>
            We need your permission to use the camera and microphone to record.
          </Text>
          <Button
            title={undetermined ? 'Allow Camera & Microphone' : 'Open Settings'}
            onPress={undetermined ? requestBoth : () => Linking.openSettings()}
          />
          <View style={{ height: 8 }} />
          <Button title="Refresh Status" onPress={refreshPerms} />
        </View>
      ) : (
        <>
          <CameraView ref={camRef} style={{ flex: 1 }} facing={CAMERA.FRONT} mode="video" />
          <View style={{ position: 'absolute', bottom: 30, alignSelf: 'center', gap: 10 }}>
            {!recording
              ? <Button title="Start Recording" onPress={start} />
              : <Button title="Stop" onPress={stop} />}
          </View>
        </>
      )}
    </View>
  );
}
