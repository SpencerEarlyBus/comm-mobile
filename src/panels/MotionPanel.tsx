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
  swayScore?: number;
  motionScore?: number;
};

const pctNum = (s?: string) => (s ? parseFloat(s.replace('%', '').trim()) : NaN);
const intNum = (s?: string) => (s ? parseInt(s.replace(/,/g, ''), 10) : NaN);

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

const MotionPanel: React.FC<PanelProps> = ({ sessionId }) => {
  // 1) Motion text (from body_txt)
  const {
    text: bodyText,
    isLoading: bodyLoading,
    isError: bodyErr,
    error: bodyError,
    refetch: refetchBody,
  } = useSessionBodyText(sessionId, true);

  const parsed = useMemo(() => parseMotionText(bodyText), [bodyText]);

  // 2) Video — fetch presign only when the box is opened
  const {
    data: url,
    isLoading: presignLoading,
    isError: presignErr,
    error: presignError,
    refetch: refetchVideo,
  } = usePresignedVideoUrl(sessionId, false);

  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    if (videoOpen) refetchVideo(); // ask backend for a fresh presigned URL on expand
  }, [videoOpen, refetchVideo]);

  // Attach player only when we *have* a URL and the box is open
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

  // Clean up player on unmount
  useEffect(() => {
    return () => {
      (async () => {
        try { await player.pause(); } catch {}
        try { await player.replaceAsync(''); } catch {}
      })();
    };
  }, [player]);

  // When (open && url) attach player
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
      {/* Motion — Overview */}
      <CollapsibleBox
        title="Body Motion — Overview"
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

      {/* Motion — Stats */}
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
          <View style={{ gap: 8 }}>
            {!!parsed.frames && (
              <Text style={styles.dim}>Frames analyzed: {parsed.frames.toLocaleString()}</Text>
            )}

            <View style={{ gap: 4 }}>
              <Text style={styles.line}>
                <Text style={styles.k}>Jittery movement (combined):</Text>{' '}
                <Text style={styles.v}>
                  {parsed.jitteryPct != null ? `${parsed.jitteryPct.toFixed(2)}%` : '—'}
                </Text>
              </Text>

              <Text style={styles.line}>
                <Text style={styles.k}>Stiffness (avg L/R):</Text>{' '}
                <Text style={styles.v}>
                  {parsed.stiffnessPct != null ? `${parsed.stiffnessPct.toFixed(2)}%` : '—'}
                </Text>
              </Text>

              <Text style={styles.line}>
                <Text style={styles.k}>Sway quality score:</Text>{' '}
                <Text style={styles.v}>
                  {parsed.swayScore != null ? `${Math.round(parsed.swayScore)}` : '—'}
                </Text>
              </Text>

              <Text style={styles.line}>
                <Text style={styles.k}>Motion Score:</Text>{' '}
                <Text style={styles.v}>
                  {parsed.motionScore != null ? `${Math.round(parsed.motionScore)}/100` : '—'}
                </Text>
              </Text>
            </View>
          </View>
        )}
      </CollapsibleBox>

      {/* Session Video — collapsed by default; loads ONLY when expanded */}
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

  line: { color: C.text, fontSize: 14 },
  k: { color: C.label, fontSize: 14, fontWeight: '700' },
  v: { color: C.white, fontSize: 14, fontWeight: '800' },
  dim: { color: C.label, fontSize: 12 },
});
