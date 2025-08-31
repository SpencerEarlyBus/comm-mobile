import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';

export function useSessionTextB(sessionId: string, enabled = true) {
  const { fetchWithAuth } = useAuth();
  const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.api.domain';

  // Step 1: presign URL
  const urlQuery = useQuery({
    queryKey: ['mobile-sessions', sessionId, 'json-b-url'],
    enabled,
    queryFn: async (): Promise<string> => {
      const res = await fetchWithAuth(`${API_BASE}/mobile/sessions/${sessionId}/json-b-url`);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`Failed to get text URL: ${res.status} ${t}`);
      }
      const j = await res.json();
      return String(j.url || '');
    },
  });

  // Step 2: fetch text body
  const textQuery = useQuery({
    queryKey: ['mobile-sessions', sessionId, 'json-b'],
    enabled: enabled && !!urlQuery.data,
    queryFn: async (): Promise<string> => {
      const res = await fetch(urlQuery.data!, { method: 'GET' });
      if (!res.ok) throw new Error(`Fetch text failed: ${res.status} ${res.statusText}`);
      return res.text();
    },
  });

  return {
    url: urlQuery.data,
    isLoading: urlQuery.isLoading || textQuery.isLoading,
    isError: urlQuery.isError || textQuery.isError,
    error: (urlQuery.error || textQuery.error) as Error | null,
    text: textQuery.data,
    refetch: async () => {
      await urlQuery.refetch();
      await textQuery.refetch();
    },
  };
}
