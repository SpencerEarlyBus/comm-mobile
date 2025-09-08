// global.d.ts
import 'expo-camera';

declare module 'expo-camera' {
  interface CameraView {
    /**
     * Present at runtime on expo-camera 14+ / SDK 51+, but types lag behind.
     */
    startRecording?: (options: {
      maxDuration?: number;
      onRecordingFinished: (video: { uri?: string }) => void;
      onRecordingError: (error: unknown) => void;
    }) => void;
  }
}
