// hooks/usePresignedVideoUrl.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

export function usePresignedVideoUrl(sessionId?: string, enabled = true) {
  const { fetchWithAuth } = useAuth();

  return useQuery<string, Error>({
    queryKey: ['mobile-session-video-url', sessionId] as const,
    enabled: !!sessionId && enabled,
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/mobile/sessions/${sessionId}/video-url`);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`video-url ${res.status}: ${t}`);
      }
      const j = await res.json();
      return String(j.url || '');
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
