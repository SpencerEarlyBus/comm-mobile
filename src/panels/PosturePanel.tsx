// features/sessions/panels/PosturePanel.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, Linking, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { usePresignedVideoUrl } from '../hooks/usePresignedVideoUrl';
import { useSessionBodyText } from '../hooks/useSessionBodyText';
import { PanelProps } from './Panel.types';
import { errorMsg } from '../utils/errorMsg';
import CollapsibleBox from '../components/CollapsibleBox';
import { COLORS as C } from '../theme/colors';

type PostureParsed = {
  openPct?: number;         // Open posture %
  belowWaistPct?: number;   // Hands below waist %
  postureScore?: number;    // 0..100
  frames?: number;          // optional
};

const pctNum = (s?: string) => (s ? parseFloat(s.replace('%', '').trim()) : NaN);
const intNum = (s?: string) => (s ? parseInt(s.replace(/,/g, ''), 10) : NaN);

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

const PosturePanel: React.FC<PanelProps> = ({ sessionId }) => {
  // 1) Posture text (from body_txt)
  const {
    text: bodyText,
    isLoading: bodyLoading,
    isError: bodyErr,
    error: bodyError,
    refetch: refetchBody,
  } = useSessionBodyText(sessionId, true);

  const parsed = useMemo(() => parsePostureText(bodyText), [bodyText]);

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
      {/* Posture — Overview (optional explanatory copy) */}
      <CollapsibleBox
        title="Posture — Overview"
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

      {/* Posture — Stats */}
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
          <View style={{ gap: 8 }}>
            {!!parsed.frames && (
              <Text style={styles.dim}>Frames analyzed: {parsed.frames.toLocaleString()}</Text>
            )}

            <View style={{ gap: 4 }}>
              <Text style={styles.line}>
                <Text style={styles.k}>Open posture:</Text>{' '}
                <Text style={styles.v}>
                  {parsed.openPct != null ? `${parsed.openPct.toFixed(2)}%` : '—'}
                </Text>
              </Text>
              <Text style={styles.line}>
                <Text style={styles.k}>Hands below waist:</Text>{' '}
                <Text style={styles.v}>
                  {parsed.belowWaistPct != null ? `${parsed.belowWaistPct.toFixed(2)}%` : '—'}
                </Text>
              </Text>
              <Text style={styles.line}>
                <Text style={styles.k}>Posture Score:</Text>{' '}
                <Text style={styles.v}>
                  {parsed.postureScore != null ? `${Math.round(parsed.postureScore)}/100` : '—'}
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
        ) : ( // we have a URL
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

  line: { color: C.text, fontSize: 14 },
  k: { color: C.label, fontSize: 14, fontWeight: '700' },
  v: { color: C.white, fontSize: 14, fontWeight: '800' },
  dim: { color: C.label, fontSize: 12 },
});
