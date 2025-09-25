import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiBase = process.env.EXPO_PUBLIC_API_BASE ?? '';

  return {
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

    splash: { image: './assets/splash-icon.png', resizeMode: 'contain', backgroundColor: '#ffffff' },

    ios: {
      bundleIdentifier: 'com.yourco.comm',
      buildNumber: '1',
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: 'We use the camera to record your presentation.',
        NSMicrophoneUsageDescription: 'We use the microphone to capture your audio.',
        NSPhotoLibraryUsageDescription: 'We access your photo library when you pick media.',
        NSPhotoLibraryAddUsageDescription: 'We save rendered media to your Photo Library.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      package: 'com.yourco.comm',
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#ffffff' },
      edgeToEdgeEnabled: true,
    },

    web: { favicon: './assets/favicon.png' },

    extra: {
      ...(config.extra ?? {}),
      apiBase,
      eas: {
        ...(config.extra?.eas ?? {}),
        projectId: '320404f1-d9e6-4194-a056-722e93498ab9',
      },
    },

    plugins: [
      'expo-secure-store',
      'expo-dev-client',
      'expo-camera',
      'expo-image-picker',
      'expo-file-system',
      'expo-video',
      'expo-updates',
    ],

    // ⬇️ Required for EAS Update (the CLI tried to add this for you)
    updates: {
      url: 'https://u.expo.dev/320404f1-d9e6-4194-a056-722e93498ab9',
      // You don't need requestHeaders for channels with EAS Update.
      // Build profile's "channel" in eas.json defines which updates the binary will pull.
    },
  };
};
