// src/screens/AuthedSessionsScreen.tsx
import React from 'react';
import RequireAuth from '../components/RequireAuth';
import SessionsScreen from './SessionsScreen';

export default function AuthedSessionsScreen() {
  return (
    <RequireAuth>
      <SessionsScreen />
    </RequireAuth>
  );
}