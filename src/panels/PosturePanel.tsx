// features/sessions/panels/PosturePanel.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, Linking, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { usePresignedAnnotatedUrl } from '../hooks/usePresignedAnnotatedUrl';
import { usePresignedVideoUrl } from '../hooks/usePresignedVideoUrl';
import { useSessionBodyText } from '../hooks/useSessionBodyText';
import { PanelProps } from './Panel.types';
import { errorMsg } from '../utils/errorMsg';
import CollapsibleBox from '../components/CollapsibleBox';
import { COLORS as C } from '../theme/colors';

type PostureParsed = {
  openPct?: number;         // Open posture % (higher is better)
  belowWaistPct?: number;   // Hands below waist % (lower is better)
  postureScore?: number;    // 0..100
  frames?: number;          // optional
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const pctNum = (s?: string) => (s ? parseFloat(s.replace('%', '').trim()) : NaN);
const intNum = (s?: string) => (s ? parseInt(s.replace(/,/g, ''), 10) : NaN);

// Inverse linear: 0% => 100; >= maxBad% => 0 (default maxBad=30%)
function inversePctScore(p: number, maxBad = 30) {
  if (!isFinite(p)) return 0;
  if (p <= 0) return 100;
  if (p >= maxBad) return 0;
  return clamp(100 - (p / maxBad) * 100, 0, 100);
}

function parsePostureText(txt?: string): PostureParsed {
  if (!txt) return {};
  const get = (re: RegExp) => txt.match(re)?.[1];

  const openPct = pctNum(get(/Open posture:\s*([\d.]+%)/i) || '');
  const belowWaistPct = pctNum(get(/Hands below waist:\s*([\d.]+%)/i) || '');
  const postureScore = parseFloat(get(/Posture Score:\s*([\d.]+)/i) || '');
  const frames = intNum(get(/Frames analyzed:\s*([\d,]+)/i) || '');

  return {
    openPct: Number.isFinite(openPct) ? openPct : undefined,
    belowWaistPct: Number.isFinite(belowWaistPct) ? belowWaistPct : undefined,
    postureScore: Number.isFinite(postureScore) ? postureScore : undefined,
    frames: Number.isFinite(frames) ? frames : undefined,
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

const PosturePanel: React.FC<PanelProps> = ({ sessionId }) => {
  // 1) Posture text
  const {
    text: bodyText,
    isLoading: bodyLoading,
    isError: bodyErr,
    error: bodyError,
    refetch: refetchBody,
  } = useSessionBodyText(sessionId, true);
  const parsed = useMemo(() => parsePostureText(bodyText), [bodyText]);

  // Derived bars
  const openScore = Number.isFinite(parsed.openPct) ? clamp(parsed.openPct as number) : undefined; // higher is better
  const belowWaistScore = Number.isFinite(parsed.belowWaistPct)
    ? inversePctScore(parsed.belowWaistPct as number) // lower is better
    : undefined;

  // 2) Plain Session Video
  const {
    data: url,
    isLoading: presignLoading,
    isError: presignErr,
    error: presignError,
    refetch: refetchVideo,
  } = usePresignedVideoUrl(sessionId, false);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => { if (videoOpen) refetchVideo(); }, [videoOpen, refetchVideo]);

  const player = useVideoPlayer('', (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }: any) => {
      if (status === 'readyToPlay') setReady(true);
      if (status === 'error') setLoadError(errorMsg(error ?? 'Playback error'));
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    return () => {
      (async () => {
        try { await player.pause(); } catch {}
        try { await player.replaceAsync(''); } catch {}
      })();
    };
  }, [player]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!videoOpen || !url) return;
      setReady(false); setLoadError(null); setLoadingVideo(true);
      try { await player.replaceAsync({ uri: url }); }
      catch (e) { if (!cancelled) setLoadError(errorMsg(e)); }
      finally { if (!cancelled) setLoadingVideo(false); }
    })();
    return () => { cancelled = true; };
  }, [videoOpen, url, player]);

  const retryText = useCallback(() => refetchBody(), [refetchBody]);
  const retryVideo = useCallback(() => { setLoadError(null); refetchVideo(); }, [refetchVideo]);

  // 3) Annotated Session Video
  const {
    data: annotatedUrl,
    isLoading: annotatedLoading,
    isError: annotatedErr,
    error: annotatedError,
    refetch: refetchAnnotated,
  } = usePresignedAnnotatedUrl(sessionId, false);

  const [annotatedOpen, setAnnotatedOpen] = useState(false);

  useEffect(() => { if (annotatedOpen) refetchAnnotated(); }, [annotatedOpen, refetchAnnotated]);

  const annotatedPlayer = useVideoPlayer('', (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });
  const [annotatedReady, setAnnotatedReady] = useState(false);
  const [annotatedLoadingPlayer, setAnnotatedLoadingPlayer] = useState(false);
  const [annotatedLoadErr, setAnnotatedLoadErr] = useState<string | null>(null);

  useEffect(() => {
    const sub = annotatedPlayer.addListener('statusChange', ({ status, error }: any) => {
      if (status === 'readyToPlay') setAnnotatedReady(true);
      if (status === 'error') setAnnotatedLoadErr(errorMsg(error ?? 'Playback error'));
    });
    return () => sub.remove();
  }, [annotatedPlayer]);

  useEffect(() => {
    return () => {
      (async () => {
        try { await annotatedPlayer.pause(); } catch {}
        try { await annotatedPlayer.replaceAsync(''); } catch {}
      })();
    };
  }, [annotatedPlayer]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!annotatedOpen || !annotatedUrl) return;
      setAnnotatedReady(false); setAnnotatedLoadErr(null); setAnnotatedLoadingPlayer(true);
      try { await annotatedPlayer.replaceAsync({ uri: annotatedUrl }); }
      catch (e) { if (!cancelled) setAnnotatedLoadErr(errorMsg(e)); }
      finally { if (!cancelled) setAnnotatedLoadingPlayer(false); }
    })();
    return () => { cancelled = true; };
  }, [annotatedOpen, annotatedUrl, annotatedPlayer]);

  const retryAnnotated = useCallback(() => {
    setAnnotatedLoadErr(null);
    refetchAnnotated();
  }, [refetchAnnotated]);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Overview */}
      <CollapsibleBox
        title="Body Posture"
        initiallyCollapsed
        backgroundColor={C.card}
        borderColor={C.border}
        headerTint={C.text}
      >
        <Text style={{ color: C.label }}>
          This metric focuses on upright posture and keeping hands from resting below the waistline.
          Open, balanced posture is scored positively; hands below waist reduce your score.
        </Text>
      </CollapsibleBox>

      {/* Analysis */}
      <CollapsibleBox
        title="Posture Analysis"
        initiallyCollapsed={false}
        backgroundColor={C.card}
        borderColor={C.border}
        headerTint={C.text}
      >
        {bodyLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading posture analysis…</Text>
          </View>
        ) : bodyErr ? (
          <View>
            <Text style={styles.errText}>Couldn’t load analysis: {errorMsg(bodyError)}</Text>
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

            <View>
              <Text style={styles.sectionTitle}>Posture — breakdown</Text>
              <Text style={styles.dim}>
                100 for open posture at 100%; 100 for hands-below-waist at 0%.
              </Text>

              {Number.isFinite(parsed.openPct) && (
                <Meter
                  label={`Open posture — ${(parsed.openPct as number).toFixed(2)}%`}
                  value={openScore ?? 0}
                  help="Higher is better (100% = ideal)."
                />
              )}

              {Number.isFinite(parsed.belowWaistPct) && (
                <Meter
                  label={`Hands below waist — ${(parsed.belowWaistPct as number).toFixed(2)}%`}
                  value={belowWaistScore ?? 0}
                  help="Lower is better (0% = 100)."
                />
              )}
            </View>
          </View>
        )}
      </CollapsibleBox>

      {/* Session Video */}
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
            <Pressable onPress={retryVideo} style={styles.retryBtn}>
              <Text style={styles.retryText}>Refresh Link</Text>
            </Pressable>
          </View>
        ) : !url ? (
          <Text style={styles.emptyText}>No video available.</Text>
        ) : (
          <>
            {(loadingVideo || !ready) ? (
              <View style={styles.centerBox}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Loading video…</Text>
              </View>
            ) : null}

            {ready && !loadingVideo && (
              <VideoView
                key={url}
                player={player}
                style={{ width: '100%', aspectRatio: 9 / 16 }}
                nativeControls
                allowsFullscreen
                allowsPictureInPicture
                contentFit="contain"
              />
            )}

            <View style={{ marginTop: 8 }}>
              <Pressable
                onPress={() => Linking.openURL(url)}
                style={[styles.retryBtn, { backgroundColor: '#334155' }]}
              >
                <Text style={styles.retryText}>Open in Browser</Text>
              </Pressable>
            </View>
          </>
        )}
      </CollapsibleBox>

      {/* Annotated Session Video */}
      <CollapsibleBox
        title="Annotated Session Video"
        initiallyCollapsed
        backgroundColor={C.black}
        borderColor={C.border}
        headerTint={C.text}
        onToggle={setAnnotatedOpen}
      >
        {!annotatedOpen ? (
          <Text style={styles.dim}>Expand to load the annotated video.</Text>
        ) : annotatedLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Fetching annotated link…</Text>
          </View>
        ) : annotatedErr ? (
          <View style={{ rowGap: 8 }}>
            <Text style={styles.errText}>Couldn’t get annotated URL: {errorMsg(annotatedError)}</Text>
            <Pressable onPress={retryAnnotated} style={styles.retryBtn}>
              <Text style={styles.retryText}>Refresh Link</Text>
            </Pressable>
          </View>
        ) : !annotatedUrl ? (
          <Text style={styles.emptyText}>No annotated video available.</Text>
        ) : (
          <>
            {(annotatedLoadingPlayer || !annotatedReady) ? (
              <View style={styles.centerBox}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Loading annotated video…</Text>
              </View>
            ) : null}

            {annotatedReady && !annotatedLoadingPlayer && (
              <VideoView
                key={annotatedUrl}
                player={annotatedPlayer}
                style={{ width: '100%', aspectRatio: 9 / 16 }}
                nativeControls
                allowsFullscreen
                allowsPictureInPicture
                contentFit="contain"
              />
            )}

            <View style={{ marginTop: 8 }}>
              <Pressable
                onPress={() => Linking.openURL(annotatedUrl)}
                style={[styles.retryBtn, { backgroundColor: '#334155' }]}
              >
                <Text style={styles.retryText}>Open Annotated in Browser</Text>
              </Pressable>
            </View>
          </>
        )}
      </CollapsibleBox>
    </View>
  );
};

export default PosturePanel;

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

  sectionTitle: { color: C.text, fontSize: 13, fontWeight: '800' },
  dim: { color: C.label, fontSize: 12 },

  // Meters (same visual language as Gesture panel)
  meterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  meterLabel: { color: C.label, fontSize: 12, fontWeight: '600' },
  meterRight: { color: C.text, fontSize: 12, fontWeight: '700' },
  meterTrack: { height: 8, backgroundColor: C.track, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: 8, backgroundColor: C.accent, borderRadius: 999 },
  meterHelp: { color: C.label, fontSize: 11, marginTop: 4 },
});
