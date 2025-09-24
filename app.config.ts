import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiBase = process.env.EXPO_PUBLIC_API_BASE ?? '';


  let ats: Record<string, any> = {};
  if (apiBase.startsWith('http://')) {
    try {
      const { hostname } = new URL(apiBase);
      ats = {
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            [hostname]: {
              NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
              NSIncludesSubdomains: true,
            },
          },
        },
      };
    } catch {
      // Fallback (broad) if url parsing fails — fine for dev, remove for prod
      ats = { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } };
    }
  }

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

    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },

    ios: {
      bundleIdentifier: 'com.yourco.comm', // ← set your real bundle id
      buildNumber: '1',
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: 'We use the camera to record your presentation.',
        NSMicrophoneUsageDescription: 'We use the microphone to capture your audio.',
        NSPhotoLibraryUsageDescription: 'We access your photo library when you pick media.',
        NSPhotoLibraryAddUsageDescription: 'We save rendered media to your Photo Library.',
        ITSAppUsesNonExemptEncryption: false, // ← EAS requested this
        ...ats, // ← only present if apiBase is http://
      },
    },

    android: {
      package: 'com.yourco.comm',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      // Note: If you ever need cleartext (http://) on Android 9+, you’d set usesCleartextTraffic
      // via a build-properties plugin. Best to keep everything HTTPS instead.
    },

    web: { favicon: './assets/favicon.png' },

    extra: {
      ...(config.extra ?? {}),
      apiBase,
      eas: {
        ...(config.extra?.eas ?? {}),
        projectId: '320404f1-d9e6-4194-a056-722e93498ab9', // your EAS project ID
      },
    },

    plugins: [
      'expo-secure-store',
      'expo-dev-client',
      'expo-camera',
      'expo-image-picker',
      'expo-file-system',
      'expo-video',
    ],

    updates: {
      requestHeaders: { 'expo-channel-name': 'production' },
    },
  };
};
