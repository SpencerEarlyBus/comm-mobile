import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Button, Alert, Linking, AppState, Platform, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, Camera, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { CAMERA } from '../native/camera';
import { useAuth } from '../context/MobileAuthContext';
import HeaderBar from '../components/HeaderBar';
import { useUIChrome } from '../context/UIChromeContext';

import RecorderSetupPanel from '../components/RecorderSetupPanel';
import RecordingOverlay from '../components/RecordingOverlay';
import TopicCountdownPanel from '../components/TopicCountdownPanel';
import { COLORS } from '../theme/colors';

type Status = 'granted' | 'denied' | 'undetermined' | 'restricted' | 'unknown';

type FollowedBoard = {
  id: string;
  tag: string;
  name: string;
  description?: string | null;
  diffLevel?: string | null;
  example_topic?: string | null;
};

export default function RecorderScreen() {
  const camRef = useRef<CameraView | null>(null);
  const { setHidden } = useUIChrome();

  
  const [mode, setMode] = useState<'setup' | 'preview' | 'capture'>('setup');
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortedRef = useRef(false);

  const { user, authReady, isAuthenticated, getValidAccessToken, fetchWithAuth } = useAuth() as any;

  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [perm, setPerm] = useState<{ cam: Status; mic: Status }>({ cam: 'unknown', mic: 'unknown' });

  // Topic now comes only from the leaderboard JSON when Ready is pressed
  const [topic, setTopic] = useState<string>('');
  const [assignedTopic, setAssignedTopic] = useState<string>('');
  const assignedTopicRef = React.useRef<string>('');
  useEffect(() => { assignedTopicRef.current = assignedTopic; }, [assignedTopic]);

  const [organization, setOrganization] = useState('');
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(true);

  // Followed leaderboards + selected per-session leaderboard
  const [followedBoards, setFollowedBoards] = useState<FollowedBoard[]>([]);
  const [selectedLeaderboardTag, setSelectedLeaderboardTag] = useState<string | null>(null);
  const [prepping, setPrepping] = useState(false); // blocks Ready while fetching topic

  const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.backend.root';

  // Hide chrome while in preview (countdown screen) or capture.
  useEffect(() => {
    const hide = (mode === 'preview' || mode === 'capture') && (recording || uploading || countdown !== null || mode === 'preview');
    setHidden(hide);
    return () => setHidden(false);
  }, [mode, recording, uploading, countdown, setHidden]);

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

  useEffect(() => {
    // cleanup if screen unmounts mid-capture/preview
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      setHidden(false);
      abortedRef.current = true;
      try { camRef.current?.stopRecording?.(); } catch {}
    };
  }, [setHidden]);

  // Load followed leaderboards (JWT)
  const loadFollowed = useCallback(async () => {
    if (!isAuthenticated) {
      setFollowedBoards([]);
      setSelectedLeaderboardTag(null);
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}/mobile/leaderboards/follows`);
      if (!res.ok) return;
      const data = await res.json();
      const items = (data?.items || []) as FollowedBoard[];
      setFollowedBoards(items);
      // pick first by default if opted-in and none selected
      if (leaderboardOptIn && !selectedLeaderboardTag && items.length) {
        setSelectedLeaderboardTag(items[0].tag);
      }
    } catch {
      // ignore
    }
  }, [API_BASE, fetchWithAuth, isAuthenticated, leaderboardOptIn, selectedLeaderboardTag]);

  useEffect(() => {
    loadFollowed();
  }, [loadFollowed]);

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



  const safeJson = (s?: string) => {
    try { return s ? JSON.parse(s) : null; } catch { return null; }
  };


  const doUpload = React.useCallback(async (uri: string) => {
    setUploading(true);
    try {
      const nowTopic = String(assignedTopicRef.current || '');  // <- always fresh
      const nowTag = leaderboardOptIn ? (selectedLeaderboardTag ?? '') : '';
      const filename = uri.split('/').pop() || `mobile_frontFacing_${Date.now()}.mp4`;
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');

      // build the text right here to avoid stale closures
      const metadataText =
        [
          `email: ${user?.email ?? ''}`,
          `datetime_iso: ${new Date().toISOString()}`,
          `topic: ${nowTopic}`,
          `organization: ${organization}`,
          `leaderboard_opt_in: ${leaderboardOptIn ? 'true' : 'false'}`,
          `leaderboard_tag: ${nowTag}`,
          `platform: ${Platform.OS} ${Platform.Version}`,
          `app: comm-mobile`,
        ].join('\n');


      const res = await FileSystem.uploadAsync(`${API_BASE}/media/mobile_upload_video`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'video',
        parameters: {
          filename,
          metadata: metadataText,            // human-readable file
          topic: nowTopic,                   // machine field
          topic_title: nowTopic,             // alt key (some backends use this)
          leaderboard_tag: nowTag,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      setUploading(false);
      if (res.status < 200 || res.status >= 300) {
        Alert.alert('Upload failed', res.body || `HTTP ${res.status}`);
        setMode('setup');
        return;
      }

      const data = (() => { try { return JSON.parse(res.body); } catch { return null; } })();
      Alert.alert('Uploaded!', `Session: ${data?.session_id ?? '—'}\nKey: ${data?.s3_key ?? '—'}`);
      setMode('setup');
    } catch (e: any) {
      setUploading(false);
      Alert.alert('Upload exception', e?.message || String(e));
      setMode('setup');
    }
  }, [
    API_BASE,
    getValidAccessToken,
    user?.email,
    organization,
    leaderboardOptIn,
    selectedLeaderboardTag,
  ]);







  const abortAll = useCallback(async () => {
    // Abort preview countdown if active
    if (mode === 'preview' && countdown !== null) {
      if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
      setCountdown(null);
      setMode('setup');
      return;
    }
    // Abort active capture recording
    if (mode === 'capture' && recording) {
      abortedRef.current = true;
      try { await camRef.current?.stopRecording(); } catch {}
    } else if (mode === 'capture') {
      setMode('setup');
    }
  }, [mode, countdown, recording]);

  // Get first topic *title* from the leaderboard's topics JSON via presigned URL
  const fetchFirstTopicFromLeaderboard = useCallback(async (tag: string): Promise<string | null> => {
    try {
      const presign = await fetchWithAuth(`${API_BASE}/mobile/leaderboards/${encodeURIComponent(tag)}/topics-url`);
      if (!presign.ok) return null;
      const j = await presign.json();
      if (!j?.url) return null;

      const blobRes = await fetch(j.url);
      if (!blobRes.ok) return null;
      const topicsJson = await blobRes.json();
      const first = topicsJson?.topics?.[0];
      if (!first || !first.title) return null; // title only, per spec
      return first.title as string;
    } catch {
      return null;
    }
  }, [API_BASE, fetchWithAuth]);

  // Start the actual camera recording (no countdown here; preview handled it)
  const startCaptureFlow = React.useCallback(async () => {
    abortedRef.current = false;

    setRecording(true);
    try {
      const vid = await camRef.current?.recordAsync({ maxDuration: 60 });
      setRecording(false);

      if (abortedRef.current) {
        if (vid?.uri) { try { await FileSystem.deleteAsync(vid.uri, { idempotent: true }); } catch {} }
        setMode('setup');
        return;
      }

      if (!vid?.uri) { Alert.alert('No video captured'); setMode('setup'); return; }

      await doUpload(vid.uri); // <- now the up-to-date doUpload
    } catch (e: any) {
      setRecording(false);
      Alert.alert('Recording error', e?.message || String(e));
      setMode('setup');
    }
  }, [doUpload]);


  // derived UI state
  const granted = perm.cam === 'granted' && perm.mic === 'granted';
  const undetermined = perm.cam === 'undetermined' || perm.mic === 'undetermined';
  const locked = countdown !== null || recording || uploading;

  // Setup mode
  if (mode === 'setup') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <HeaderBar
          title="Record"
          onPressNotifications={() => Alert.alert('Notifications', 'Coming soon')}
          onPressStatus={() => Alert.alert('Recorder', 'Recorder status')}
          dark
        />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <RecorderSetupPanel
            organization={organization}
            setOrganization={setOrganization}
            leaderboardOptIn={leaderboardOptIn}
            setLeaderboardOptIn={(v) => {
              setLeaderboardOptIn(v);
              if (!v) setSelectedLeaderboardTag(null);
              else if (v && !selectedLeaderboardTag && followedBoards.length) {
                setSelectedLeaderboardTag(followedBoards[0].tag);
              }
            }}
            granted={granted}
            undetermined={undetermined}
            onRequestPerms={() => {
              if (undetermined) requestBoth(); else Linking.openSettings();
            }}

            followedBoards={followedBoards}
            selectedLeaderboardTag={selectedLeaderboardTag}
            setSelectedLeaderboardTag={setSelectedLeaderboardTag}

            onReady={async () => {
              if (!authReady || !isAuthenticated) {
                Alert.alert('Please sign in', 'You must be logged in to record.');
                return;
              }
              if (prepping) return;

              // If opted-in, require a selection and fetch the topic title
              if (leaderboardOptIn) {
                if (!selectedLeaderboardTag) {
                  Alert.alert('Select a leaderboard', 'Pick a leaderboard to get your topic.');
                  return;
                }
                try {
                  setPrepping(true);
                  const t = await fetchFirstTopicFromLeaderboard(selectedLeaderboardTag);
                  if (!t) {
                    Alert.alert('No topics available', 'This leaderboard has no topics configured yet.');
                    return;
                  }
                  setAssignedTopic(t);
                  setTopic(t); // <- title only
                } finally {
                  setPrepping(false);
                }
              } else {
                setTopic('');
                setAssignedTopic('');
              }

              // Ensure permissions BEFORE countdown
              const ok = await requestBoth();
              if (!ok) return;

              // Go to preview panel + start countdown
              setMode('preview');
              setCountdown(10);
              if (countdownTimer.current) clearInterval(countdownTimer.current);
              countdownTimer.current = setInterval(() => {
                setCountdown((prev) => (prev && prev > 1 ? prev - 1 : null));
              }, 1000);

              // After 10s, switch to capture and record
              setTimeout(() => {
                if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
                setCountdown(null);
                setMode('capture');
                // small delay to let CameraView mount before record
                setTimeout(() => startCaptureFlow(), 150);
              }, 10_000);
            }}
            readyDisabled={!authReady || !isAuthenticated || prepping}
          />
        </ScrollView>
      </View>
    );
  }

  // Preview mode (topic + countdown; no camera yet)
  if (mode === 'preview') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <TopicCountdownPanel topic={assignedTopic || 'Free topic'} countdown={countdown} onAbort={abortAll} />
      </View>
    );
  }


  // Capture mode (header/footer hidden via UIChromeContext)
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }}>
      <CameraView ref={camRef} style={{ flex: 1 }} facing={CAMERA.FRONT} mode="video" />
      <RecordingOverlay
        countdown={null}         // countdown happens in preview screen now
        recording={recording}
        uploading={uploading}
        onAbort={abortAll}
      />
      {!locked && (
        <View style={styles.bottomBar}>
          <Button title="Back to Setup" onPress={() => setMode('setup')} color={COLORS.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: { position: 'absolute', bottom: 30, alignSelf: 'center' },
});
