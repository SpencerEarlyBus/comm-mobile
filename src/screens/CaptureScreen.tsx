// src/screens/CaptureScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Alert, StatusBar } from 'react-native';
import { CameraView } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/navRef';

type Props = NativeStackScreenProps<RootStackParamList, 'Capture'>;

const DEFAULT_MAX_MS = 60_000;

export default function CaptureScreen({ route, navigation }: Props) {
  const camRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const settledRef = useRef(false);

  const nudgeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxMs = route.params?.maxMs ?? DEFAULT_MAX_MS;
  const facing = route.params?.facing === 'back' ? 'back' : 'front';

  const clearTimers = () => {
    if (nudgeRef.current) { clearTimeout(nudgeRef.current); nudgeRef.current = null; }
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
  };

  const settleOnce = (fn: () => void) => {
    if (settledRef.current) return;
    settledRef.current = true;
    clearTimers();
    fn();
  };

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      // wait for onCameraReady
      let tries = 0;
      while (mounted && !ready && tries < 120) { // ~6s
        await new Promise(r => setTimeout(r, 50));
        tries++;
      }
      if (!mounted) return;

      const cam = camRef.current as any;
      if (!ready || !cam) {
        settleOnce(() => {
          Alert.alert('Camera initialization timeout');
          navigation.goBack();
        });
        return;
      }

      // Log what this ref actually exposes (helps us know the code path used)
      console.log('[Capture] methods', {
        startRecording: typeof cam.startRecording,
        stopRecording: typeof cam.stopRecording,
        recordAsync: typeof cam.recordAsync,
      });

      const hasStart = typeof cam.startRecording === 'function';
      const hasStop  = typeof cam.stopRecording === 'function';
      const hasAsync = typeof cam.recordAsync === 'function';

      try {
        if (hasStart) {
          // Preferred path when available
          cam.startRecording({
            maxDuration: Math.ceil(maxMs / 1000),
            onRecordingFinished: (video: { uri?: string }) => {
              settleOnce(() => {
                if (video?.uri) {
                  navigation.replace('Recorder', { recordedUri: video.uri });
                } else {
                  navigation.goBack();
                }
              });
            },
            onRecordingError: (err: any) => {
              const msg = err?.message ?? String(err);
              settleOnce(() => {
                Alert.alert('Recording error', msg);
                navigation.goBack();
              });
            },
          });

          // Nudge stop slightly after the limit in case native didn’t auto-stop
          if (hasStop) {
            nudgeRef.current = setTimeout(() => {
              try { cam.stopRecording(); } catch {}
            }, maxMs + 400);
          }

          // Final watchdog in case neither callback fires
          watchdogRef.current = setTimeout(() => {
            settleOnce(() => {
              console.log('[Capture] watchdog fired (callback branch)');
              Alert.alert('Recording did not finalize; please try again.');
              navigation.goBack();
            });
          }, maxMs + 6000);

          return; // callbacks will settle
        }

        if (hasAsync) {
          // recordAsync path
          const p: Promise<{ uri?: string }> = cam.recordAsync({
            // Some SDKs ignore maxDuration here; we still schedule our own stop.

            maxDuration: Math.ceil(maxMs / 1000),
          });

          if (hasStop) {
            nudgeRef.current = setTimeout(() => {
              try { cam.stopRecording(); } catch {}
            }, maxMs + 400);
          } else {
            // If we can't stop programmatically, we still rely on maxDuration,
            // but keep the watchdog as a backstop.
            nudgeRef.current = null;
          }

          watchdogRef.current = setTimeout(() => {
            console.log('[Capture] watchdog fired (promise branch)', { elapsed: maxMs + 6000 });
            settleOnce(() => {
              Alert.alert('Recording did not finalize; please try again.');
              navigation.goBack();
            });
          }, maxMs + 6000);

          const vid = await p;
          settleOnce(() => {
            if (vid?.uri) {
              navigation.replace('Recorder', { recordedUri: vid.uri });
            } else {
              navigation.goBack();
            }
          });
          return;
        }

        // Neither API exists — very old/new mismatch. Bail gracefully.
        settleOnce(() => {
          Alert.alert(
            'Unsupported camera API',
            'This version of expo-camera does not expose a recording method on CameraView.'
          );
          navigation.goBack();
        });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        settleOnce(() => {
          Alert.alert('Recording error', msg);
          navigation.goBack();
        });
      }
    };

    start();
    return () => {
      mounted = false;
      clearTimers();
      try { (camRef.current as any)?.stopRecording?.(); } catch {}
    };
  }, [ready, navigation, maxMs]);

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <CameraView
        ref={camRef}
        style={{ flex: 1 }}
        mode="video"
        facing={facing}
        onCameraReady={() => setReady(true)}
      />
    </View>
  );
}
