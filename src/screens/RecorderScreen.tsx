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
import MetricDial from '../components/MetricDial';
import { COLORS } from '../theme/colors';
import { COLORS as C } from '../theme/colors';
import type { RootStackParamList } from '../navigation/navRef';


import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLeftDrawer } from '../features/leftDrawer';
import { makeDrawerStyles } from '../features/drawerStyles';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import LeftDrawerPlaceholder from '../components/LeftDrawerMainAdditionalNav';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.backend.root';

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



type TopicInfo = {
  title: string;
  prompt: string;
  duration_sec?: number;             // preferred
  suggested_duration_sec?: number;   // fallback
  GradeAcc?: boolean;
  syncInsights?: boolean;
};

const CAPTURE_CUTOFF_MS = 60_000;
const PREVIEW_SECONDS   = 10;

// ---------- logging helper ----------
const L = (...args: any[]) => console.log('[Recorder]', ...args);

export default function RecorderScreen() {
  useKeepAwake();

  const camRef = useRef<CameraView | null>(null);
  const { setHidden } = useUIChrome();

  const [mode, setMode] = useState<'setup' | 'preview' | 'capture' | 'calibrate'>('setup');
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = React.useState(false);

  const [cameraKey, setCameraKey] = useState(0);

  const [setupVisible, setSetupVisible] = useState(false);




  // eligibility stuff for session

  type Eligibility = {
    ok: boolean;
    allowed: boolean;
    cooldown_seconds: number;
    remaining_seconds: number;
    next_eligible_at: string | null;
    last_ingest?: { id: string; status: string; created_at: string | null } | null;
  };

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);




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




  //topic info pulled from s3
  const [captureCutoffMs, setCaptureCutoffMs] = useState<number>(CAPTURE_CUTOFF_MS);
  const gradeAccRef = useRef<boolean>(false);
  const syncInsightsRef = useRef<boolean>(false);


  //timer refs
  const captureCutoffMsRef = useRef<number>(CAPTURE_CUTOFF_MS);
  useEffect(() => { captureCutoffMsRef.current = captureCutoffMs; }, [captureCutoffMs]);

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

  const clearCutoffTimers = () => {
    if (cutoffWatchdogRef.current) {
      clearTimeout(cutoffWatchdogRef.current);
      cutoffWatchdogRef.current = null;
      watchdogIdRef.current = null;
    }
    if (cutoffTickRef.current) {
      clearInterval(cutoffTickRef.current);
      cutoffTickRef.current = null;
      tickIdRef.current = null;
    }
  };

  const forceStopRecording = (why: string) => {
    try {
      // @ts-ignore
      camRef.current?.stopRecording?.();

      // If the capture hasn't settled yet, schedule a "nudge" and a watchdog.
      if (!settledCaptureRef.current) {
        postStopNudgeRef.current = setTimeout(() => {
          try { camRef.current?.stopRecording?.(); L('STOP-RECORDING nudge'); } catch {}
        }, 800);

        postStopResolveTimerRef.current = setTimeout(() => {
          if (!settledCaptureRef.current) {
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

  useFocusEffect(useCallback(() => { L('FOCUS'); refreshPerms(); }, [refreshPerms]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') { L('APPSTATE active -> refreshPerms'); refreshPerms(); }
    });
    return () => sub.remove();
  }, [refreshPerms]);

  useEffect(() => {
    return () => {
      if (countdownTimer.current) { clearInterval(countdownTimer.current); }
      clearCutoffTimers();
      clearPostStopTimers();
      setHidden(false);
      abortedRef.current = true;
      try { camRef.current?.stopRecording?.(); } catch {}
      if (uploadTaskRef.current) uploadTaskRef.current.cancelAsync().catch(() => {});
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
    const c = perm.cam === 'granted' ? camPerm : await requestCam();
    const m = perm.mic === 'granted' ? micPerm : await requestMic();
    const camOK = (c?.status ?? perm.cam) === 'granted';
    const micOK = (m?.status ?? perm.mic) === 'granted';
    await refreshPerms();
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

    try {
      const nowTopic = String(assignedTopicRef.current || '');
      const nowTag = leaderboardOptIn ? (selectedLeaderboardTag ?? '') : '';
      const cutoffMs = captureCutoffMsRef.current;
      const metadataText = [
        `email: ${user?.email ?? ''}`,
        `datetime_iso: ${new Date().toISOString()}`,
        `topic: ${nowTopic}`,
        `organization: ${organization}`,
        `leaderboard_opt_in: ${leaderboardOptIn ? 'true' : 'false'}`,
        `leaderboard_tag: ${nowTag}`,
        `duration_sec: ${Math.round(cutoffMs / 1000)}`,    
        `gradeacc: ${gradeAccRef.current ? 'true' : 'false'}`,     
        `syncinsights: ${syncInsightsRef.current ? 'true' : 'false'}`, 
        `platform: ${Platform.OS} ${Platform.Version}`,
        `app: comm-mobile`,
      ].join('\n');

      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');

      const ext = uri.toLowerCase().endsWith('.mp4') ? 'mp4' : 'mov';
      const createRes = await fetch(`${API_BASE}/media/mobile_create_session?ext=${ext}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!createRes.ok) {
        const txt = await createRes.text().catch(() => '');
        throw new Error(`create_session ${createRes.status}: ${txt || 'failed'}`);
      }
      const { session_id, video_post, metadata_put_url } = await createRes.json();

      if (abortedRef.current) { setUploading(false); L('UPLOAD aborted after presign'); return; }

      const metaRes = await fetch(metadata_put_url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-amz-server-side-encryption': 'AES256',
        },
        body: metadataText,
      });
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

      const onProgress = (p: { totalBytesSent: number; totalBytesExpectedToSend: number }) => {
        const expected = p.totalBytesExpectedToSend > 0 ? p.totalBytesExpectedToSend : (localSize ?? -1);
        const pct = expected > 0 ? p.totalBytesSent / expected : 0;
        const now = Date.now();
        if (now - progressEmitRef.current > 1000) { // 1s for less spam
          progressEmitRef.current = now;
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

      const task = FileSystem.createUploadTask(video_post.url, uri, options, onProgress);
      uploadTaskRef.current = task;

      const res = await task.uploadAsync();
      uploadTaskRef.current = null;

      if (!res || res.status < 200 || res.status >= 300) {
        throw new Error(`S3 POST ${res?.status}: ${res?.body?.slice(0, 200) || ''}`);
      }

      try { await FileSystem.deleteAsync(uri, { idempotent: true }); L('UPLOAD local file deleted'); } catch (e) { L('UPLOAD local delete error', e); }

      setShowUpload(false);
      setUploading(false);
      setUploadPct(1);

      InteractionManager.runAfterInteractions(() => {
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




  const fetchFirstTopicFromLeaderboard = useCallback(async (tag: string): Promise<TopicInfo | null> => {
    try {
      const presign = await fetchWithAuth(`${API_BASE}/mobile/leaderboards/${encodeURIComponent(tag)}/topics-url`);
      if (!presign.ok) return null;

      const j = await presign.json();
      if (!j?.url) return null;

      const blobRes = await fetch(j.url);
      if (!blobRes.ok) return null;

      const topicsJson = await blobRes.json();
      const first = topicsJson?.topics?.[0];
      if (!first) return null;

      // Normalize to TopicInfo shape
      const info: TopicInfo = {
        title: first.title ?? '',
        prompt: first.prompt ?? '',
        duration_sec: (typeof first.duration_sec === 'number' ? first.duration_sec : undefined),
        suggested_duration_sec: (typeof first.suggested_duration_sec === 'number' ? first.suggested_duration_sec : undefined),
        GradeAcc: typeof first.GradeAcc === 'boolean' ? first.GradeAcc : undefined,
        syncInsights: typeof first.syncInsights === 'boolean' ? first.syncInsights : undefined,
      };

      return info.prompt ? info : null;
    } catch (e) {
      L('TOPIC error', e);
      return null;
    }
  }, [API_BASE, fetchWithAuth]);





  const startCaptureFlow = useCallback(async () => {
    clearCutoffTimers();
    clearPostStopTimers();
    abortedRef.current = false;
    uploadStartedRef.current = false;
    settledCaptureRef.current = false;
    setRecording(true);

    const cutoffMs = captureCutoffMsRef.current;

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
        if (elapsed >= cutoffMs - 200) {
          clearCutoffTimers();
          forceStopRecording('tick-threshold');
        }
      }, 250);
    }

    // watchdog
    {
      const id = idSeq.current++;
      watchdogIdRef.current = id;
      cutoffWatchdogRef.current = setTimeout(() => {
        if (!abortedRef.current) {
          forceStopRecording('watchdog');
        }
      }, cutoffMs + 750);
    }

    try {
      const p: Promise<{ uri?: string }> = cam?.recordAsync?.({
        maxDuration: Math.ceil(cutoffMs / 1000),
      });

      let vid: { uri?: string } | undefined;
      try {
        vid = await p;
      } finally {
        // regardless of resolve/reject, mark settled and clear post-stop timers
        settledCaptureRef.current = true;
        clearPostStopTimers();
      }


      clearCutoffTimers();
      setRecording(false);

      if (abortedRef.current) {
        if (vid?.uri) { try { await FileSystem.deleteAsync(vid.uri, { idempotent: true }); } catch (e) { L('DELETE temp error', e); } }
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
      L('RECORD-ASYNC exception', e?.message || String(e));
      settledCaptureRef.current = true; // prevent post-stop watchdog
      clearPostStopTimers();
      clearCutoffTimers();
      setRecording(false);
      if (abortedRef.current) return;
      Alert.alert('Recording error', e?.message || String(e), [{ text: 'OK', onPress: hardRemountScreen }]);
    }
  }, [doUpload, hardRemountScreen]);



  //load eligibilty to upload new session
  const loadEligibility = useCallback(async () => {
    if (!isAuthenticated) {
      setEligibility(null);
      setRemainingSec(null);
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}/mobile/recording/eligibility`);
      if (!res.ok) return;
      const j: Eligibility = await res.json();
      setEligibility(j);
      setRemainingSec(j?.remaining_seconds ?? null);
    } catch (e) {
      L('ELIGIBILITY error', e);
    }
  }, [API_BASE, fetchWithAuth, isAuthenticated]);

  // Load on focus
  useFocusEffect(useCallback(() => { loadEligibility(); }, [loadEligibility]));

  // 1s ticker to update remainingSec based on next_eligible_at
  useEffect(() => {
    if (!eligibility) return;
    let raf: number | null = null;
    let timer: any = null;

    const tick = () => {
      if (!eligibility?.next_eligible_at) {
        setRemainingSec(0);
        return;
      }
      const next = Date.parse(eligibility.next_eligible_at);
      const now = Date.now();
      const remain = Math.max(0, Math.floor((next - now) / 1000));
      setRemainingSec(remain);
    };

    tick();
    timer = setInterval(tick, 1000);
    return () => { if (timer) clearInterval(timer); if (raf) cancelAnimationFrame(raf); };
  }, [eligibility]);



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


  function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: COLORS.label }}>{label}</Text>
        <View>{children}</View>
      </View>
    );
  }



  const granted = perm.cam === 'granted' && perm.mic === 'granted';
  const undetermined = perm.cam === 'undetermined' || perm.mic === 'undetermined';
  const locked = countdown !== null || recording || uploading;

  // Log key state changes to help spot stale bits
  useEffect(() => { L('STATE', { recording, uploading, countdown, mode, cameraKey, remountKey }); },
    [recording, uploading, countdown, mode, cameraKey, remountKey]);

  let content: React.ReactElement | null = null;


  //info for recorder setup panel
  const handleReady = useCallback(async () => {
      // Gate on daily quota
    if (eligibility && eligibility.allowed === false) {
      const mins = remainingSec != null ? Math.ceil(remainingSec / 60) : null;
      Alert.alert(
        'Daily limit',
        mins != null
          ? `You can record again in ~${mins} minute${mins === 1 ? '' : 's'}.`
          : 'You can record again later today.'
      );
      return;
    }
    
    if (!authReady || !isAuthenticated) { 
      Alert.alert('Please sign in', 'You must be logged in to record.'); 
      return; 
    }
    if (prepping) return;

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

        // Set title
        setAssignedTopic(t.prompt);
        setTopic(t.prompt);

        // Set recording duration from topic (prefer duration_sec; fallback suggested_duration_sec; else 60s)
        const secs =
          (Number.isFinite(t.duration_sec) && (t.duration_sec as number) > 0)
            ? (t.duration_sec as number)
            : (Number.isFinite(t.suggested_duration_sec) && (t.suggested_duration_sec as number) > 0)
              ? (t.suggested_duration_sec as number)
              : 60;

        setCaptureCutoffMs(Math.max(10, secs) * 1000); // clamp a little just in case

        // Set flags for metadata
        gradeAccRef.current = !!t.GradeAcc;
        syncInsightsRef.current = !!t.syncInsights;
      } finally {
        setPrepping(false);
      }
    } else {
      setTopic('');
      setAssignedTopic('');
      setCaptureCutoffMs(CAPTURE_CUTOFF_MS);
      gradeAccRef.current = false;
      syncInsightsRef.current = false;
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
    }

    if (previewKickoffTimer.current) clearTimeout(previewKickoffTimer.current);
    {
      const id = idSeq.current++;
      previewKickIdRef.current = id;
      previewKickoffTimer.current = setTimeout(() => {
        if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
        setCountdown(null);

        // bump to force a fresh CameraView instance each capture
        setCameraKey(k => k + 1);

        setMode('capture');
        // small delay to let CameraView mount fully
        setTimeout(() => startCaptureFlow(), 150);
      }, PREVIEW_SECONDS * 1000);
    }
  }, [
    eligibility, remainingSec,
    authReady, isAuthenticated, prepping, leaderboardOptIn, selectedLeaderboardTag,
    fetchFirstTopicFromLeaderboard, requestBoth, setPrepping, setAssignedTopic, setTopic,
    setMode, setCountdown, idSeq, countdownTimer, previewKickoffTimer, startCaptureFlow
  ]);

  function fmtHMS(total: number) {
    const t = Math.max(0, total|0);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const cooldownTotal = eligibility?.cooldown_seconds ?? (24 * 3600);
  const remain = remainingSec ?? 0;
  const readyNow = eligibility ? eligibility.allowed && remain <= 0 : true;
  const progressPct = readyNow ? 100 : Math.round(100 - (remain / cooldownTotal) * 100);





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
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 12 }}>
          {/* Quick summary of current setup */}
          <Text style={{ color: COLORS.label, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Current setup
          </Text>
          <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 }}>
            <Row label="Leaderboard">
              <Text style={{ color: COLORS.text, fontWeight: '800' }}>
                {leaderboardOptIn
                  ? (followedBoards.find(b => b.tag === selectedLeaderboardTag)?.name || 'Choose in Setup')
                  : 'Opted out'}
              </Text>
            </Row>
            {!!organization && (
              <Row label="Organization">
                <Text style={{ color: COLORS.text }}>{organization}</Text>
              </Row>
            )}
          </View>


          <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 4 }}>
            <MetricDial
              label={readyNow ? 'Ready to record' : 'Next session window'}
              value={progressPct}
              size={200}
              stroke={12}
              active={readyNow}
              showLabel={!readyNow}
              center={
                readyNow
                  ? <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 18 }}>Ready!</Text>
                  : <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 16 }}>{fmtHMS(remain)}</Text>
              }
            />
            {!readyNow && (
              <Text style={{ color: COLORS.label, marginTop: 6 }}>
                You can start a new session once this reaches 100%.
              </Text>
            )}
          </View>


          {/* Camera setup button (stays on RecorderScreen) */}
          <Pressable
            onPress={() => setMode('calibrate')}
            style={({ pressed }) => [
              localStyles.calBtnMain,
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.96 },
            ]}
          >
            <Text style={localStyles.calBtnMainText}>Camera Setup</Text>
          </Pressable>


          {/* Open Setup modal */}
          <Pressable
            onPress={() => setSetupVisible(true)}
            style={({ pressed }) => [
              localStyles.setupBtn,
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.96 },
            ]}
          >
            <Text style={localStyles.setupBtnText}>Select Topic</Text>
          </Pressable>

          {/* Ready button (uses the extracted handler) */}
          <Pressable
            onPress={handleReady}
            disabled={!authReady || !isAuthenticated || prepping || !readyNow}
            style={({ pressed }) => [
              localStyles.readyBtn,
              (!authReady || !isAuthenticated || prepping || !readyNow) && { opacity: 0.5 },
              pressed && authReady && isAuthenticated && !prepping && readyNow && { transform: [{ scale: 0.98 }], opacity: 0.96 },
            ]}
          >
            <Text style={localStyles.readyText}>
              {!authReady || !isAuthenticated
                ? 'Please sign in…'
                : (prepping ? 'Please wait…' : (readyNow ? 'Start Recording!' : 'Daily Limit Active'))}
            </Text>
          </Pressable>
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



      {/* Setup Modal (popup overlay) */}
      <Modal
        visible={setupVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSetupVisible(false)}
      >
        <Pressable
          style={localStyles.overlay}
          onPress={() => setSetupVisible(false)}
        >
          {/* Stop press-through so taps inside card don't dismiss */}
          <Pressable style={localStyles.popupCard} onPress={() => {}}>
            <View style={localStyles.popupHeader}>
              <Text style={localStyles.popupTitle}>Setup</Text>
              <Pressable onPress={() => setSetupVisible(false)} style={{ padding: 8 }}>
                <Text style={localStyles.popupAction}>Done</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
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

                /* Hide internal buttons: Ready + Camera setup (they live on the main screen) */
                onOpenCameraSetup={() => {}}
                onReady={() => {}} 
                hideReady
                hideCameraSetup
                readyDisabled
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>





    </View>
  );

}

const styles = StyleSheet.create({
  bottomBar: { position: 'absolute', bottom: 30, alignSelf: 'center' },
});
const localStyles = StyleSheet.create({
  setupBtn: {
    marginTop: 8,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  setupBtnText: { color: COLORS.text, fontWeight: '800' },

  readyBtn: {
    marginTop: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  readyText: { color: COLORS.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  calBtnMain: {
  marginTop: 8,
  backgroundColor: COLORS.card,
  borderColor: COLORS.border,
  borderWidth: 1,
  borderRadius: 999,
  paddingVertical: 12,
  alignItems: 'center',
},
calBtnMainText: { color: COLORS.text, fontWeight: '800' },

overlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.6)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 16,
},
popupCard: {
  width: '100%',
  maxWidth: 520,
  maxHeight: '85%',
  backgroundColor: COLORS.bg,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
  padding: 12,
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
},
popupHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
},
popupTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
popupAction: { color: COLORS.accent, fontWeight: '800' },


});

