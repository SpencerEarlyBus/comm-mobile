declare module 'expo-camera/legacy' {
  import * as React from 'react';
  import { CameraProps } from 'expo-camera';

  // Use `any` for now – Expo hasn’t published official typings for the legacy entrypoint
  export class Camera extends React.Component<CameraProps> {}
  export const CameraType: any;
  export const VideoQuality: any;
}