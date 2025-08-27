// src/screens/RecorderScreen.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Button, Alert, Text, Linking, AppState, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, Camera, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { CAMERA } from '../native/camera';
import { useAuth } from '../context/MobileAuthContext';

type Status = 'granted' | 'denied' | 'undetermined' | 'restricted' | 'unknown';
type RNFile = { uri: string; name: string; type: string };
const toRNFile = (uri: string, filename: string, type = 'video/mp4'): RNFile => ({ uri, name: filename, type });

export default function RecorderScreen() {
  const camRef = useRef<CameraView | null>(null);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

   const { fetchWithAuth } = useAuth();
   const { getAccessToken, authReady, isAuthenticated } = useAuth();


  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();

  const [perm, setPerm] = useState<{ cam: Status; mic: Status }>({
    cam: 'unknown',
    mic: 'unknown',
  });

    const guessMime = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'mov') return 'video/quicktime';
    return 'video/mp4'; // default
    };

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
    await refreshPerms();
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

    const doUpload = async (uri: string) => {
    try {
        setUploading(true);

        const filename = uri.split('/').pop() || `mobile_frontFacing_${Date.now()}.mp4`;
        const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.backend.root'; // NO trailing /api unless your backend actually uses it

        const token = getAccessToken();
        console.log('[upload] token present?', !!token, token?.slice(0, 12)); // DEBUG

        const res = await FileSystem.uploadAsync(
        `${API_BASE}/media/mobile_upload_video`, // ensure this matches your Flask route
        uri,
        {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'video',
            parameters: { filename }, // optional; server reads request.files['video']
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
        );

        setUploading(false);

        if (res.status !== 200) {
        console.error('Upload failed', res.status, res.body);
        Alert.alert('Upload failed', res.body || `HTTP ${res.status}`);
        return;
        }

        const data = JSON.parse(res.body);
        Alert.alert('Uploaded!', `Session: ${data.session_id}\nKey: ${data.s3_key}`);
    } catch (e: any) {
        setUploading(false);
        console.error('Upload exception', e);
        Alert.alert('Upload exception', e?.message || String(e));
    }
    };

  const start = async () => {
    if (!(await requestBoth())) return;

    // 10-second countdown
    setCountdown(10);
    const tick = () =>
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) return null;
        return prev - 1;
      });

    const interval = setInterval(tick, 1000);
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 10_000)
    );

    // If user backgrounded app mid-countdown, avoid recording accidentally
    if (AppState.currentState !== 'active') {
      setCountdown(null);
      Alert.alert('Cancelled', 'App was not active.');
      return;
    }

    // Start forced 60s recording (no Stop button shown while recording)
    try {
      setRecording(true);
      const vid = await camRef.current?.recordAsync({
        maxDuration: 60, // seconds
        // quality: '1080p', // optional; adjust as needed for size vs clarity
        // mute: false,
      });
      setRecording(false);

      if (!vid?.uri) {
        Alert.alert('No video captured');
        return;
      }

      // (Optional) iOS: ensure file exists (debug)
      const info = await FileSystem.getInfoAsync(vid.uri);
      console.log('Captured file:', info);

      await doUpload(vid.uri);
    } catch (e: any) {
      setRecording(false);
      console.error('recordAsync error', e);
      Alert.alert('Recording error', e?.message || String(e));
    }
  };

  const granted = perm.cam === 'granted' && perm.mic === 'granted';
  const undetermined = perm.cam === 'undetermined' || perm.mic === 'undetermined';
  const locked = countdown !== null || recording || uploading;

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

          {/* Overlay: countdown / recording / uploading */}
          {(countdown !== null || recording || uploading) && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.35)',
              }}
            >
              {countdown !== null && (
                <Text style={{ fontSize: 64, color: 'white', fontWeight: '700' }}>
                  {countdown}
                </Text>
              )}
              {recording && (
                <Text style={{ marginTop: 6, fontSize: 20, color: 'white' }}>Recording… (1 min)</Text>
              )}
              {uploading && (
                <>
                  <ActivityIndicator size="large" />
                  <Text style={{ marginTop: 6, fontSize: 16, color: 'white' }}>Uploading…</Text>
                </>
              )}
            </View>
          )}

          {/* Bottom controls */}
          <View style={{ position: 'absolute', bottom: 30, alignSelf: 'center' }}>
            <Button
            title="Start (10s → 60s)"
            onPress={start}
            disabled={!authReady || !isAuthenticated || countdown !== null || recording || uploading}
            />
          </View>
        </>
      )}
    </View>
  );
}
