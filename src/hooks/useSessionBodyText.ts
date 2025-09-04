// features/sessions/hooks/useSessionBodyText.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';

export function useSessionBodyText(sessionId: string, enabled = true) {
  const { fetchWithAuth } = useAuth();
  const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

  const urlQ = useQuery({
    queryKey: ['mobile-sessions', sessionId, 'body-url'],
    enabled,
    queryFn: async (): Promise<string> => {
      const res = await fetchWithAuth(`${API_BASE}/mobile/sessions/${sessionId}/body-url`);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`Failed to get body URL: ${res.status} ${t}`);
      }
      const j = await res.json();
      return String(j.url || '');
    },
  });

  const textQ = useQuery({
    queryKey: ['mobile-sessions', sessionId, 'body-text'],
    enabled: enabled && !!urlQ.data,
    queryFn: async (): Promise<string> => {
      const res = await fetch(urlQ.data!, { method: 'GET' });
      if (!res.ok) throw new Error(`Fetch body text failed: ${res.status} ${res.statusText}`);
      return res.text();
    },
  });

  return {
    url: urlQ.data,
    text: textQ.data,
    isLoading: urlQ.isLoading || textQ.isLoading,
    isError: urlQ.isError || textQ.isError,
    error: (urlQ.error || textQ.error) as Error | null,
    refetch: async () => { await urlQ.refetch(); await textQ.refetch(); },
  };
}
