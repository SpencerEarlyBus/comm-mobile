// components/LeftDrawerPlaceholder.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { C, S } from '../theme/tokens';
import QuestionsModal from './QuestionsModal';
import { useAuth } from '../context/MobileAuthContext'; 

type Props = { onClose?: () => void };

const CASE_PDF_KEY = 'frontend_media/Loss_of_B2B_Client_Report.pdf';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.api.domain';

// Simple chevron
function Chevron({ open }: { open: boolean }) {
  return (
    <Text style={{ color: C.subtext, fontSize: 12, marginLeft: 6 }}>
      {open ? '▾' : '▸'}
    </Text>
  );
}

export default function LeftDrawerPlaceholder({ onClose }: Props) {
    const { fetchWithAuth } = useAuth();
  // Collapsible sections
  const [lectauraOpen, setLectauraOpen] = useState(true);

  // Explainer modal state
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);



    //Questions Modal State
  const [qOpen, setQOpen] = useState(false);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState<string | null>(null);
  const [qTopic, setQTopic] = useState<string | undefined>(undefined);
  const [qList, setQList] = useState<string[]>([]);
  const [qPdfUrl, setQPdfUrl] = useState<string | null>(null);

  const runDocQuestions = useCallback(async () => {
    setQLoading(true);
    setQError(null);
    setQTopic(undefined);
    setQList([]);
    setQPdfUrl(null);
    try {
      const res = await fetchWithAuth(`${API_BASE}/mobile/doc-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3_key: CASE_PDF_KEY }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setQTopic(data?.topic || '');
      setQList(Array.isArray(data?.questions) ? data.questions : []);
      setQPdfUrl(data?.pdf_url || null);
    } catch (e: any) {
      setQError(e?.message ?? 'Failed to generate questions');
    } finally {
      setQLoading(false);
    }
  }, [fetchWithAuth]);



  // Video player
  const player = useVideoPlayer('', (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });
  const [ready, setReady] = useState(false);
  const [playErr, setPlayErr] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }: any) => {
      if (status === 'readyToPlay') setReady(true);
      if (status === 'error') setPlayErr(error?.message ?? 'Playback error');
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

  const fetchSignedUrl = useCallback(async () => {
    setLoadingUrl(true);
    setUrlError(null);
    try {
      const res = await fetch(
        `${API_BASE}/media/public_presigned_url?key=${encodeURIComponent('frontend_media/lectaura_introduction.mp4')}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.url) setVideoUrl(String(data.url));
      else throw new Error('No URL in response');
    } catch (e: any) {
      setUrlError(e?.message ?? 'Failed to fetch video URL');
    } finally {
      setLoadingUrl(false);
    }
  }, []);

  // When modal opens, fetch URL (once) & attach to player
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!videoOpen) return;
      if (!videoUrl && !loadingUrl && !urlError) {
        await fetchSignedUrl();
      }
    })();
    return () => { cancelled = true; };
  }, [videoOpen, videoUrl, loadingUrl, urlError, fetchSignedUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!videoOpen || !videoUrl) return;
      setReady(false);
      setPlayErr(null);
      setLoadingVideo(true);
      try {
        await player.replaceAsync({ uri: videoUrl });
      } catch (e: any) {
        if (!cancelled) setPlayErr(e?.message ?? 'Cannot open video');
      } finally {
        if (!cancelled) setLoadingVideo(false);
      }
    })();
    return () => { cancelled = true; };
  }, [videoOpen, videoUrl, player]);

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Menu</Text>

      {/* --- What is Lectaura --- */}
      <View style={styles.section}>
        <Pressable
          onPress={() => setLectauraOpen((v) => !v)}
          style={({ pressed }) => [styles.sectionHeader, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.sectionTitle}>What is Lectaura</Text>
          <Chevron open={lectauraOpen} />
        </Pressable>

        {lectauraOpen && (
          <View style={styles.list}>
            {/* Overview explainer (wired) */}
            <Pressable
              onPress={() => setVideoOpen(true)}
              style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.listItemText}>• Overview (2 min)</Text>
              <Text style={styles.badge}>Watch</Text>
            </Pressable>

            {/* --- NEW: Case study PDF → generate questions --- 
            <Pressable
              onPress={() => { setQOpen(true); runDocQuestions(); }}
              style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.listItemText}>• PDF</Text>
              <Text style={styles.badge}>Questions</Text>
            </Pressable>
            */}
            {/* placeholders */}
            <Pressable disabled style={[styles.listItem, { opacity: 0.6 }]}>
              <Text style={styles.listItemText}>• Dials & Scores</Text>
              <Text style={styles.badgeMuted}>Soon</Text>
            </Pressable>
            <Pressable disabled style={[styles.listItem, { opacity: 0.6 }]}>
              <Text style={styles.listItemText}>• Leaderboards</Text>
              <Text style={styles.badgeMuted}>Soon</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonPrimaryText}>Close</Text>
      </Pressable>

      {/* -------- Explainer Modal -------- */}
      <Modal visible={videoOpen} transparent animationType="fade" onRequestClose={() => setVideoOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVideoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => { /* swallow */ }}>
            <Text style={styles.modalTitle}>Lectaura — Overview</Text>

            {/* URL loading states */}
            {loadingUrl && (
              <View style={styles.centerBox}>
                <ActivityIndicator />
                <Text style={styles.muted}>Fetching video link…</Text>
              </View>
            )}
            {!!urlError && (
              <View style={{ rowGap: 8 }}>
                <Text style={styles.errText}>Couldn’t get video URL: {urlError}</Text>
                <Pressable onPress={fetchSignedUrl} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Retry</Text>
                </Pressable>
              </View>
            )}

            {!!videoUrl && (
              <>
                {(loadingVideo || !ready) ? (
                  <View style={styles.centerBox}>
                    <ActivityIndicator />
                    <Text style={styles.muted}>Loading video…</Text>
                  </View>
                ) : null}

                {ready && !loadingVideo && (
                  <VideoView
                    key={videoUrl}
                    player={player}
                    style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}
                    nativeControls
                    allowsFullscreen
                    allowsPictureInPicture
                    contentFit="contain"
                  />
                )}

                <View style={{ flexDirection: 'row', columnGap: 10, marginTop: S.sm }}>
                  <Pressable onPress={() => setVideoOpen(false)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>Close</Text>
                  </Pressable>
                  <Pressable onPress={() => Linking.openURL(videoUrl)} style={[styles.smallBtn, { backgroundColor: '#334155' }]}>
                    <Text style={styles.smallBtnText}>Open in Browser</Text>
                  </Pressable>
                </View>

                {!!playErr && <Text style={[styles.errText, { marginTop: 6 }]}>{playErr}</Text>}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>


      <QuestionsModal
        visible={qOpen}
        onClose={() => setQOpen(false)}
        loading={qLoading}
        error={qError}
        topic={qTopic}
        questions={qList}
        pdfUrl={qPdfUrl}
      />


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.panelBg,
    borderRadius: 12,
    padding: S.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
    }),
  },

  h1: { color: C.text, fontSize: 16, fontWeight: '700' },

  section: { marginTop: S.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: '800' },

  list: { marginTop: S.xs },
  listItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemPressed: { backgroundColor: 'rgba(14,165,233,0.10)' },
  listItemText: { color: C.text, fontSize: 14 },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.accent,
  },
  badgeMuted: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.25)',
  },

  buttonPrimary: {
    alignSelf: 'flex-start',
    marginTop: S.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  buttonPrimaryText: { color: C.bg, fontWeight: '700' },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  // Modal styles
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: S.md,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: S.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  modalTitle: { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },

  centerBox: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  muted: { color: C.label, marginTop: 6 },
  errText: { color: C.danger },

  smallBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  smallBtnText: { color: C.bg, fontWeight: '700' },
});
