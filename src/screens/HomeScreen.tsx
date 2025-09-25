// src/screens/HomeScreen.tsx
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  InputAccessoryView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/MobileAuthContext';
import { useNavigation } from '@react-navigation/native';
import { C, S, R } from '../theme/tokens';

type Mode = 'login' | 'signup';

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {
    authReady,
    isAuthenticated,
    user,
    loginWithPassword,
    signupWithPassword,
    logout,
  } = useAuth() as any;

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // refs for "Next" key flow
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const accessoryId = useMemo(() => 'authAccessory', []);

  const validate = () => {
    setError(null);
    const e = email.trim();
    if (!e) return 'Email is required';
    if (!/^\S+@\S+\.\S+$/.test(e)) return 'Enter a valid email';
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  const onLogin = async () => {
    const err = validate();
    if (err) return setError(err);
    try {
      setBusy(true);
      const ok = await loginWithPassword(email.trim(), password);
      if (!ok) {
        setError('Incorrect email or password.');
        return;
      }
      nav.reset({ index: 0, routes: [{ name: 'Sessions' }] });
    } catch (e: any) {
      Alert.alert('Login failed', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const onSignup = async () => {
    const err = validate();
    if (err) return setError(err);
    try {
      setBusy(true);
      const ok = await signupWithPassword(email.trim(), password, username.trim());
      if (!ok) {
        setError('Unable to create account.');
        return;
      }
      nav.reset({ index: 0, routes: [{ name: 'Sessions' }] });
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const submit = mode === 'login' ? onLogin : onSignup;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      {/* Subtle dark/blue gradient */}
      <LinearGradient
        colors={[C.bg, C.panelBg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 48 + insets.top : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: 48 + insets.top, paddingBottom: 24 + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'interactive'}
          >
            <View style={styles.container}>
              <Image
                source={require('../../assets/Lectaura_White.png')}
                resizeMode="contain"
                style={styles.logo}
              />

              {/* Card */}
              <View style={styles.card}>
                {authReady && isAuthenticated ? (
                  <>
                    <Text style={styles.cardText}>
                      Signed in as <Text style={styles.bold}>{user?.email}</Text>
                    </Text>
                    <View style={styles.sp12} />
                    <PrimaryButton
                      label="Continue to Sessions"
                      onPress={() => nav.navigate('Sessions')}
                      disabled={busy}
                    />
                    <View style={styles.sp10} />
                    <SecondaryButton
                      label="Log out"
                      onPress={async () => {
                        setBusy(true);
                        try {
                          await logout();
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy}
                    />
                  </>
                ) : (
                  <>
                    {/* Tabs */}
                    <View style={styles.tabsRow}>
                      <TabButton
                        active={mode === 'login'}
                        label="Log in"
                        onPress={() => {
                          setMode('login');
                          setError(null);
                        }}
                      />
                      <View style={styles.spH8} />
                      <TabButton
                        active={mode === 'signup'}
                        label="Sign up"
                        onPress={() => {
                          setMode('signup');
                          setError(null);
                        }}
                      />
                    </View>

                    {/* Error */}
                    {!!error && (
                      <>
                        <Text style={styles.errorText}>{error}</Text>
                        <View style={styles.sp10} />
                      </>
                    )}

                    {/* Form */}
                    <View>
                      {mode === 'signup' && (
                        <>
                          <TextInput
                            ref={usernameRef}
                            placeholder="Username (optional)"
                            placeholderTextColor={C.subtext}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            textContentType="username"
                            style={styles.input}
                            inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
                            returnKeyType="next"
                            blurOnSubmit={false}
                            onSubmitEditing={() => emailRef.current?.focus()}
                          />
                          <View style={styles.sp10} />
                        </>
                      )}
                      <TextInput
                        ref={emailRef}
                        placeholder="Email"
                        placeholderTextColor={C.subtext}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="emailAddress"
                        style={styles.input}
                        inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => passwordRef.current?.focus()}
                      />
                      <View style={styles.sp10} />

                      {/* Password field with show/hide */}
                      <View style={styles.pwdRow}>
                        <TextInput
                          ref={passwordRef}
                          placeholder="Password"
                          placeholderTextColor={C.subtext}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPwd}
                          autoCapitalize="none"
                          autoCorrect={false}
                          textContentType="password"
                          style={[styles.input, styles.pwdInput]}
                          inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
                          returnKeyType="done"
                          blurOnSubmit
                          onSubmitEditing={submit}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={showPwd ? 'Hide password' : 'Show password'}
                          onPress={() => setShowPwd((s) => !s)}
                          style={({ pressed }) => [styles.eyeBtn, pressed && styles.eyeBtnPressed]}
                        >
                          <Text style={styles.eyeText}>{showPwd ? 'Hide' : 'Show'}</Text>
                        </Pressable>
                      </View>

                      <View style={styles.sp12} />

                      {/* Submit + spinner */}
                      {busy ? (
                        <View style={styles.spinnerWrap}>
                          <ActivityIndicator color={C.white} />
                        </View>
                      ) : (
                        <PrimaryButton
                          label={mode === 'login' ? 'Log in' : 'Sign up'}
                          onPress={submit}
                          disabled={busy}
                        />
                      )}

                      <View style={styles.sp10} />
                      <Text style={styles.hintText}>
                        By continuing you agree to our Terms and Privacy Policy.
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* iOS keyboard accessory */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={accessoryId}>
          <View style={styles.accessoryBar}>
            <Pressable onPress={Keyboard.dismiss} hitSlop={8} style={styles.doneBtn}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabBtn,
        active ? styles.tabBtnActive : styles.tabBtnInactive,
      ]}
    >
      <Text
        style={[
          styles.tabText,
          active ? styles.tabTextActive : styles.tabTextInactive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        pressed && styles.primaryBtnPressed,
        disabled && { opacity: 0.6 },
      ]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondaryBtn,
        pressed && styles.secondaryBtnPressed,
        disabled && { opacity: 0.6 },
      ]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  container: { width: '100%', alignItems: 'center' },
  logo: { width: '85%', height: 120, marginBottom: 12 },

  card: {
    marginTop: 28,
    width: '100%',
    backgroundColor: C.panelBg,
    borderColor: C.border,
    borderWidth: 1,
    padding: 18,
    borderRadius: R.sheet,
  },
  cardText: { color: C.text, fontSize: 16 },
  bold: { fontWeight: '700', color: C.text },

  tabsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: S.lg, alignItems: 'center' },
  tabBtnActive: { backgroundColor: C.white },
  tabBtnInactive: { borderWidth: 1, borderColor: C.border },
  tabText: { fontWeight: '700' },
  tabTextActive: { color: C.black },
  tabTextInactive: { color: C.text },

  input: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(16,24,39,0.6)', // translucent on panel
    color: C.text,
    padding: 12,
    borderRadius: S.lg,
  },

  pwdRow: { flexDirection: 'row', alignItems: 'center' },
  pwdInput: { flex: 1, paddingRight: 64 },
  eyeBtn: {
    position: 'absolute',
    right: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: S.md,
  },
  eyeBtnPressed: { backgroundColor: 'rgba(148,163,184,0.15)' },
  eyeText: { color: C.text, fontWeight: '600' },

  primaryBtn: {
    paddingVertical: 14,
    borderRadius: S.xl,
    backgroundColor: C.white,
    alignItems: 'center',
  },
  primaryBtnPressed: { backgroundColor: 'rgba(255,255,255,0.85)' },
  primaryText: { color: C.black, fontWeight: '700', fontSize: 16 },

  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: S.xl,
    borderWidth: 2,
    borderColor: C.text,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  secondaryBtnPressed: { backgroundColor: 'rgba(148,163,184,0.15)' },
  secondaryText: { color: C.text, fontWeight: '700', fontSize: 16 },

  spinnerWrap: { paddingVertical: 8, alignItems: 'center' },

  errorText: {
    color: C.text,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: C.danger,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: S.md,
  },

  hintText: { color: C.subtext, fontSize: 12, textAlign: 'center' },

  // spacers
  sp10: { height: 10 },
  sp12: { height: 12 },
  spH8: { width: 8 },

  // iOS accessory
  accessoryBar: {
    backgroundColor: C.headerGlass,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: 8,
    alignItems: 'flex-end',
  },
  doneBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  doneText: { color: C.accent, fontWeight: '600' },
});
