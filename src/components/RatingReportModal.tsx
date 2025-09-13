// features/sessions/components/RatingReportModal.tsx
import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import { C, S } from '../theme/tokens';

type RatingSnapshot =
  | {
      event: 'placement';
      leaderboard_tag?: string;
      leaderboard_name?: string;
      user_email?: string;
      session_id?: string;
      client_session_id?: string;
      overall_score?: number;
      rating: number;
      rating_history_len?: number;
      timestamp?: string;
    }
  | {
      event: 'update';
      leaderboard_tag?: string;
      leaderboard_name?: string;
      user_email?: string;
      session_id?: string;
      client_session_id?: string;
      overall_score?: number;
      prev_rating: number;
      new_rating: number;
      elo_delta: number;
      prev_average_score: number;
      new_average_score: number;
      prev_session_count: number;
      new_session_count: number;
      opponents_considered?: { user_email: string; rating: number; avg_score: number }[];
      timestamp?: string;
    }
  | Record<string, any>;

function parseLeaderboardInfo(li: any): RatingSnapshot | undefined {
  if (!li) return undefined;
  if (typeof li === 'object') return li as RatingSnapshot;
  if (typeof li === 'string') {
    const s = li.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try { return JSON.parse(s) as RatingSnapshot; } catch {}
    }
  }
  return undefined;
}

function formatDelta(n: number | undefined) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  return (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
}

export default function RatingReportModal({
  visible,
  info,
  onClose,
}: {
  visible: boolean;
  info?: any;          // can be object or JSON string
  onClose: () => void;
}) {
  const snapshot = parseLeaderboardInfo(info);
  const hasPlacement = snapshot?.event === 'placement';
  const hasUpdate = snapshot?.event === 'update';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => { /* swallow touch */ }}>
          <Text style={styles.h2}>Rating Report</Text>

          {!snapshot && (
            <Text style={[styles.body, { marginTop: 8 }]}>
              No rating update is available yet for this session.
            </Text>
          )}

          {!!snapshot && (
            <View style={{ marginTop: 8 }}>
              {!!snapshot.leaderboard_name && (
                <Text style={styles.body}>
                  <Text style={styles.semibold}>Leaderboard:</Text> {snapshot.leaderboard_name} ({snapshot.leaderboard_tag})
                </Text>
              )}

              {hasPlacement && (
                <>
                  <Text style={[styles.body, { marginTop: 6 }]}>
                    <Text style={styles.semibold}>Event:</Text> Placement
                  </Text>
                  <Text style={styles.body}>
                    <Text style={styles.semibold}>Starting rating:</Text> {(snapshot as any).rating}
                  </Text>
                  <Text style={styles.body}>
                    <Text style={styles.semibold}>Overall score:</Text> {(snapshot as any).overall_score}
                  </Text>
                </>
              )}

              {hasUpdate && (
                <>
                  <Text style={[styles.body, { marginTop: 6 }]}>
                    <Text style={styles.semibold}>Event:</Text> Update
                  </Text>
                  <Text style={styles.body}>
                    <Text style={styles.semibold}>Rating:</Text> {(snapshot as any).prev_rating} → {(snapshot as any).new_rating}{' '}
                    ({formatDelta((snapshot as any).elo_delta)})
                  </Text>
                  <Text style={styles.body}>
                    <Text style={styles.semibold}>Overall score:</Text> {(snapshot as any).overall_score}
                  </Text>
                  <Text style={styles.body}>
                    <Text style={styles.semibold}>Avg score:</Text> {(snapshot as any).prev_average_score} → {(snapshot as any).new_average_score}
                  </Text>
                  <Text style={styles.body}>
                    <Text style={styles.semibold}>Session count:</Text> {(snapshot as any).prev_session_count} → {(snapshot as any).new_session_count}
                  </Text>

                  {!!(snapshot as any).opponents_considered?.length && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.semibold}>Opponents considered:</Text>
                      {(snapshot as any).opponents_considered.map(
                        (o: any, idx: number) => (
                          <Text key={idx} style={styles.subtle}>
                            • {o.user_email} — {o.rating} ELO (avg {o.avg_score})
                          </Text>
                        )
                      )}
                    </View>
                  )}
                </>
              )}

              {!!snapshot.timestamp && (
                <Text style={[styles.subtle, { marginTop: 8 }]}>
                  {new Date(snapshot.timestamp).toLocaleString()}
                </Text>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Pressable onPress={onClose} style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPressed]}>
                  <Text style={styles.buttonPrimaryText}>Close</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '700', color: C.text },
  body: { fontSize: 14, color: C.text },
  subtle: { fontSize: 12, color: C.subtext },
  semibold: { fontWeight: '700', color: C.text },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: C.panelBg ?? '#0b1220',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },

  buttonPrimary: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: C.accent,
  },
  buttonPrimaryText: { color: C.bg, fontWeight: '700' },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});
