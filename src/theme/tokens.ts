// src/theme/tokens.ts
import { COLORS } from './colors';

export const R = { card: 14, button: 10, sheet: 20 } as const;
export const S = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 } as const;

export const C = {
  // core surfaces
  bg: COLORS.bg,
  surface: COLORS.card,
  card: COLORS.card,
  cardLight: COLORS.white,
  panelBg: COLORS.panel,          // for drawers/modals

  // text
  text: COLORS.text,
  label: COLORS.label,            // ← added
  subtext: COLORS.subtext,

  // borders & accents
  border: COLORS.border,
  accent: COLORS.accent,

  // status colors
  warning: COLORS.danger,         // keep existing alias
  danger: COLORS.danger,          // ← added (used by some files)
  success: COLORS.success,        // ← useful elsewhere

  // utility colors
  white: COLORS.white,            // ← added
  black: COLORS.black,            // ← added
  track: COLORS.track,            // ← added for meters
  ringBg: COLORS.ringBg,          // ← added for dials
  activeArc: COLORS.activeArc,    // ← added for dials
  activeLabelBg: COLORS.activeLabelBg,
  activeLabelText: COLORS.activeLabelText,

  // glass
  bgGlass: COLORS.bgGlass,        // ← added
  headerGlass: COLORS.headerGlass // ← added
} as const;

// (optional) export a type if you want autocompletion on C.*
export type Tokens = typeof C;
