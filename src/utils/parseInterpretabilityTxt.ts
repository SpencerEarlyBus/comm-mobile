// src/utils/parseInterpretabilityTxt.ts
export type InterpretabilityParsed = {
  // Grades (as before)
  fk?: number | null;
  smog?: number | null;
  ari?: number | null;
  cli?: number | null;

  // NEW: Band scores (0..100)
  fkBand?: number | null;
  smogBand?: number | null;
  ariBand?: number | null;
  cliBand?: number | null;

  // NEW: Other bands (0..100)
  repetitionBand?: number | null;   // "Trigram duplicate penalty"
  structureBand?: number | null;    // "Opening/Signposts/Closing"

  // Optional rollups
  readabilityScore?: number | null; // "Readability score: 93.37/100"
  overall?: number | null;          // "Overall Score: 69.34/100"
};

const num = (s: string | undefined | null) => {
  const n = s == null ? NaN : parseFloat(String(s).trim());
  return Number.isFinite(n) ? n : null;
};

// tolerant helpers
const m = (re: RegExp, text: string) => re.exec(text)?.[1] ?? null;
const m2 = (re: RegExp, text: string) => {
  const out = re.exec(text);
  return out ? { a: out[1] ?? null, b: out[2] ?? null } : { a: null, b: null };
};

export function parseInterpretabilityTxt(text: string): InterpretabilityParsed | undefined {
  if (!text || typeof text !== 'string') return undefined;
  const t = text.replace(/\r/g, '');

  // Grades + band: "<Metric> (adj):  8.49  → band 93.9/100"
  const fk = m2(/Flesch[-–—\s]?Kincaid.*?:\s*([0-9]+(?:\.[0-9]+)?)\s*→\s*band\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*100/i, t);
  const smog = m2(/SMOG.*?:\s*([0-9]+(?:\.[0-9]+)?)\s*→\s*band\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*100/i, t);
  const ari = m2(
    /(?:Automated Readability(?:\s*Index)?|\bARI\b).*?:\s*([0-9]+(?:\.[0-9]+)?)\s*(?:→|->)\s*band\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*100/i,
    t
  );
  const cli = m2(/Coleman[-–—\s]?Liau.*?:\s*([0-9]+(?:\.[0-9]+)?)\s*→\s*band\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*100/i, t);

  // Other bands
  const repetitionBand = num(m(/Trigram duplicate penalty\s*→\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*100/i, t));
  const structureBand = num(m(/Opening\/Signposts\/Closing\s*→\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*100/i, t));

  // Rollups (optional)
  const readabilityScore = num(m(/Readability score:\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*100/i, t));
  const overall = num(m(/Overall Score:\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*100/i, t));

  return {
    fk: num(fk.a), fkBand: num(fk.b),
    smog: num(smog.a), smogBand: num(smog.b),
    ari: num(ari.a), ariBand: num(ari.b),
    cli: num(cli.a), cliBand: num(cli.b),
    repetitionBand,
    structureBand,
    readabilityScore,
    overall,
  };
}

// Keep your existing helper if you still use it elsewhere
export function normalizeGradeToScore(grade?: number | null): number {
  // Map grade to 0..100 where 8–9 is best (100).
  if (!Number.isFinite(grade as number)) return 0;
  const g = grade as number;
  const targetMin = 8, targetMax = 9;
  if (g >= targetMin && g <= targetMax) return 100;
  // Simple falloff: 1 grade away = 80, 2 away = 60, clamp at 0..100
  const dist = Math.min(Math.abs(g - ((g < targetMin) ? targetMin : targetMax)), 3);
  const pct = Math.max(0, 100 - dist * 20);
  return Math.round(pct);
}
