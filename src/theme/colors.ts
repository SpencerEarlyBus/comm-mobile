// src/theme/colors.ts
export const COLORS = {
  accent: '#0ea5e9',
  text: '#e2e8f0',
  label: '#cbd5e1',
  subtext: '#94a3b8',
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

  bgGlass: 'rgba(15, 23, 42, 0.94)',
  headerGlass: 'rgba(15, 23, 42, 0.75)',
  // add a dedicated panel color if you want it distinct from card:
  panel: '#0f172a',
} as const;

export type ColorKey = keyof typeof COLORS;
