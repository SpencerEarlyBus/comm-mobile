// src/navigation/navRef.ts
import { createNavigationContainerRef } from '@react-navigation/native';

// 1) Keep this in sync with your <Stack.Screen name="..."> list
export type RootStackParamList = {
  Home: undefined;
  Sessions: undefined;
  Recorder: undefined;
  Profile: undefined;
  Leaderboard: undefined; 
  TopicsToday: undefined;  
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// 2) Type-safe helpers
export function navGo<T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T]
) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

export function navReplace<T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T]
) {
  if (navigationRef.isReady()) {
    // @ts-expect-error replace is available via any; fine for a tiny helper
    navigationRef.dispatch({
      ...((navigationRef as any).replace
        ? (state: any) => (navigationRef as any).replace(name, params)
        : { type: 'REPLACE', payload: { name, params } }),
    });
  }
}

export function currentRouteName() {
  return navigationRef.getCurrentRoute()?.name as keyof RootStackParamList | undefined;
}
