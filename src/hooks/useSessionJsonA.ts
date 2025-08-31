// features/sessions/hooks/useSessionJsonA.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';

type JsonA = unknown; // or a typed shape if you know it

export function useSessionJsonA(sessionId: string, enabled = true) {
  const { fetchWithAuth } = useAuth();

  // Step 1: get presigned URL
  const presignQuery = useQuery({
    queryKey: ['mobile-sessions', sessionId, 'json-a-url'],
    enabled,
    queryFn: async (): Promise<string> => {
      const res = await fetchWithAuth(
        `${process.env.EXPO_PUBLIC_API_BASE || 'https://your.api.domain'}/mobile/sessions/${sessionId}/json-a-url`
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to get JSON URL: ${res.status} ${text}`);
      }
      const j = await res.json();
      return String(j.url || '');
    },
  });

  // Step 2: fetch the JSON body with the presigned URL (GET)
  const dataQuery = useQuery({
    queryKey: ['mobile-sessions', sessionId, 'json-a'],
    enabled: enabled && !!presignQuery.data,
    queryFn: async (): Promise<JsonA> => {
      const res = await fetch(presignQuery.data!, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`Fetch JSON failed: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
  });

  return {
    url: presignQuery.data,
    isGettingUrl: presignQuery.isLoading,
    getUrlError: presignQuery.error as Error | null,
    data: dataQuery.data,
    isLoading: dataQuery.isLoading || presignQuery.isLoading,
    isError: dataQuery.isError || presignQuery.isError,
    error: (dataQuery.error || presignQuery.error) as Error | null,
    refetch: async () => {
      await presignQuery.refetch();
      await dataQuery.refetch();
    },
  };
}
