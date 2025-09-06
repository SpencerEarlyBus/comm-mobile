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
import CameraSetupPanel from '../components/CameraSetupUser';
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

/** ================== CONFIG (change here) ================== */
const CAPTURE_CUTOFF_MS = 60_000;     // 1 minute hard stop for video
const PREVIEW_SECONDS   = 10;         // countdown seconds before recording
/** ========================================================== */

export default function RecorderScreen() {
  const camRef = useRef<CameraView | null>(null);
  const { setHidden } = useUIChrome();

  const [mode, setMode] = useState<'setup' | 'preview' | 'capture' | 'calibrate'>('setup');
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const [cameraKey, setCameraKey] = useState(0);

  // timers / guards
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewKickoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cutoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cutoffWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cutoffTickRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadStartedRef  = useRef(false);

  const clearCutoffTimers = () => {
    if (cutoffWatchdogRef.current) { clearTimeout(cutoffWatchdogRef.current); cutoffWatchdogRef.current = null; }
    if (cutoffTickRef.current)     { clearInterval(cutoffTickRef.current);     cutoffTickRef.current = null; }
  };

  const forceStopRecording = () => {
    try { camRef.current?.stopRecording?.(); } catch {}
  };



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


  // 1) Full reset helper (centralized)
  const resetForNextRecording = useCallback(() => {
    // stop ALL timers
    if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
    if (previewKickoffTimer.current) { clearTimeout(previewKickoffTimer.current); previewKickoffTimer.current = null; }
    clearCutoffTimers(); // your tick + watchdog clear

    // UI state
    setCountdown(null);
    setRecording(false);
    setUploading(false);

    // guards for next run
    uploadStartedRef.current = false;

    // keep modeRef in sync (optional, but nice if you still read it anywhere)
    modeRef.current = 'setup';

    // remount camera to clear native recorder state
    setCameraKey(k => k + 1);

    // back to setup
    setMode('setup');
  }, []);
    // 2) Abort — mark aborted, stop recording now, then fully reset
  const abortAll = useCallback(() => {
    abortedRef.current = true;                 // make in-flight paths bail
    try { camRef.current?.stopRecording?.(); } catch {}
    resetForNextRecording();
  }, [resetForNextRecording]);


  // (kept for clarity, no longer used as an upload guard)
  const modeRef = React.useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

  // Hide chrome while in preview (countdown screen) or capture.
  useEffect(() => {
    const hide = mode !== 'setup';
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
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      clearCutoffTimers();
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

  useEffect(() => { loadFollowed(); }, [loadFollowed]);

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

  const safeJson = (s?: string) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

  const doUpload = React.useCallback(async (uri: string) => {
    if (abortedRef.current) return;      // only abort guard; don't rely on mode
    setUploading(true);
    try {
      const nowTopic = String(assignedTopicRef.current || '');
      const nowTag = leaderboardOptIn ? (selectedLeaderboardTag ?? '') : '';
      const filename = uri.split('/').pop() || `mobile_frontFacing_${Date.now()}.mp4`;
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');

      if (abortedRef.current) { setUploading(false); return; }

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
          metadata: metadataText,
          topic: nowTopic,
          topic_title: nowTopic,
          leaderboard_tag: nowTag,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      setUploading(false);
      if (abortedRef.current) return;

      if (res.status < 200 || res.status >= 300) {
        // error
        Alert.alert('Upload failed', res.body || `HTTP ${res.status}`);
        resetForNextRecording();
        return;
      }

      const data = (() => { try { return JSON.parse(res.body); } catch { return null; } })();
      // success
      Alert.alert('Uploaded!', `Session: ${data?.session_id ?? '—'}\nKey: ${data?.s3_key ?? '—'}`);
      resetForNextRecording();
    } catch (e: any) {
      setUploading(false);
      if (abortedRef.current) return;
      Alert.alert('Upload exception', e?.message || String(e));
      resetForNextRecording();
    }
  }, [
    API_BASE,
    getValidAccessToken,
    user?.email,
    organization,
    leaderboardOptIn,
    selectedLeaderboardTag,
  ]);




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
    clearCutoffTimers();
    abortedRef.current = false;
    uploadStartedRef.current = false;
    setRecording(true);

    // --- robust cutoff: tick + watchdog ---
    const startTs = Date.now();

    // 250ms tick: stop exactly at/just before cutoff even if long timers drift
    cutoffTickRef.current = setInterval(() => {
      if (abortedRef.current) return;
      const elapsed = Date.now() - startTs;
      if (elapsed >= CAPTURE_CUTOFF_MS - 200) {
        clearCutoffTimers();
        forceStopRecording();
      }
    }, 250);

    // One-shot watchdog with a tiny grace (for container write/flush jitter)
    cutoffWatchdogRef.current = setTimeout(() => {
      if (!abortedRef.current) forceStopRecording();
    }, CAPTURE_CUTOFF_MS + 750);

    try {
      // `maxDuration` is kept as a hint (helps on iOS); manual timers enforce reality
      const vid = await camRef.current?.recordAsync({
        maxDuration: Math.ceil(CAPTURE_CUTOFF_MS / 1000),
      });

      clearCutoffTimers();
      setRecording(false);

      if (abortedRef.current) {
        if (vid?.uri) { try { await FileSystem.deleteAsync(vid.uri, { idempotent: true }); } catch {} }
        setMode('setup');
        return;
      }

      if (!vid?.uri) {
        Alert.alert('No video captured');
        setMode('setup');
        return;
      }

      if (!uploadStartedRef.current) {
        uploadStartedRef.current = true;
        await doUpload(vid.uri);
      }
    } catch (e: any) {
      clearCutoffTimers();
      setRecording(false);
      if (abortedRef.current) return;
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
            onRequestPerms={() => { if (undetermined) requestBoth(); else Linking.openSettings(); }}

            followedBoards={followedBoards}
            selectedLeaderboardTag={selectedLeaderboardTag}
            setSelectedLeaderboardTag={setSelectedLeaderboardTag}

            onOpenCameraSetup={() => setMode('calibrate')}

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
                  setTopic(t); // title only
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
              setCountdown(PREVIEW_SECONDS);

              if (countdownTimer.current) clearInterval(countdownTimer.current);
              countdownTimer.current = setInterval(() => {
                setCountdown((prev) => (prev && prev > 1 ? prev - 1 : null));
              }, 1000);

              // After PREVIEW_SECONDS, switch to capture and record
              if (previewKickoffTimer.current) clearTimeout(previewKickoffTimer.current);
              previewKickoffTimer.current = setTimeout(() => {
                if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
                setCountdown(null);
                setMode('capture');
                // small delay to let CameraView mount before record
                setTimeout(() => startCaptureFlow(), 150);
              }, PREVIEW_SECONDS * 1000);
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

  if (mode === 'calibrate') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.black }}>
        <CameraSetupPanel onDone={() => setMode('setup')} onCancel={() => setMode('setup')} />
      </View>
    );
  }

  // Capture mode (header/footer hidden via UIChromeContext)
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }}>
      <CameraView
        key={cameraKey}
        ref={camRef}
        style={{ flex: 1 }}
        facing={CAMERA.FRONT}
        mode="video"
      />

      <RecordingOverlay
        countdown={null}
        recording={recording}
        uploading={uploading}
        onAbort={abortAll}
      />

      {!locked && (
        <View style={styles.bottomBar}>
          <Button
            title="Back to Setup"
            onPress={() => setMode('setup')}
            color={COLORS.accent}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: { position: 'absolute', bottom: 30, alignSelf: 'center' },
});
