// src/hooks/useSessionInterpretabilityTxt.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';

export function useSessionInterpretabilityTxt(sessionId: string, enabled = true) {
  const { fetchWithAuth } = useAuth();
  const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.api.domain';

  // 1) Get presigned URL
  const urlQuery = useQuery({
    queryKey: ['mobile-sessions', sessionId, 'interpretability-url'],
    enabled,
    queryFn: async (): Promise<string> => {
      const res = await fetchWithAuth(`${API_BASE}/mobile/sessions/${sessionId}/interpretability-url`);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`Failed to get interpretability URL: ${res.status} ${t}`);
      }
      const j = await res.json();
      return String(j.url || '');
    },
  });

  // 2) Fetch raw text
  const textQuery = useQuery({
    queryKey: ['mobile-sessions', sessionId, 'interpretability-txt'],
    enabled: enabled && !!urlQuery.data,
    queryFn: async (): Promise<string> => {
      const res = await fetch(urlQuery.data!, { method: 'GET' });
      if (!res.ok) throw new Error(`Fetch interpretability text failed: ${res.status} ${res.statusText}`);
      return res.text();
    },
  });

  return {
    url: urlQuery.data,
    text: textQuery.data,
    isLoading: urlQuery.isLoading || textQuery.isLoading,
    isError: urlQuery.isError || textQuery.isError,
    error: (urlQuery.error || textQuery.error) as Error | null,
    refetch: async () => {
      await urlQuery.refetch();
      await textQuery.refetch();
    },
  };
}
