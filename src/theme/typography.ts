import { StyleSheet } from 'react-native';
import { COLORS as C } from './colors';

export const T = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '700', color: C.text },
  body: { fontSize: 14, color: C.text },
  subtle: { fontSize: 12, color: C.subtext },
  semibold: { fontWeight: '700', color: C.text },
  buttonPrimary: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: C.accent },
  buttonPrimaryText: { color: C.bg, fontWeight: '700' },
  buttonSecondary: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f1f5f9' },
  buttonSecondaryText: { color: '#0f172a', fontWeight: '700' },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});
