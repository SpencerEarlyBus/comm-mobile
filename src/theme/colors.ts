// src/theme/colors.ts
export const COLORS = {
  accent: '#0ea5e9',
  text: '#e2e8f0',
  label: '#cbd5e1',
  track: 'rgba(148,163,184,0.25)',
  ringBg: 'rgba(15,23,42,0.85)',

  activeArc: '#ffffff',
  activeLabelBg: '#ffffff',
  activeLabelText: '#0b1220',

  bg: '#0b1220',
  card: '#101827',
  border: 'rgba(148,163,184,0.25)',
  danger: '#ef4444',
  success: '#10b981',
  white: '#ffffff',
  black: '#000000',

  // New tokens for consistency
  bgGlass: 'rgba(15, 23, 42, 0.94)',        // footer bar glass
  headerGlass: 'rgba(15, 23, 42, 0.75)',    // sticky dials bar
} as const;

export type ColorKey = keyof typeof COLORS;
