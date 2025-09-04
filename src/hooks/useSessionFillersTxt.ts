// src/hooks/useSessionFillersTxt.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/MobileAuthContext';

export type FillersStats = {
  totalWords?: number;
  fillerWords?: number;
  density?: number;            // 0..1 or raw (we’ll treat as raw ratio)
  byCategory?: {
    critical?: number;
    hesitation?: number;
    confidence?: number;
    self_correction?: number;
  };
  overallScore?: number;       // /100
  terms?: string[];            // extracted examples to highlight
  raw?: string;                // original text
};

const extractQuotedList = (s: string) => {
  // pulls 'um', 'uh', 'you know' => ["um","uh","you know"]
  const out: string[] = [];
  const re = /'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
};

const parseFillersReport = (raw: string): FillersStats => {
  const stats: FillersStats = { byCategory: {}, terms: [], raw };

  // Totals
  const mTotal = raw.match(/spoke a total of\s+(\d+)\s+words/i);
  const mFill = raw.match(/(\d+)\s+words were flagged as verbal fillers/i);
  const mDensity = raw.match(/weighted verbal filler density of\s+([0-9.]+)/i);
  if (mTotal) stats.totalWords = Number(mTotal[1]);
  if (mFill) stats.fillerWords = Number(mFill[1]);
  if (mDensity) stats.density = Number(mDensity[1]);

  // Categories (grab counts)
  const catPairs: Array<[keyof NonNullable<FillersStats['byCategory']>, RegExp]> = [
    ['critical', /Critical Fillers[^\n:]*:\s*(\d+)/i],
    ['hesitation', /Hesitation Fillers[^\n:]*:\s*(\d+)/i],
    ['confidence', /Confidence Lacking Fillers[^\n:]*:\s*(\d+)/i],
    ['self_correction', /Self Correction Fillers[^\n:]*:\s*(\d+)/i],
  ];
  catPairs.forEach(([k, re]) => {
    const m = raw.match(re);
    if (m) (stats.byCategory as any)[k] = Number(m[1]);
  });

  // Examples: collect quoted lists in parentheses on category lines
  const categoryLines = raw.split('\n').filter(l => /(Critical|Hesitation|Confidence|Self Correction) Fillers/i.test(l));
  categoryLines.forEach(line => {
    const ex = extractQuotedList(line);
    ex.forEach(t => stats.terms!.push(t));
  });

  // Unique fillers (optional sections)
  const uniqLine = raw.split('\n').find(l => /Unique Fillers/i.test(l));
  if (uniqLine) stats.terms!.push(...extractQuotedList(uniqLine));

  const uniqPhrase = raw.split('\n').find(l => /Unique Phrase\/Sentence/i.test(l));
  if (uniqPhrase) stats.terms!.push(...extractQuotedList(uniqPhrase));

  // Overall score
  const mScore = raw.match(/Overall Score:\s*([0-9.]+)\s*\/\s*100/i);
  if (mScore) stats.overallScore = Number(mScore[1]);

  // Dedup + keep phrases order-ish
  stats.terms = Array.from(new Set((stats.terms || []).map(t => t.trim()).filter(Boolean)));

  return stats;
};

export function useSessionFillersTxt(sessionId: string, enabled = true) {
  const { fetchWithAuth } = useAuth();
  const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

  const urlQuery = useQuery({
    queryKey: ['mobile-sessions', sessionId, 'fillers-url'],
    enabled,
    queryFn: async (): Promise<string> => {
      const res = await fetchWithAuth(`${API_BASE}/mobile/sessions/${sessionId}/fillers-url`);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`Failed to get fillers URL: ${res.status} ${t}`);
      }
      const j = await res.json();
      return String(j.url || '');
    },
  });

  const textQuery = useQuery({
    queryKey: ['mobile-sessions', sessionId, 'fillers-txt'],
    enabled: enabled && !!urlQuery.data,
    queryFn: async () => {
      const res = await fetch(urlQuery.data!, { method: 'GET' });
      if (!res.ok) throw new Error(`Fetch fillers txt failed: ${res.status} ${res.statusText}`);
      const raw = await res.text();
      return parseFillersReport(raw);
    },
  });

  return {
    stats: textQuery.data,          // parsed FillersStats
    isLoading: urlQuery.isLoading || textQuery.isLoading,
    isError: urlQuery.isError || textQuery.isError,
    error: (urlQuery.error || textQuery.error) as Error | null,
    refetch: async () => { await urlQuery.refetch(); await textQuery.refetch(); },
  };
}
