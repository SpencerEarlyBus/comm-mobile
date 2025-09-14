// components/QuestionsModal.tsx
import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { C, S } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
  topic?: string;
  questions?: string[];
  pdfUrl?: string | null;
};

export default function QuestionsModal({
  visible,
  onClose,
  loading = false,
  error = null,
  topic,
  questions = [],
  pdfUrl,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => { /* swallow */ }}>
          <Text style={styles.title}>Generated Questions</Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.muted}>Analyzing document…</Text>
            </View>
          ) : error ? (
            <>
              <Text style={styles.error}>{error}</Text>
              <Text style={styles.muted}>Try again in a moment.</Text>
            </>
          ) : (
            <>
              {!!topic && <Text style={styles.topic}>Topic: <Text style={{ fontWeight: '800', color: C.text }}>{topic}</Text></Text>}
              {questions.length > 0 ? (
                <View style={{ marginTop: S.sm }}>
                  {questions.map((q, i) => (
                    <View key={i} style={{ flexDirection: 'row', marginTop: i ? 8 : 0 }}>
                      <Text style={styles.bullet}>{i + 1}.</Text>
                      <Text style={styles.q}>{q}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>No questions returned.</Text>
              )}

              <View style={{ flexDirection: 'row', columnGap: 10, marginTop: S.md }}>
                {!!pdfUrl && (
                  <Pressable onPress={() => Linking.openURL(pdfUrl)} style={[styles.btn, { backgroundColor: '#334155' }]}>
                    <Text style={styles.btnText}>Open PDF</Text>
                  </Pressable>
                )}
                <Pressable onPress={onClose} style={styles.btn}>
                  <Text style={styles.btnText}>Close</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    padding: S.md, justifyContent: 'center'
  },
  card: {
    backgroundColor: C.card, borderRadius: 12, padding: S.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
  },
  title: { color: C.text, fontSize: 16, fontWeight: '800' },
  topic: { color: C.label, marginTop: S.xs },
  bullet: { color: C.label, width: 18, fontWeight: '800' },
  q: { color: C.text, flex: 1 },
  center: { alignItems: 'center', paddingVertical: 10, gap: 6 },
  muted: { color: C.label },
  error: { color: C.danger, marginTop: S.xs },
  btn: { backgroundColor: C.accent, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { color: C.bg, fontWeight: '700' },
});
