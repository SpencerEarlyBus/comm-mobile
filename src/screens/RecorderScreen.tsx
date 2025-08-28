// src/screens/RecorderScreen.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Button, Alert, Text, Linking, AppState, ActivityIndicator, Platform,
  TextInput, Switch, ScrollView, StyleSheet, Pressable
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, Camera, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { CAMERA } from '../native/camera';
import { useAuth } from '../context/MobileAuthContext';

type Status = 'granted' | 'denied' | 'undetermined' | 'restricted' | 'unknown';

const DEFAULT_TOPICS = [
  'Elevator pitch',
  'Tell me about yourself',
  'Why this role?',
  'Strengths & weaknesses',
  'A time you solved a problem',
];

export default function RecorderScreen() {
  const camRef = useRef<CameraView | null>(null);

  // phases: setup (no camera), capture (camera mounted)
  const [mode, setMode] = useState<'setup' | 'capture'>('setup');

  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const { user, authReady, isAuthenticated, getValidAccessToken } = useAuth() as any;

  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();

  const [perm, setPerm] = useState<{ cam: Status; mic: Status }>({ cam: 'unknown', mic: 'unknown' });

  // setup form state
  const [topic, setTopic] = useState(DEFAULT_TOPICS[0]);
  const [organization, setOrganization] = useState('');
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(true);

  const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.backend.root'; // ← ensure correct base

  const refreshPerms = useCallback(async () => {
    const cam = await Camera.getCameraPermissionsAsync();
    const mic = await Camera.getMicrophonePermissionsAsync();
    setPerm({
      cam: (cam?.status as Status) ?? 'unknown',
      mic: (mic?.status as Status) ?? 'unknown',
    });
  }, []);

  useFocusEffect(useCallback(() => { refreshPerms(); }, [refreshPerms]));

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

  const buildMetadataText = () => {
    const now = new Date().toISOString();
    const lines = [
      `email: ${user?.email ?? ''}`,
      `datetime_iso: ${now}`,
      `topic: ${topic}`,
      `organization: ${organization}`,
      `leaderboard_opt_in: ${leaderboardOptIn ? 'true' : 'false'}`,
      `platform: ${Platform.OS} ${Platform.Version}`,
      `app: comm-mobile`,
    ];
    return lines.join('\n');
  };

  const doUpload = async (uri: string) => {
    setUploading(true);
    try {
      const filename = uri.split('/').pop() || `mobile_frontFacing_${Date.now()}.mp4`;
      const token = await getValidAccessToken(); // ← always valid or null
      if (!token) throw new Error('Not authenticated');

      // pass metadata via "parameters" (Form fields) — backend reads request.form.get('metadata')
      const res = await FileSystem.uploadAsync(
        `${API_BASE}/media/mobile_upload_video`,
        uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'video',
          parameters: {
            filename,
            metadata: buildMetadataText(),
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setUploading(false);

      if (res.status < 200 || res.status >= 300) {
        console.error('Upload failed', res.status, res.body);
        Alert.alert('Upload failed', res.body || `HTTP ${res.status}`);
        return;
      }

      const data = safeJson(res.body);
      Alert.alert('Uploaded!', `Session: ${data?.session_id ?? '—'}\nKey: ${data?.s3_key ?? '—'}`);
      // reset back to setup for next run
      setMode('setup');
    } catch (e: any) {
      setUploading(false);
      console.error('Upload exception', e);
      Alert.alert('Upload exception', e?.message || String(e));
    }
  };

  const safeJson = (s?: string) => {
    try { return s ? JSON.parse(s) : null; } catch { return null; }
  };

  const startCaptureFlow = useCallback(async () => {
    if (!(await requestBoth())) return;

    // 10s countdown
    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown(prev => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 10_000);
    });

    if (AppState.currentState !== 'active') {
      setCountdown(null);
      Alert.alert('Cancelled', 'App was not active.');
      return;
    }

    // Record 60s (no stop button)
    try {
      setRecording(true);
      const vid = await camRef.current?.recordAsync({ maxDuration: 60 });
      setRecording(false);

      if (!vid?.uri) {
        Alert.alert('No video captured');
        return;
      }

      // optional: debug file info
      const info = await FileSystem.getInfoAsync(vid.uri);
      console.log('Captured file:', info);

      await doUpload(vid.uri);
    } catch (e: any) {
      setRecording(false);
      console.error('recordAsync error', e);
      Alert.alert('Recording error', e?.message || String(e));
    }
  }, [requestBoth]);

  // derived UI state
  const granted = perm.cam === 'granted' && perm.mic === 'granted';
  const undetermined = perm.cam === 'undetermined' || perm.mic === 'undetermined';
  const locked = countdown !== null || recording || uploading;

  // ---------- RENDER ----------
  if (mode === 'setup') {
    return (
      <ScrollView contentContainerStyle={styles.setupRoot}>
        <Text style={styles.h1}>New recording</Text>
        <Text style={styles.sub}>Choose a topic, then press Ready.</Text>

        <Text style={styles.label}>Topic</Text>
        <View style={styles.topicList}>
          {DEFAULT_TOPICS.map((t) => {
            const active = topic === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTopic(t)}
                style={[styles.topicPill, active && styles.topicPillActive]}
              >
                <Text style={[styles.topicText, active && styles.topicTextActive]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: 18 }]}>Organization (optional)</Text>
        <TextInput
          placeholder="e.g., Comm Labs"
          placeholderTextColor="#94a3b8"
          value={organization}
          onChangeText={setOrganization}
          style={styles.input}
        />

        <View style={styles.row}>
          <Text style={styles.labelInline}>Include on leaderboard</Text>
          <Switch value={leaderboardOptIn} onValueChange={setLeaderboardOptIn} />
        </View>

        {!granted && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.note}>
              Camera & microphone permissions are required.
            </Text>
            <Button
              title={undetermined ? 'Allow Camera & Microphone' : 'Open Settings'}
              onPress={undetermined ? requestBoth : () => Linking.openSettings()}
            />
          </View>
        )}

        <View style={{ height: 12 }} />
        <Button
          title={!authReady || !isAuthenticated ? 'Log in to continue' : 'Ready'}
          onPress={() => {
            if (!isAuthenticated) {
              Alert.alert('Please sign in', 'You must be logged in to record.');
              return;
            }
            setMode('capture');
            // allow CameraView to mount before starting
            setTimeout(() => startCaptureFlow(), 250);
          }}
          disabled={!authReady || !isAuthenticated}
        />
      </ScrollView>
    );
  }

  // capture mode (camera mounted)
  return (
    <View style={{ flex: 1 }}>
      <CameraView ref={camRef} style={{ flex: 1 }} facing={CAMERA.FRONT} mode="video" />

      {(countdown !== null || recording || uploading) && (
        <View style={styles.overlay}>
          {countdown !== null && <Text style={styles.countText}>{countdown}</Text>}
          {recording && <Text style={styles.statusText}>Recording… (1 min)</Text>}
          {uploading && (
            <>
              <ActivityIndicator size="large" />
              <Text style={styles.statusText}>Uploading…</Text>
            </>
          )}
        </View>
      )}

      {/* In case you want a way out if not locked */}
      {!locked && (
        <View style={styles.bottomBar}>
          <Button title="Back to Setup" onPress={() => setMode('setup')} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  setupRoot: { padding: 16, paddingBottom: 120, gap: 10 },
  h1: { fontSize: 22, fontWeight: '800' },
  sub: { color: '#475569', marginBottom: 10 },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  labelInline: { fontSize: 14, color: '#0f172a', fontWeight: '700' },

  topicList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  topicPill: {
    borderWidth: 1, borderColor: '#cbd5e1',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#fff',
  },
  topicPillActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  topicText: { color: '#0f172a', fontWeight: '700' },
  topicTextActive: { color: '#fff' },

  input: {
    borderWidth: 1, borderColor: '#cbd5e1', padding: 10,
    borderRadius: 10, color: '#0f172a', backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },

  note: { color: '#64748b', fontSize: 13, marginBottom: 8 },

  overlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)',
  },
  countText: { fontSize: 64, color: 'white', fontWeight: '700' },
  statusText: { marginTop: 6, fontSize: 18, color: 'white' },
  bottomBar: { position: 'absolute', bottom: 30, alignSelf: 'center' },
});
