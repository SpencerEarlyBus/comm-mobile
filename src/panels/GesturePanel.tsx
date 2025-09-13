// features/sessions/panels/GesturePanel.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, Linking, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { usePresignedVideoUrl } from '../hooks/usePresignedVideoUrl';
import { useSessionBodyText } from '../hooks/useSessionBodyText';
import { PanelProps } from './Panel.types';
import { errorMsg } from '../utils/errorMsg';
import CollapsibleBox from '../components/CollapsibleBox';
import { COLORS as C } from '../theme/colors';

type BodyParsed = {
  frames?: number;
  postureScore?: number;
  gestureActivityPct?: number;
  claspedPct?: number;
  crossedPct?: number;
  gestureScore?: number;
  motionScore?: number;
  overallScore?: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pctNum = (s?: string) => (s ? parseFloat(s.replace('%', '').trim()) : NaN);
const intNum = (s?: string) => (s ? parseInt(s, 10) : NaN);

// Trapezoid: 0→20% ramps to 100; 20–40% = 100; >40% falls to 0 at 70%
function scoreGestureActivity(p: number) {
  if (!isFinite(p)) return 0;
  if (p <= 0) return 0;
  if (p < 20) return clamp((p / 20) * 100, 0, 100);
  if (p <= 40) return 100;
  if (p >= 70) return 0;
  return clamp(100 - ((p - 40) / (70 - 40)) * 100, 0, 100);
}

// Inverse linear: 0% => 100; max% => 0 (default max 30%)
function inversePctScore(p: number, maxBad = 30) {
  if (!isFinite(p)) return 0;
  if (p <= 0) return 100;
  if (p >= maxBad) return 0;
  return clamp(100 - (p / maxBad) * 100, 0, 100);
}

function parseBodyText(txt?: string): BodyParsed {
  if (!txt) return {};
  const get = (re: RegExp) => txt.match(re)?.[1];

  const frames = intNum(get(/Frames analyzed:\s*([\d,]+)/i)?.replace(/,/g, ''));
  const postureScore = parseFloat(get(/Posture Score:\s*([\d.]+)/i) || '') || undefined;
  const motionScore = parseFloat(get(/Motion Score:\s*([\d.]+)/i) || '') || undefined;
  const gestureScore = parseFloat(get(/Gesture Score:\s*([\d.]+)/i) || '') || undefined;
  const overallScore = parseFloat(get(/Overall Score.*?:\s*([\d.]+)/i) || '') || undefined;

  const gestureActivityPct = pctNum(get(/Gesture activity.*?:\s*([\d.]+%)/i) || '');
  const claspedPct = pctNum(get(/Clasped at midline.*?:\s*([\d.]+%)/i) || '');
  const crossedPct = pctNum(get(/Crossed hands.*?:\s*([\d.]+%)/i) || '');

  return {
    frames,
    postureScore,
    motionScore,
    gestureScore,
    overallScore,
    gestureActivityPct,
    claspedPct,
    crossedPct,
  };
}

function Meter({ label, value, help }: { label: string; value: number; help?: string }) {
  const v = clamp(Math.round(value), 0, 100);
  return (
    <View style={{ marginTop: 8 }}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterRight}>{v}/100</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${v}%` }]} />
      </View>
      {!!help && <Text style={styles.meterHelp}>{help}</Text>}
    </View>
  );
}

const GesturePanel: React.FC<PanelProps> = ({ sessionId }) => {
  // Body analysis text
  const {
    text: bodyText,
    isLoading: bodyLoading,
    isError: bodyErr,
    error: bodyError,
    refetch: refetchBody,
  } = useSessionBodyText(sessionId, true);

  const parsed = useMemo(() => parseBodyText(bodyText), [bodyText]);

  // Presigned URL (do NOT auto-fetch; we will fetch on expand)
  const {
    data: url,
    isLoading: presignLoading,
    isError: presignErr,
    error: presignError,
    refetch: refetchVideo,
  } = usePresignedVideoUrl(sessionId, false);

  const [videoOpen, setVideoOpen] = useState(false);

  // Expo-video player (always create; attach/detach source as UI changes)
  const player = useVideoPlayer('', (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });

  // Local video UX state
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const attachTokenRef = useRef(0);

  // Player status listener
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }: any) => {
      if (status === 'readyToPlay') setReady(true);
      if (status === 'error') setLoadError(error?.message ?? 'Playback error');
    });
    return () => sub.remove();
  }, [player]);

  // On expand: fetch fresh presigned URL; on collapse: detach
  useEffect(() => {
    (async () => {
      if (videoOpen) {
        setReady(false);
        setLoadError(null);
        await refetchVideo();
      } else {
        try { await player.pause(); } catch {}
        try { await player.replaceAsync(''); } catch {}
        setReady(false);
        setLoadError(null);
      }
    })();
  }, [videoOpen, refetchVideo, player]);

  // When URL is present & box open → attach to player
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!videoOpen || !url) return;
      const token = ++attachTokenRef.current;
      setLoadingVideo(true);
      setReady(false);
      setLoadError(null);
      try {
        await player.replaceAsync({ uri: url });
        if (cancelled || attachTokenRef.current !== token) return;
        // ready will flip via statusChange
      } catch (e: any) {
        if (!cancelled && attachTokenRef.current === token) {
          setLoadError(e?.message ?? 'Cannot open video');
        }
      } finally {
        if (!cancelled && attachTokenRef.current === token) {
          setLoadingVideo(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [videoOpen, url, player]);

  const retryText = useCallback(async () => { await refetchBody(); }, [refetchBody]);

  // Derived gesture sub-scores
  const gestureActivityScore = Number.isFinite(parsed.gestureActivityPct)
    ? scoreGestureActivity(parsed.gestureActivityPct as number)
    : undefined;
  const claspedScore = Number.isFinite(parsed.claspedPct)
    ? inversePctScore(parsed.claspedPct as number)
    : undefined;
  const crossedScore = Number.isFinite(parsed.crossedPct)
    ? inversePctScore(parsed.crossedPct as number)
    : undefined;

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Overview */}
      <CollapsibleBox
        title="Body Gesturing"
        initiallyCollapsed
        backgroundColor={C.card}
        borderColor={C.border}
        headerTint={C.text}
      >
        <Text style={{ color: C.label }}>
          This analysis covers posture, motion, and gestures. Gestures are healthiest when present for ~20–40%
          of the session; clasped/crossed hands should be near 0%.
        </Text>
      </CollapsibleBox>

      {/* Parsed scores */}
      <CollapsibleBox
        title="Body Language Analysis"
        initiallyCollapsed={false}
        backgroundColor={C.card}
        borderColor={C.border}
        headerTint={C.text}
      >
        {bodyLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading analysis…</Text>
          </View>
        ) : bodyErr ? (
          <View>
            <Text style={styles.errText}>Couldn’t load body text: {errorMsg(bodyError)}</Text>
            <Pressable onPress={retryText} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !bodyText ? (
          <Text style={styles.emptyText}>No body-language analysis available.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {!!parsed.frames && (
              <Text style={styles.dim}>Frames analyzed: {parsed.frames.toLocaleString()}</Text>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gestures — breakdown</Text>
              <Text style={styles.dim}>100 for activity in 20–40%; 100 if Clasped/Crossed are 0%.</Text>

              {Number.isFinite(parsed.gestureActivityPct) && (
                <Meter
                  label={`Gesture activity — ${(parsed.gestureActivityPct as number).toFixed(2)}%`}
                  value={gestureActivityScore ?? 0}
                  help="Goal range ≈ 20–40%."
                />
              )}
              {Number.isFinite(parsed.claspedPct) && (
                <Meter
                  label={`Clasped at midline — ${(parsed.claspedPct as number).toFixed(2)}%`}
                  value={claspedScore ?? 0}
                  help="Lower is better (0% = 100)."
                />
              )}
              {Number.isFinite(parsed.crossedPct) && (
                <Meter
                  label={`Crossed hands — ${(parsed.crossedPct as number).toFixed(2)}%`}
                  value={crossedScore ?? 0}
                  help="Lower is better (0% = 100)."
                />
              )}
            </View>
          </View>
        )}
      </CollapsibleBox>

      {/* Session Video — loads ONLY when expanded */}
      <CollapsibleBox
        title="Session Video"
        initiallyCollapsed
        backgroundColor={C.black}
        borderColor={C.border}
        headerTint={C.text}
        onToggle={setVideoOpen}
      >
        {!videoOpen ? (
          <Text style={styles.dim}>Expand to load the video.</Text>
        ) : presignLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Fetching video link…</Text>
          </View>
        ) : presignErr ? (
          <View style={{ rowGap: 8 }}>
            <Text style={styles.errText}>Couldn’t get video URL: {errorMsg(presignError)}</Text>
            <Pressable onPress={() => refetchVideo()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Refresh Link</Text>
            </Pressable>
          </View>
        ) : !url ? (
          <Text style={styles.emptyText}>No video available.</Text>
        ) : loadingVideo ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading video…</Text>
          </View>
        ) : loadError ? (
          <View style={{ rowGap: 8 }}>
            <Text style={styles.errText}>Playback error: {loadError}</Text>
            <View style={{ flexDirection: 'row', columnGap: 10 }}>
              <Pressable onPress={() => refetchVideo()} style={styles.retryBtn}>
                <Text style={styles.retryText}>Refresh Link</Text>
              </Pressable>
              <Pressable onPress={() => Linking.openURL(url)} style={[styles.retryBtn, { backgroundColor: '#334155' }]}>
                <Text style={styles.retryText}>Open in Browser</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <VideoView
              key={url} // remount on new presign
              player={player}
              style={{ width: '100%', aspectRatio: 9 / 16 }}
              nativeControls
              allowsFullscreen
              allowsPictureInPicture
              contentFit="contain"
            />
            <View style={{ marginTop: 8 }}>
              <Pressable onPress={() => Linking.openURL(url)} style={[styles.retryBtn, { backgroundColor: '#334155' }]}>
                <Text style={styles.retryText}>Open in Browser</Text>
              </Pressable>
            </View>
          </>
        )}
      </CollapsibleBox>
    </View>
  );
};

export default GesturePanel;

const styles = StyleSheet.create({
  centerBox: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: C.label },
  errText: { color: C.danger, marginBottom: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  retryText: { color: C.white, fontWeight: '700' },
  emptyText: { color: C.label },

  meterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  meterLabel: { color: C.label, fontSize: 12, fontWeight: '600' },
  meterRight: { color: C.text, fontSize: 12, fontWeight: '700' },
  meterTrack: { height: 8, backgroundColor: C.track, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: 8, backgroundColor: C.accent, borderRadius: 999 },
  meterHelp: { color: C.label, fontSize: 11, marginTop: 4 },

  section: { marginTop: 10 },
  sectionTitle: { color: C.text, fontSize: 13, fontWeight: '800' },

  dim: { color: C.label, fontSize: 12 },
});
