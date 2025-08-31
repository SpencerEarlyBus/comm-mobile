// src/features/sessions/utils/errorMsg.ts

/**
 * Normalize unknown error-like values into a human-readable string.
 * Handles plain strings, Error objects, expo-video PlayerError, etc.
 */
export function errorMsg(e: unknown): string {
  if (e == null) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message || e.toString();

  try {
    const maybe: any = e;
    if (typeof maybe.message === 'string') return maybe.message;
    if (typeof maybe.code === 'string') return `${maybe.code}: ${maybe.message || 'Unknown error'}`;
    return JSON.stringify(maybe);
  } catch {
    return 'Unknown error';
  }
}
