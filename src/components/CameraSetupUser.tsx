import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { CameraView } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../theme/colors';

type Props = {
  onDone: (calibration?: {
    safeMarginsPct: { top: number; bottom: number; sides: number };
    checklist: { feet: boolean; headroom: boolean; hands: boolean };
  }) => void;
  onCancel: () => void;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// “Safe frame” margins as percentages of the *visible* preview (post safe-area)
const SAFE = { top: 0.07, bottom: 0.10, sides: 0.06 };

export default function CameraSetupPanel({ onDone, onCancel }: Props) {
  const camRef = useRef<CameraView | null>(null);
  const insets = useSafeAreaInsets();

  // Manual checklist
  const [feet, setFeet] = useState(false);
  const [headroom, setHeadroom] = useState(false);
  const [hands, setHands] = useState(false);

  // UX helpers
  const [showGrid, setShowGrid] = useState(true);
  const [showGhost, setShowGhost] = useState(true);

  const canFinish = feet && headroom && hands;

  useEffect(() => {
    const t = setTimeout(() => setShowGhost(false), 12000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.root}>
      {/* Hide OS status bar while calibrating */}
      <StatusBar hidden animated />

      <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="front" />



      {/* Safe frame respects safe-area insets */}
      <SafeFrameOverlay showGrid={showGrid} showGhost={showGhost} insets={insets} />

      {/* Bottom checklist/card floats above home indicator */}
      <View style={[styles.bottomCard, { paddingBottom: 12 + insets.bottom }]}>
        <Text style={styles.cardTitle}>Quick checks</Text>

        <CheckRow
          label="Legs visible"
          value={feet}
          onToggle={() => setFeet((v) => !v)}
        />
        <CheckRow
          label="Headroom visible (a little space above your head)"
          value={headroom}
          onToggle={() => setHeadroom((v) => !v)}
        />
        <CheckRow
          label="Gesture with you elbows close to your torso — hands fit inside the box"
          value={hands}
          onToggle={() => setHands((v) => !v)}
        />

        <View style={styles.row}>
          <Pressable onPress={() => setShowGrid((v) => !v)} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>{showGrid ? 'Hide grid' : 'Show grid'}</Text>
          </Pressable>
          <Pressable onPress={() => setShowGhost((v) => !v)} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>{showGhost ? 'Hide guide' : 'Show guide'}</Text>
          </Pressable>
        </View>

        <View style={{ height: 8 }} />

        <View style={styles.row}>
          <Pressable onPress={onCancel} style={[styles.actionBtn, { backgroundColor: COLORS.card }]}>
            <Text style={[styles.actionText, { color: COLORS.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              onDone({
                safeMarginsPct: SAFE,
                checklist: { feet, headroom, hands },
              })
            }
            disabled={!canFinish}
            style={[
              styles.actionBtn,
              { backgroundColor: canFinish ? COLORS.accent : `${COLORS.accent}66` },
            ]}
          >
            <Text style={styles.actionText}>Looks good</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CheckRow({
  label,
  value,
  onToggle,
}: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.9 }]}>
      <View style={[styles.checkbox, value && styles.checkboxOn]} />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

function SafeFrameOverlay({
  showGrid,
  showGhost,
  insets,
}: {
  showGrid: boolean;
  showGhost: boolean;
  insets: { top: number; bottom: number; left: number; right: number };
}) {
  // visible preview area after accounting for safe areas
  const visibleW = SCREEN_W - insets.left - insets.right;
  const visibleH = SCREEN_H - insets.top - insets.bottom;

  // compute safe-frame rect within the visible area
  const left = insets.left + SAFE.sides * visibleW;
  const right = SCREEN_W - insets.right - SAFE.sides * visibleW;
  const top = insets.top + SAFE.top * visibleH;
  const bottom = insets.top + visibleH - SAFE.bottom * visibleH;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* darken outside safe frame */}
      <View style={[styles.mask, { top: 0, left: 0, right: 0, height: top }]} />
      <View style={[styles.mask, { top, left: 0, width: left, height: bottom - top }]} />
      <View style={[styles.mask, { top, right: 0, width: SCREEN_W - right, height: bottom - top }]} />
      <View style={[styles.mask, { bottom: 0, left: 0, right: 0, height: SCREEN_H - bottom }]} />

      {/* safe frame border */}
      <View
        style={[
          styles.safeFrame,
          { position: 'absolute', top, left, width: right - left, height: bottom - top },
        ]}
      >
        {showGrid && (
          <>
            {/* vertical thirds */}
            <View style={[styles.gridLine, { left: '33%' }]} />
            <View style={[styles.gridLine, { left: '66%' }]} />
            {/* horizontal thirds */}
            <View style={[styles.gridLineH, { top: '33%' }]} />
            <View style={[styles.gridLineH, { top: '66%' }]} />
          </>
        )}

        {showGhost && (
          <View style={styles.ghostWrap}>
            {/* a super simple “ghost” — head/torso/legs proportions */}
            <View style={styles.ghostHead} />
            <View style={styles.ghostTorso} />
            <View style={styles.ghostLegs} />
            <View style={styles.ghostArms} />
          </View>
        )}
      </View>

      {/* tiny captions positioned relative to computed frame */}
      <Text style={[styles.tip, { top: top - 22, left: left + 6 }]}>Prop up your phone such that your body is in frame</Text>
      <Text style={[styles.tip, { top: bottom + 6, left: left + 6 }]}>Feet inside frame</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.black },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  title: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  subtitle: { color: COLORS.white, opacity: 0.9, marginTop: 4 },

  mask: { backgroundColor: 'rgba(0,0,0,0.45)', position: 'absolute' },

  safeFrame: {
    borderWidth: 2,
    borderColor: COLORS.white,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  gridLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },

  ghostWrap: { position: 'absolute', left: '50%', top: '10%', width: 2, height: '80%', transform: [{ translateX: -1 }] },
  ghostHead: {
    position: 'absolute',
    top: 0, left: -18, width: 36, height: 36, borderRadius: 18,
    borderColor: 'rgba(255,255,255,0.6)', borderWidth: 2,
  },
  ghostTorso: {
    position: 'absolute',
    top: 36, left: -2, width: 4, height: '33%',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  ghostArms: {
    position: 'absolute',
    top: 64, left: -60, right: -60, height: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  ghostLegs: {
    position: 'absolute',
    bottom: 0, left: -16, right: -16, height: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  bottomCard: {
    position: 'absolute',
    left: 12, right: 12, bottom: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardTitle: { color: COLORS.white, fontWeight: '800', marginBottom: 6 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: COLORS.white },
  checkboxOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkLabel: { color: COLORS.white, flex: 1, fontWeight: '700' },

  row: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', marginTop: 8 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  secondaryText: { color: COLORS.white, fontWeight: '800' },

  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionText: { color: COLORS.white, fontWeight: '800' },

  tip: {
    position: 'absolute',
    color: COLORS.white,
    fontSize: 12,
    opacity: 0.9,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
