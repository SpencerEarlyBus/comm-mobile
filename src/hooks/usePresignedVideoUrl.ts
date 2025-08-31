// hooks/usePresignedVideoUrl.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.api.domain';

export function usePresignedVideoUrl(sessionId?: string, enabled: boolean = true) {
  const { fetchWithAuth } = useAuth();

  return useQuery({
    queryKey: ['mobile-session-video-url', sessionId],
    enabled: !!sessionId && enabled,
    queryFn: async () => {
      const url = `${API_BASE}/mobile/sessions/${sessionId}/video-url`;
      const res = await fetchWithAuth(url);
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('video-url parse error');
      }
      return json.url as string;
    },
    staleTime: 1000 * 60 * 10,
  });
}