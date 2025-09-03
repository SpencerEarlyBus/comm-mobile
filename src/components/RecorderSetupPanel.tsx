import React from 'react';
import { View, Text, TextInput, Switch, Pressable, StyleSheet, Button } from 'react-native';
import { COLORS } from '../theme/colors';

type FollowedBoard = { tag: string; name: string; diffLevel?: string | null };

type Props = {
  organization: string;
  setOrganization: (v: string) => void;

  leaderboardOptIn: boolean;
  setLeaderboardOptIn: (v: boolean) => void;

  granted: boolean;
  undetermined: boolean;

  onRequestPerms: () => void;
  onReady: () => void;
  readyDisabled: boolean;

  followedBoards: FollowedBoard[];
  selectedLeaderboardTag: string | null;
  setSelectedLeaderboardTag: (tag: string | null) => void;
};

export default function RecorderSetupPanel({
  organization, setOrganization,
  leaderboardOptIn, setLeaderboardOptIn,
  granted, undetermined,
  onRequestPerms, onReady, readyDisabled,
  followedBoards, selectedLeaderboardTag, setSelectedLeaderboardTag,
}: Props) {
  const hasFollows = followedBoards?.length > 0;

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>New recording</Text>
      <Text style={styles.sub}>Select a leaderboard to receive your topic, then press Ready.</Text>

      {/* Leaderboard per-session toggle + chips */}
      <View style={{ gap: 8, marginTop: 6 }}>
        <View style={styles.row}>
          <Text style={styles.labelInline}>Include on leaderboard</Text>
          <Switch value={leaderboardOptIn} onValueChange={setLeaderboardOptIn} />
        </View>

        {leaderboardOptIn ? (
          hasFollows ? (
            <>
              <Text style={styles.label}>Leaderboard</Text>
              <View style={styles.boardRow}>
                {followedBoards.map((b) => {
                  const active = selectedLeaderboardTag === b.tag;
                  return (
                    <Pressable
                      key={b.tag}
                      onPress={() => setSelectedLeaderboardTag(active ? null : b.tag)}
                      style={({ pressed }) => [
                        styles.boardPill,
                        active && styles.boardPillActive,
                        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                      ]}
                    >
                      <Text style={[styles.boardText, active && styles.boardTextActive]}>
                        {b.name}
                      </Text>
                      {!!b.diffLevel && (
                        <Text style={[styles.boardSub, active && styles.boardSubActive]}>
                          {b.diffLevel}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.note}>
              You’re not following any leaderboards yet. Follow some in Explore to enable this.
            </Text>
          )
        ) : null}
      </View>

      {/* Organization (optional) 
      <Text style={[styles.label, { marginTop: 18 }]}>Organization (optional)</Text>
      <TextInput
        placeholder="e.g., Comm Labs"
        placeholderTextColor={COLORS.label}
        value={organization}
        onChangeText={setOrganization}
        style={styles.input}
      />
      */}

      {!granted && (
        <View style={{ marginTop: 14, gap: 8 }}>
          <Text style={styles.note}>Camera & microphone permissions are required.</Text>
          <Button
            title={undetermined ? 'Allow Camera & Microphone' : 'Open Settings'}
            onPress={onRequestPerms}
            color={COLORS.accent}
          />
        </View>
      )}

      <View style={{ height: 12 }} />
      <Pressable
        onPress={onReady}
        disabled={readyDisabled}
        style={({ pressed }) => [
          styles.readyBtn,
          readyDisabled && { opacity: 0.5 },
          pressed && !readyDisabled && { transform: [{ scale: 0.98 }], opacity: 0.96 },
        ]}
      >
        <Text style={styles.readyText}>{readyDisabled ? 'Please wait…' : 'Ready'}</Text>
      </Pressable>
    </View>
  );
}

const PILL = 14;

const styles = StyleSheet.create({
  root: {
    padding: 16, paddingBottom: 120, gap: 10,
    backgroundColor: COLORS.bg, flex: 1,
  },
  h1: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  sub: { color: COLORS.label, marginBottom: 10 },
  label: {
    fontSize: 12, color: COLORS.label,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2,
  },
  labelInline: { fontSize: 14, color: COLORS.text, fontWeight: '800' },

  // leaderboard chips
  boardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  boardPill: {
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: COLORS.card,
  },
  boardPillActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  boardText: { color: COLORS.text, fontWeight: '800' },
  boardTextActive: { color: COLORS.activeLabelText },
  boardSub: { color: COLORS.label, fontSize: 11, marginTop: 2, fontWeight: '700' },
  boardSubActive: { color: COLORS.activeLabelText },

  input: {
    borderWidth: 1, borderColor: COLORS.border, padding: 12,
    borderRadius: PILL, color: COLORS.text, backgroundColor: COLORS.card,
  },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  note: { color: COLORS.label, fontSize: 13 },

  readyBtn: {
    marginTop: 4, backgroundColor: COLORS.accent, borderRadius: 999,
    paddingVertical: 14, alignItems: 'center',
  },
  readyText: { color: COLORS.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
