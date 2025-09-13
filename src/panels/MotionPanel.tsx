// features/sessions/panels/MotionPanel.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, Linking, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { usePresignedVideoUrl } from '../hooks/usePresignedVideoUrl';
import { useSessionBodyText } from '../hooks/useSessionBodyText';
import { PanelProps } from './Panel.types';
import { errorMsg } from '../utils/errorMsg';
import CollapsibleBox from '../components/CollapsibleBox';
import { COLORS as C } from '../theme/colors';

type MotionParsed = {
  frames?: number;
  jitteryPct?: number;
  stiffnessPct?: number;
  swayScore?: number;     // 0..100 (higher is better)
  motionScore?: number;   // 0..100
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const pctNum = (s?: string) => (s ? parseFloat(s.replace('%', '').trim()) : NaN);
const intNum = (s?: string) => (s ? parseInt(s.replace(/,/g, ''), 10) : NaN);

// Inverse linear: 0% => 100; >= maxBad% => 0
function inversePctScore(p: number, maxBad = 30) {
  if (!isFinite(p)) return 0;
  if (p <= 0) return 100;
  if (p >= maxBad) return 0;
  return clamp(100 - (p / maxBad) * 100, 0, 100);
}

function parseMotionText(txt?: string): MotionParsed {
  if (!txt) return {};
  const get = (re: RegExp) => txt.match(re)?.[1];

  const frames      = intNum(get(/Frames analyzed:\s*([\d,]+)/i) || '');
  const jitteryPct  = pctNum(get(/Jittery movement.*?:\s*([\d.]+%)/i) || '');
  const stiffPct    = pctNum(get(/Stiffness.*?:\s*([\d.]+%)/i) || '');
  const swayScore   = parseFloat(get(/Sway quality score.*?:\s*([\d.]+)/i) || '');
  const motionScore = parseFloat(get(/Motion Score:\s*([\d.]+)/i) || '');

  return {
    frames: Number.isFinite(frames) ? frames : undefined,
    jitteryPct: Number.isFinite(jitteryPct) ? jitteryPct : undefined,
    stiffnessPct: Number.isFinite(stiffPct) ? stiffPct : undefined,
    swayScore: Number.isFinite(swayScore) ? swayScore : undefined,
    motionScore: Number.isFinite(motionScore) ? motionScore : undefined,
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

const MotionPanel: React.FC<PanelProps> = ({ sessionId }) => {
  // 1) Motion text
  const {
    text: bodyText,
    isLoading: bodyLoading,
    isError: bodyErr,
    error: bodyError,
    refetch: refetchBody,
  } = useSessionBodyText(sessionId, true);

  const parsed = useMemo(() => parseMotionText(bodyText), [bodyText]);

  // Derived meter values
  const jitteryScore = Number.isFinite(parsed.jitteryPct)
    ? inversePctScore(parsed.jitteryPct as number)     // lower % is better
    : undefined;

  const stiffnessScore = Number.isFinite(parsed.stiffnessPct)
    ? inversePctScore(parsed.stiffnessPct as number)   // lower % is better
    : undefined;

  const swayQualityScore = Number.isFinite(parsed.swayScore)
    ? clamp(parsed.swayScore as number)                // 0..100 higher is better
    : undefined;

  // 2) Video (presign on expand)
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

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      {/* Overview */}
      <CollapsibleBox
        title="Body Movement"
        initiallyCollapsed
        backgroundColor={C.card}
        borderColor={C.border}
        headerTint={C.text}
      >
        <Text style={{ color: C.label }}>
          This metric summarizes smoothness of movement. Excess jitter, high stiffness, or low-quality sway
          will reduce your score.
        </Text>
      </CollapsibleBox>

      {/* Analysis */}
      <CollapsibleBox
        title="Motion Analysis"
        initiallyCollapsed={false}
        backgroundColor={C.card}
        borderColor={C.border}
        headerTint={C.text}
      >
        {bodyLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading motion analysis…</Text>
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
              <Text style={styles.sectionTitle}>Movement — breakdown</Text>
              <Text style={styles.dim}>100 is best. Jitter/Stiffness: 0% ⇒ 100. Sway quality: higher ⇒ better.</Text>

              {Number.isFinite(parsed.jitteryPct) && (
                <Meter
                  label={`Jittery movement — ${(parsed.jitteryPct as number).toFixed(2)}%`}
                  value={jitteryScore ?? 0}
                  help="Lower is better (0% = 100)."
                />
              )}

              {Number.isFinite(parsed.stiffnessPct) && (
                <Meter
                  label={`Stiffness (avg L/R) — ${(parsed.stiffnessPct as number).toFixed(2)}%`}
                  value={stiffnessScore ?? 0}
                  help="Lower is better (0% = 100)."
                />
              )}

              {Number.isFinite(parsed.swayScore) && (
                <Meter
                  label="Sway quality"
                  value={swayQualityScore ?? 0}
                  help="Higher is better."
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
    </View>
  );
};

export default MotionPanel;

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

  // Meter visuals (matches Gesture/Posture)
  meterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  meterLabel: { color: C.label, fontSize: 12, fontWeight: '600' },
  meterRight: { color: C.text, fontSize: 12, fontWeight: '700' },
  meterTrack: { height: 8, backgroundColor: C.track, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: 8, backgroundColor: C.accent, borderRadius: 999 },
  meterHelp: { color: C.label, fontSize: 11, marginTop: 4 },

  // Legacy text line styles (kept in case you still show raw lines somewhere)
  line: { color: C.text, fontSize: 14 },
  k: { color: C.label, fontSize: 14, fontWeight: '700' },
  v: { color: C.white, fontSize: 14, fontWeight: '800' },
});
