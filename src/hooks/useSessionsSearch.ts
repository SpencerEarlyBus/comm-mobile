// hooks/useSessionsSearch.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

export type SessionRow = {
  id: string;
  topic?: string | null;
  status: string;
  created_at?: string;
  leaderboard_tag?: string | null;
  overall_score?: number | null;
};

export type SessionSearchParams = {
  q?: string;
  status?: string;
  tag?: string;
  order?: 'newest' | 'oldest';
  limit?: number;
};

export function useSessionsSearch(params: SessionSearchParams, enabled = true) {
  const { fetchWithAuth } = useAuth();

  return useInfiniteQuery<{
    ok: boolean; total: number; limit: number; offset: number; items: SessionRow[];
  }, Error>({
    queryKey: ['mobile-sessions', 'search', params],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const limit = params.limit ?? 50;
      const url = new URL(`${API_BASE}/mobile/sessions`);
      if (params.q) url.searchParams.set('q', params.q);
      if (params.status) url.searchParams.set('status', params.status);
      if (params.tag) url.searchParams.set('tag', params.tag);
      if (params.order) url.searchParams.set('order', params.order);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(pageParam));

      const res = await fetchWithAuth(url.toString());
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`sessions search ${res.status}: ${t}`);
      }
      return res.json();
    },
    getNextPageParam: (last, _pages) => {
      const got = last.items?.length ?? 0;
      const nextOffset = (last.offset ?? 0) + got;
      if (nextOffset >= last.total) return undefined;
      return nextOffset;
    },
    staleTime: 0,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
}
