// src/screens/AuthedRecorderScreen.tsx
import React from 'react';
import RequireAuth from '../components/RequireAuth';
import RecorderScreen from './RecorderScreen';

export default function AuthedRecorderScreen() {
  return (
    <RequireAuth>
      <RecorderScreen />
    </RequireAuth>
  );
}