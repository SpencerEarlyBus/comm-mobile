// hooks/usePresignedAnnotatedUrl.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

/**
 * Fetches a short-lived presigned URL for the annotated video.
 * Only runs when (sessionId && enabled) and we recommend refetching when the box is expanded.
 */
export function usePresignedAnnotatedUrl(sessionId?: string, enabled = true) {
  const { fetchWithAuth } = useAuth();

  return useQuery<string, Error>({
    queryKey: ['mobile-session-annotated-url', sessionId] as const,
    enabled: !!sessionId && enabled,
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/mobile/sessions/${sessionId}/annotated-video-url`);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`annotated-video-url ${res.status}: ${t}`);
      }
      const j = await res.json();
      return String(j.url || '');
    },
    // short-lived URLs: never cache as fresh; always refetch on expand
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
