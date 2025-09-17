import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  name: 'Comm Mobile',
  slug: 'comm-mobile',
  scheme: 'comm',
  version: '1.0.0',
  runtimeVersion: { policy: 'appVersion' },

  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,

  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },

  ios: {
    bundleIdentifier: 'com.yourco.comm', // TODO: set your real bundle id
    buildNumber: '1',
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: 'We use the camera to record your presentation.',
      NSMicrophoneUsageDescription: 'We use the microphone to capture your audio.',
      NSPhotoLibraryUsageDescription: 'We access your photo library when you pick media.',
      NSPhotoLibraryAddUsageDescription: 'We save rendered media to your Photo Library.',
    },
  },

  android: {
    package: 'com.yourco.comm',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
  },

  web: {
    favicon: './assets/favicon.png',
  },

  extra: {
    apiBase: process.env.EXPO_PUBLIC_API_BASE, // keep using this in code
    // eas.projectId will be injected by `eas init`
  },

  plugins: [
    'expo-secure-store',
    'expo-dev-client',
    'expo-camera',
    'expo-image-picker',
    'expo-file-system',
    'expo-video',
    // (expo-av has no config plugin)
  ],

  updates: {
    requestHeaders: { 'expo-channel-name': 'production' }, // overridden per EAS profile
  }, 
}); 
