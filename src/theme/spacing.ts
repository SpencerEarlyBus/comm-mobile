export const S = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;
export type SpaceKey = keyof typeof S;
