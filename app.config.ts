import 'dotenv/config';

export default {
  expo: {
    name: 'Comm Mobile',
    slug: 'comm-mobile',
    scheme: 'comm',
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: 'We use the camera to record your presentation.',
        NSMicrophoneUsageDescription: 'We use the microphone to capture your audio.',
      },
    },
    extra: {
      apiBase: process.env.EXPO_PUBLIC_API_BASE,
    },

    plugins: ['expo-video'],
  },
};