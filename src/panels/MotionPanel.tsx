// features/sessions/panels/GesturePanel.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, Linking } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { usePresignedVideoUrl } from '../hooks/usePresignedVideoUrl';
import { PanelProps } from './Panel.types';
import { errorMsg } from '../utils/errorMsg';

const MotionPanel: React.FC<PanelProps> = ({ sessionId }) => {
  const { data: urlRaw, isLoading, isError, refetch } = usePresignedVideoUrl(sessionId, true);
  const url = (urlRaw ?? '').trim();

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

  useEffect(() => { refetch(); }, []); // fresh presign on mount

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!url) return;
      setReady(false); setLoadError(null); setLoadingVideo(true);
      try { await player.replaceAsync({ uri: url }); } 
      catch (e) { if (!cancelled) setLoadError(errorMsg(e)); }
      finally { if (!cancelled) setLoadingVideo(false); }
    })();
    return () => { cancelled = true; };
  }, [url, player]);

  useEffect(() => {
    return () => { (async () => { try { await player.pause(); } catch {} try { await player.replaceAsync(''); } catch {} })(); };
  }, [player]);

  const retry = useCallback(async () => { setLoadError(null); setReady(false); await refetch(); }, [refetch]);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 10 }}>
      <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#fff', padding: 14, marginBottom: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>Body Motion Analysis</Text>
        <Text style={{ marginTop: 6, color: '#475569' }}>
          Review your hand usage, symmetry, and gesture timing. Aim for purposeful gestures that match your points.
        </Text>
      </View>

      <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
        {(isLoading || loadingVideo) && (
          <View style={{ padding: 18, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: '#cbd5e1' }}>{isLoading ? 'Fetching video link…' : 'Loading video…'}</Text>
          </View>
        )}

        {(isError || loadError) && !isLoading && !loadingVideo && (
          <View style={{ padding: 14, rowGap: 8 }}>
            <Text style={{ color: '#ef4444' }}>Couldn’t load the session video{loadError ? `: ${loadError}` : ''}.</Text>
            <View style={{ flexDirection: 'row', columnGap: 10 }}>
              <Pressable onPress={retry} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#0ea5e9' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Retry</Text>
              </Pressable>
              {!!url && (
                <Pressable onPress={() => Linking.openURL(url)}
                  style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#334155' }}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Open in Browser</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {url && ready && !loadingVideo && !isLoading && !isError && !loadError && (
          <VideoView
            key={url}
            player={player}
            style={{ width: '100%', aspectRatio: 9 / 16 }} // 16/9 if landscape
            nativeControls
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
          />
        )}

        {!url && !isLoading && !isError && (
          <View style={{ padding: 14 }}>
            <Text style={{ color: '#64748b' }}>No video available for this session.</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default MotionPanel;
