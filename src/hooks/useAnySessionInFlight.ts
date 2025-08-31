import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://your.api.domain';

type MobileSession = {
  id: string;
  status: string;
};

export function useAnySessionInFlight() {
  const { fetchWithAuth } = useAuth();

  const query = useQuery({
    queryKey: ['mobile-sessions', 'inflight-indicator'],
    // keep it lightweight: only fetch a few recent, or filter by status if you add it server-side
    queryFn: async (): Promise<MobileSession[]> => {
      const res = await fetchWithAuth(`${API_BASE}/mobile/sessions?limit=25`);
      if (!res.ok) throw new Error('sessions fetch failed');
      return res.json();
    },
    // poll occasionally so the dot updates while user is on the screen
    refetchInterval: 20_000, // 20s
  });

  const anyInFlight =
    (query.data ?? []).some(s => s.status === 'queued' || s.status === 'processing');

  return { anyInFlight, ...query };
}
