// src/navigation/navRef.ts
import { createNavigationContainerRef } from '@react-navigation/native';

export type RootStackParamList = {
  Home: undefined;
  Sessions: undefined;
  Recorder: { recordedUri?: string; nonce?: number } | undefined; // ← add nonce?
  Profile: undefined;
  Leaderboard: undefined;
  TopicsToday: undefined;
  Capture: {
    maxMs?: number;
    facing?: 'front' | 'back';
  } | undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// safe helpers
export function navGo<T extends keyof RootStackParamList>(name: T): void;
export function navGo<T extends keyof RootStackParamList>(name: T, params: RootStackParamList[T]): void;
export function navGo(name: any, params?: any) {
  if (navigationRef.isReady()) navigationRef.navigate(name, params);
}

export function navReplace<T extends keyof RootStackParamList>(name: T): void;
export function navReplace<T extends keyof RootStackParamList>(name: T, params: RootStackParamList[T]): void;
export function navReplace(name: any, params?: any) {
  if (!navigationRef.isReady()) return;
  const anyRef = navigationRef as any;
  if (typeof anyRef.replace === 'function') anyRef.replace(name, params);
  else navigationRef.dispatch({ type: 'REPLACE', payload: { name, params } } as any);
}

export function currentRouteName() {
  return navigationRef.getCurrentRoute()?.name as keyof RootStackParamList | undefined;
}
