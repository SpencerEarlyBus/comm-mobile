import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Button, Alert, Linking, AppState, InteractionManager, Platform,
  ScrollView, StyleSheet, Modal, Text, TouchableOpacity, Pressable
} from 'react-native';
import {
  useFocusEffect, useNavigation, useRoute, CommonActions, RouteProp
} from '@react-navigation/native';
import { CameraView, Camera, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import type { UploadTask, FileSystemUploadOptions } from 'expo-file-system';
import { CAMERA } from '../native/camera';
import { useKeepAwake } from 'expo-keep-awake';
import { useAuth } from '../context/MobileAuthContext';
import HeaderBar from '../components/HeaderBar';
import { useUIChrome } from '../context/UIChromeContext';
import RecorderSetupPanel from '../components/RecorderSetupPanel';
import CameraSetupPanel from '../components/CameraSetupUser';
import RecordingOverlay from '../components/RecordingOverlay';
import TopicCountdownPanel from '../components/TopicCountdownPanel';
import { COLORS } from '../theme/colors';
import { COLORS as C } from '../theme/colors';
import type { RootStackParamList } from '../navigation/navRef';


import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLeftDrawer } from '../features/leftDrawer';
import { makeDrawerStyles } from '../features/drawerStyles';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import LeftDrawerPlaceholder from '../components/LeftDrawerMainAdditionalNav';


const HEADER_ROW_H = 56;
const DRAWER_WIDTH = 280;


type Status = 'granted' | 'denied' | 'undetermined' | 'restricted' | 'unknown';

type FollowedBoard = {
  id: string;
  tag: string;
  name: string;
  description?: string | null;
  diffLevel?: string | null;
  example_topic?: string | null;
};

const CAPTURE_CUTOFF_MS = 60_000;
const PREVIEW_SECONDS   = 10;

// ---------- logging helper ----------
const L = (...args: any[]) => console.log('[Recorder]', ...args);

export default function RecorderScreen() {
  useKeepAwake();
  L('FUNCTION-INVOKE');

  const camRef = useRef<CameraView | null>(null);
  const { setHidden } = useUIChrome();

  const [mode, setMode] = useState<'setup' | 'preview' | 'capture' | 'calibrate'>('setup');
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = React.useState(false);

  const [cameraKey, setCameraKey] = useState(0);

  // timers / guards
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewKickoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cutoffWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cutoffTickRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadStartedRef  = useRef(false);
  const progressEmitRef   = useRef(0);

  const settledCaptureRef = useRef(false);
  const postStopResolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postStopNudgeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPostStopTimers = () => {
    if (postStopResolveTimerRef.current) { clearTimeout(postStopResolveTimerRef.current); postStopResolveTimerRef.current = null; }
    if (postStopNudgeRef.current) { clearTimeout(postStopNudgeRef.current); postStopNudgeRef.current = null; }
  };


  //hamburger stuff 
  const insets = useSafeAreaInsets();
  const headerHeight = (insets.top || 0) + HEADER_ROW_H;

  const {
    drawerOpen, openDrawer, closeDrawer,
    edgeSwipe, drawerDrag, drawerStyle, overlayStyle
  } = useLeftDrawer({ headerHeight, drawerWidth: DRAWER_WIDTH });

  const drawerStyles = makeDrawerStyles({
    headerHeight,
    drawerWidth: DRAWER_WIDTH,
    bgColor: C.bg,
    borderColor: C.border,
  });



  // unique ids for timers (so logs can correlate)
  const idSeq = useRef(1);
  const tickIdRef = useRef<number | null>(null);
  const watchdogIdRef = useRef<number | null>(null);
  const previewKickIdRef = useRef<number | null>(null);
  const countdownIdRef = useRef<number | null>(null);

  // *** HARD REMOUNT HOOKS ***
  const route = useRoute<RouteProp<RootStackParamList, 'Recorder'>>();
  const remountKey = route.params?.nonce ?? 0;
  L('ROUTE', { nonce: remountKey, params: route.params });

  const clearCutoffTimers = () => {
    if (cutoffWatchdogRef.current) {
      L('TIMER-CLEAR watchdog', { watchdogId: watchdogIdRef.current });
      clearTimeout(cutoffWatchdogRef.current);
      cutoffWatchdogRef.current = null;
      watchdogIdRef.current = null;
    }
    if (cutoffTickRef.current) {
      L('TIMER-CLEAR tick', { tickId: tickIdRef.current });
      clearInterval(cutoffTickRef.current);
      cutoffTickRef.current = null;
      tickIdRef.current = null;
    }
  };

  const forceStopRecording = (why: string) => {
    L('STOP-RECORDING requested', { why });
    try {
      // @ts-ignore
      camRef.current?.stopRecording?.();
      L('STOP-RECORDING called successfully');

      // If the capture hasn't settled yet, schedule a "nudge" and a watchdog.
      if (!settledCaptureRef.current) {
        postStopNudgeRef.current = setTimeout(() => {
          try { camRef.current?.stopRecording?.(); L('STOP-RECORDING nudge'); } catch {}
        }, 800);

        postStopResolveTimerRef.current = setTimeout(() => {
          if (!settledCaptureRef.current) {
            L('POST-STOP watchdog fired -> hardRemount');
            Alert.alert('Recording did not finalize', 'We could not finalize that clip. Please try again.', [
              { text: 'OK', onPress: hardRemountScreen },
            ]);
          }
        }, 4000);
      }
    } catch (e) {
      L('STOP-RECORDING threw', e);
    }
  };


  const navigation = useNavigation<any>();
  const abortedRef = useRef(false);

  const { user, authReady, isAuthenticated, getValidAccessToken, fetchWithAuth } = useAuth() as any;

  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [perm, setPerm] = useState<{ cam: Status; mic: Status }>({ cam: 'unknown', mic: 'unknown' });

  const [topic, setTopic] = useState<string>('');
  const [assignedTopic, setAssignedTopic] = useState<string>('');
  const assignedTopicRef = useRef<string>('');
  useEffect(() => { assignedTopicRef.current = assignedTopic; }, [assignedTopic]);

  const [organization, setOrganization] = useState('');
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(true);

  const [followedBoards, setFollowedBoards] = useState<FollowedBoard[]>([]);
  const [selectedLeaderboardTag, setSelectedLeaderboardTag] = useState<string | null>(null);
  const [prepping, setPrepping] = useState(false);

  const [uploadPct, setUploadPct] = useState(0);
  const uploadTaskRef = useRef<UploadTask | null>(null);

  // soft reset
  const resetForNextRecording = useCallback(() => {
    L('RESET-SOFT begin', {
      countdownTimer: !!countdownTimer.current,
      previewKickoffTimer: !!previewKickoffTimer.current,
      tick: !!cutoffTickRef.current,
      watchdog: !!cutoffWatchdogRef.current,
      recording, uploading, mode,
    });

    if (countdownTimer.current) {
      L('TIMER-CLEAR countdown', { countdownId: countdownIdRef.current });
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
      countdownIdRef.current = null;
    }
    if (previewKickoffTimer.current) {
      L('TIMER-CLEAR previewKick', { previewKickId: previewKickIdRef.current });
      clearTimeout(previewKickoffTimer.current);
      previewKickoffTimer.current = null;
      previewKickIdRef.current = null;
    }
    clearCutoffTimers();

    setCountdown(null);
    setRecording(false);
    setUploading(false);
    clearCutoffTimers();
    clearPostStopTimers();
    uploadStartedRef.current = false;
    modeRef.current = 'setup';
    setCameraKey(k => {
      const next = k + 1;
      L('CAMERA-REMOUNT (soft) cameraKey++', { from: k, to: next });
      return next;
    });
    setMode('setup');
    L('RESET-SOFT end');
  }, [mode, recording, uploading]);

  const abortAll = useCallback(() => {
    L('ABORT begin');
    abortedRef.current = true;
    try { camRef.current?.stopRecording?.(); } catch {}
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancelAsync().catch((e) => L('ABORT upload cancel error', e));
    }
    setUploading(false);
    setUploadPct(0);
    clearPostStopTimers();
    resetForNextRecording();
    L('ABORT end');
  }, [resetForNextRecording]);

  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; L('MODE ->', mode); }, [mode]);

  const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

  useEffect(() => {
    const hide = mode !== 'setup';
    setHidden(hide);
    L('UI-CHROME', { hidden: hide });
    return () => setHidden(false);
  }, [mode, recording, uploading, countdown, setHidden]);

  const refreshPerms = useCallback(async () => {
    const cam = await Camera.getCameraPermissionsAsync();
    const mic = await Camera.getMicrophonePermissionsAsync();
    setPerm({
      cam: (cam?.status as Status) ?? 'unknown',
      mic: (mic?.status as Status) ?? 'unknown',
    });
    L('PERMS-REFRESH', { cam: cam?.status, mic: mic?.status });
  }, []);

  useFocusEffect(useCallback(() => { L('FOCUS'); refreshPerms(); }, [refreshPerms]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') { L('APPSTATE active -> refreshPerms'); refreshPerms(); }
    });
    return () => sub.remove();
  }, [refreshPerms]);

  useEffect(() => {
    L('MOUNT', { remountKey, cameraKey, platform: Platform.OS, ver: Platform.Version });
    return () => {
      L('UNMOUNT start');
      if (countdownTimer.current) { clearInterval(countdownTimer.current); }
      clearCutoffTimers();
      clearPostStopTimers();
      setHidden(false);
      abortedRef.current = true;
      try { camRef.current?.stopRecording?.(); } catch {}
      if (uploadTaskRef.current) uploadTaskRef.current.cancelAsync().catch(() => {});
      L('UNMOUNT end');
    };
  }, [setHidden]);

  const loadFollowed = useCallback(async () => {
    if (!isAuthenticated) {
      L('FOLLOWED skip (not authed)');
      setFollowedBoards([]);
      setSelectedLeaderboardTag(null);
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}/mobile/leaderboards/follows`);
      L('FOLLOWED fetch status', res.status);
      if (!res.ok) return;
      const data = await res.json();
      const items = (data?.items || []) as FollowedBoard[];
      setFollowedBoards(items);
      if (leaderboardOptIn && !selectedLeaderboardTag && items.length) {
        setSelectedLeaderboardTag(items[0].tag);
      }
    } catch (e) {
      L('FOLLOWED error', e);
    }
  }, [API_BASE, fetchWithAuth, isAuthenticated, leaderboardOptIn, selectedLeaderboardTag]);
  useEffect(() => { loadFollowed(); }, [loadFollowed]);

  const requestBoth = async () => {
    L('PERMS-REQUEST begin');
    const c = perm.cam === 'granted' ? camPerm : await requestCam();
    const m = perm.mic === 'granted' ? micPerm : await requestMic();
    const camOK = (c?.status ?? perm.cam) === 'granted';
    const micOK = (m?.status ?? perm.mic) === 'granted';
    await refreshPerms();
    L('PERMS-REQUEST end', { camOK, micOK });
    if (!camOK || !micOK) {
      Alert.alert(
        'Permissions needed',
        'Please enable Camera and Microphone in Settings.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
      );
      return false;
    }
    return true;
  };

  // ******** HARD REMOUNT ********
  const hardRemountScreen = useCallback(() => {
    L('HARD-REMOUNT dispatching');
    try { camRef.current?.stopRecording?.(); } catch {}
    clearCutoffTimers();
    if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
    if (previewKickoffTimer.current) { clearTimeout(previewKickoffTimer.current); previewKickoffTimer.current = null; }
    setShowUpload(false);

    const nonce = Date.now();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Recorder', params: { nonce } }],
      })
    );
  }, [navigation]);

  const doUpload = useCallback(async (uri: string) => {
    if (abortedRef.current) { L('UPLOAD abortedRef true -> bail'); return; }

    setUploading(true);
    setUploadPct(0);
    L('UPLOAD begin', { uri });

    try {
      const nowTopic = String(assignedTopicRef.current || '');
      const nowTag = leaderboardOptIn ? (selectedLeaderboardTag ?? '') : '';

      const metadataText = [
        `email: ${user?.email ?? ''}`,
        `datetime_iso: ${new Date().toISOString()}`,
        `topic: ${nowTopic}`,
        `organization: ${organization}`,
        `leaderboard_opt_in: ${leaderboardOptIn ? 'true' : 'false'}`,
        `leaderboard_tag: ${nowTag}`,
        `platform: ${Platform.OS} ${Platform.Version}`,
        `app: comm-mobile`,
      ].join('\n');

      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      L('UPLOAD presign POST');

      const ext = uri.toLowerCase().endsWith('.mp4') ? 'mp4' : 'mov';
      const createRes = await fetch(`${API_BASE}/media/mobile_create_session?ext=${ext}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      L('UPLOAD presign status', createRes.status);
      if (!createRes.ok) {
        const txt = await createRes.text().catch(() => '');
        throw new Error(`create_session ${createRes.status}: ${txt || 'failed'}`);
      }
      const { session_id, video_post, metadata_put_url } = await createRes.json();
      L('UPLOAD presign ok', { session_id });

      if (abortedRef.current) { setUploading(false); L('UPLOAD aborted after presign'); return; }

      L('UPLOAD metadata PUT');
      const metaRes = await fetch(metadata_put_url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-amz-server-side-encryption': 'AES256',
        },
        body: metadataText,
      });
      L('UPLOAD metadata status', metaRes.status);
      if (!metaRes.ok) {
        const txt = await metaRes.text().catch(() => '');
        throw new Error(`metadata PUT ${metaRes.status}: ${txt || 'failed'}`);
      }

      if (abortedRef.current) { setUploading(false); L('UPLOAD aborted after metadata'); return; }

      let localSize: number | undefined;
      try {
        const info = await FileSystem.getInfoAsync(uri);
        // @ts-ignore
        if (info?.exists && typeof (info as any).size === 'number') {
          localSize = (info as any).size as number;
        }
      } catch {}
      L('UPLOAD local file info', { localSize });

      const onProgress = (p: { totalBytesSent: number; totalBytesExpectedToSend: number }) => {
        const expected = p.totalBytesExpectedToSend > 0 ? p.totalBytesExpectedToSend : (localSize ?? -1);
        const pct = expected > 0 ? p.totalBytesSent / expected : 0;
        const now = Date.now();
        if (now - progressEmitRef.current > 1000) { // 1s for less spam
          progressEmitRef.current = now;
          L('UPLOAD progress', { sent: p.totalBytesSent, expected, pct: +(pct * 100).toFixed(1) });
          setUploadPct(pct);
        }
      };

      const options: FileSystemUploadOptions = {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        parameters: video_post.fields as Record<string, string>,
      };

      setUploadPct(0);
      progressEmitRef.current = 0;
      setShowUpload(true);
      L('UPLOAD start S3 POST');

      const task = FileSystem.createUploadTask(video_post.url, uri, options, onProgress);
      uploadTaskRef.current = task;

      const res = await task.uploadAsync();
      uploadTaskRef.current = null;
      L('UPLOAD finished S3 POST', { status: res?.status });

      if (!res || res.status < 200 || res.status >= 300) {
        throw new Error(`S3 POST ${res?.status}: ${res?.body?.slice(0, 200) || ''}`);
      }

      try { await FileSystem.deleteAsync(uri, { idempotent: true }); L('UPLOAD local file deleted'); } catch (e) { L('UPLOAD local delete error', e); }

      setShowUpload(false);
      setUploading(false);
      setUploadPct(1);

      InteractionManager.runAfterInteractions(() => {
        L('UPLOAD success -> alert');
        Alert.alert(
          'Uploaded!',
          `Session: ${session_id}\nProcessing will start shortly.`,
          [{ text: 'OK', onPress: hardRemountScreen }]
        );
      });
    } catch (e: any) {
      uploadTaskRef.current = null;
      setShowUpload(false);
      setUploading(false);
      setUploadPct(0);
      if (abortedRef.current) { L('UPLOAD catch but abortedRef true'); return; }
      L('UPLOAD exception', e?.message || String(e));
      Alert.alert('Upload exception', e?.message || String(e), [{ text: 'OK', onPress: hardRemountScreen }]);
    }
  }, [
    API_BASE,
    getValidAccessToken,
    user?.email,
    organization,
    leaderboardOptIn,
    selectedLeaderboardTag,
    hardRemountScreen,
  ]);

  const fetchFirstTopicFromLeaderboard = useCallback(async (tag: string): Promise<string | null> => {
    L('TOPIC presign begin', { tag });
    try {
      const presign = await fetchWithAuth(`${API_BASE}/mobile/leaderboards/${encodeURIComponent(tag)}/topics-url`);
      L('TOPIC presign status', presign.status);
      if (!presign.ok) return null;
      const j = await presign.json();
      if (!j?.url) return null;
      const blobRes = await fetch(j.url);
      L('TOPIC blob status', blobRes.status);
      if (!blobRes.ok) return null;
      const topicsJson = await blobRes.json();
      const first = topicsJson?.topics?.[0];
      return (first && first.title) ? (first.title as string) : null;
    } catch (e) {
      L('TOPIC error', e);
      return null;
    }
  }, [API_BASE, fetchWithAuth]);

  const startCaptureFlow = useCallback(async () => {
    L('CAPTURE start');
    clearCutoffTimers();
    clearPostStopTimers();
    abortedRef.current = false;
    uploadStartedRef.current = false;
    settledCaptureRef.current = false;
    setRecording(true);

    const cam = camRef.current as any;
    L('CAM-METHODS', {
      hasRecordAsync: typeof cam?.recordAsync,
      hasStopRecording: typeof cam?.stopRecording,
      hasResumePreview: typeof cam?.resumePreview,
    });

    // If available, resume the preview to avoid paused-state weirdness
    try { await cam?.resumePreview?.(); } catch {}

    // tiny settle delay sometimes helps iOS
    await new Promise(r => setTimeout(r, 120));

    const startTs = Date.now();

    // tick
    {
      const id = idSeq.current++;
      tickIdRef.current = id;
      cutoffTickRef.current = setInterval(() => {
        if (abortedRef.current) return;
        const elapsed = Date.now() - startTs;
        if (elapsed >= CAPTURE_CUTOFF_MS - 200) {
          L('TICK threshold reached -> forceStop', { id, elapsed });
          clearCutoffTimers();
          forceStopRecording('tick-threshold');
        }
      }, 250);
      L('TIMER-SET tick', { id });
    }

    // watchdog
    {
      const id = idSeq.current++;
      watchdogIdRef.current = id;
      cutoffWatchdogRef.current = setTimeout(() => {
        if (!abortedRef.current) {
          L('WATCHDOG fired -> forceStop', { id });
          forceStopRecording('watchdog');
        }
      }, CAPTURE_CUTOFF_MS + 750);
      L('TIMER-SET watchdog', { id });
    }

    try {
      L('RECORD-ASYNC call', { maxDuration: Math.ceil(CAPTURE_CUTOFF_MS / 1000) });
      const p: Promise<{ uri?: string }> = cam?.recordAsync?.({
        maxDuration: Math.ceil(CAPTURE_CUTOFF_MS / 1000),
      });

      let vid: { uri?: string } | undefined;
      try {
        vid = await p;
      } finally {
        // regardless of resolve/reject, mark settled and clear post-stop timers
        settledCaptureRef.current = true;
        clearPostStopTimers();
      }

      L('RECORD-ASYNC resolved', { uri: !!vid?.uri });

      clearCutoffTimers();
      setRecording(false);

      if (abortedRef.current) {
        L('CAPTURE resolved but aborted -> delete temp');
        if (vid?.uri) { try { await FileSystem.deleteAsync(vid.uri, { idempotent: true }); } catch (e) { L('DELETE temp error', e); } }
        setMode('setup');
        return;
      }

      if (!vid?.uri) {
        L('CAPTURE no uri');
        Alert.alert('No video captured');
        setMode('setup');
        return;
      }

      if (!uploadStartedRef.current) {
        uploadStartedRef.current = true;
        L('UPLOAD handoff -> doUpload()');
        await doUpload(vid.uri);
      }
    } catch (e: any) {
      L('RECORD-ASYNC exception', e?.message || String(e));
      settledCaptureRef.current = true; // prevent post-stop watchdog
      clearPostStopTimers();
      clearCutoffTimers();
      setRecording(false);
      if (abortedRef.current) return;
      Alert.alert('Recording error', e?.message || String(e), [{ text: 'OK', onPress: hardRemountScreen }]);
    }
  }, [doUpload, hardRemountScreen]);


  function UploadProgressModal({
    visible,
    pct,
    onCancel,
  }: { visible: boolean; pct: number; onCancel: () => void }) {
    const percent = Math.max(0, Math.min(100, Math.round(pct * 100)));
    return (
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onCancel}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#111', borderRadius: 14, padding: 20 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', marginBottom: 10 }}>
              Uploading your session…
            </Text>
            <View style={{ height: 10, backgroundColor: '#2a2a2a', borderRadius: 5, overflow: 'hidden' }}>
              <View style={{ height: 10, width: `${percent}%`, backgroundColor: '#6aa7ff' }} />
            </View>
            <Text style={{ color: '#bbb', marginTop: 8 }}>{percent}%</Text>
            <TouchableOpacity onPress={onCancel} style={{ marginTop: 14, alignSelf: 'flex-end' }}>
              <Text style={{ color: '#ff8888' }}>Cancel upload</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const granted = perm.cam === 'granted' && perm.mic === 'granted';
  const undetermined = perm.cam === 'undetermined' || perm.mic === 'undetermined';
  const locked = countdown !== null || recording || uploading;

  // Log key state changes to help spot stale bits
  useEffect(() => { L('STATE', { recording, uploading, countdown, mode, cameraKey, remountKey }); },
    [recording, uploading, countdown, mode, cameraKey, remountKey]);

  let content: React.ReactElement | null = null;

  if (mode === 'setup') {
    content = (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <HeaderBar
          title="Record"
          onPressMenu={openDrawer}  
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
              L('READY pressed');
              if (!authReady || !isAuthenticated) { Alert.alert('Please sign in', 'You must be logged in to record.'); return; }
              if (prepping) return;

              if (leaderboardOptIn) {
                if (!selectedLeaderboardTag) { Alert.alert('Select a leaderboard', 'Pick a leaderboard to get your topic.'); return; }
                try {
                  setPrepping(true);
                  const t = await fetchFirstTopicFromLeaderboard(selectedLeaderboardTag);
                  if (!t) { Alert.alert('No topics available', 'This leaderboard has no topics configured yet.'); return; }
                  setAssignedTopic(t);
                  setTopic(t);
                  L('TOPIC set', t);
                } finally { setPrepping(false); }
              } else {
                setTopic('');
                setAssignedTopic('');
              }

              const ok = await requestBoth();
              if (!ok) return;

              setMode('preview');
              setCountdown(PREVIEW_SECONDS);

              if (countdownTimer.current) clearInterval(countdownTimer.current);
              {
                const id = idSeq.current++;
                countdownIdRef.current = id;
                countdownTimer.current = setInterval(() => {
                  setCountdown((prev) => (prev && prev > 1 ? prev - 1 : null));
                }, 1000);
                L('TIMER-SET countdown', { id });
              }

              if (previewKickoffTimer.current) clearTimeout(previewKickoffTimer.current);
              {
                const id = idSeq.current++;
                previewKickIdRef.current = id;
                previewKickoffTimer.current = setTimeout(() => {
                  if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
                  setCountdown(null);

                  // NEW: bump to force a fresh CameraView instance each capture
                  setCameraKey(k => k + 1);

                  setMode('capture');
                  // small delay to let CameraView mount fully
                  setTimeout(() => startCaptureFlow(), 150);
                }, PREVIEW_SECONDS * 1000);
                L('TIMER-SET previewKick', { id });
              }
            }}
            readyDisabled={!authReady || !isAuthenticated || prepping}
          />
        </ScrollView>
      </View>





    );
  } else if (mode === 'preview') {
    content = (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <TopicCountdownPanel topic={assignedTopic || 'Free topic'} countdown={countdown} onAbort={abortAll} />
      </View>
    );
  } else if (mode === 'calibrate') {
    content = (
      <View style={{ flex: 1, backgroundColor: COLORS.black }}>
        <CameraSetupPanel onDone={() => setMode('setup')} onCancel={() => setMode('setup')} />
      </View>
    );
  } else {
    content = (
      <View style={{ flex: 1, backgroundColor: COLORS.black }}>
        <CameraView
          key={`${remountKey}-${cameraKey}`}  // strengthen remount identity
          ref={camRef}
          style={{ flex: 1 }}
          facing={CAMERA.FRONT}
          mode="video"
          // @ts-ignore — if available, this helps confirm readiness
          onCameraReady={() => L('CAMERA ready')}
        />
        <RecordingOverlay countdown={null} recording={recording} uploading={false} onAbort={abortAll} />
        {!locked && (
          <View style={styles.bottomBar}>
            <Button title="Back to Setup" onPress={() => setMode('setup')} color={COLORS.accent} />
          </View>
        )}
      </View>
    );
  }




  
  return (
    <View key={remountKey} style={{ flex: 1 }}>
      {mode === 'setup' ? (
        <>
          {/* Edge-swipe to open drawer */}
          <GestureDetector gesture={edgeSwipe}>
            <View style={{ flex: 1 }}>
              {content /* your setup branch with HeaderBar + ScrollView */}
            </View>
          </GestureDetector>

          {/* Overlay + Drawer on top */}
          {drawerOpen && (
            <Pressable
              onPress={closeDrawer}
              style={StyleSheet.absoluteFill}
              pointerEvents="auto"
            >
              <Animated.View style={[drawerStyles.overlay, overlayStyle]} />
            </Pressable>
          )}

          <GestureDetector gesture={drawerDrag}>
            <Animated.View style={[drawerStyles.drawer, drawerStyle]}>
              <LeftDrawerPlaceholder onClose={closeDrawer} />
            </Animated.View>
          </GestureDetector>
        </>
      ) : (
        // non-setup modes (preview/calibrate/capture) render as-is, no drawer
        content
      )}

      {/* Upload modal unchanged */}
      <UploadProgressModal visible={showUpload} pct={uploadPct} onCancel={abortAll} />
    </View>
  );

}

const styles = StyleSheet.create({
  bottomBar: { position: 'absolute', bottom: 30, alignSelf: 'center' },
});
