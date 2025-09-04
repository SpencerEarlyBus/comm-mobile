// src/utils/parseInterpretabilityTxt.ts
export type InterpretabilityParsed = {
  fk?: number | null;    // Flesch–Kincaid Grade Level
  smog?: number | null;  // SMOG Index
  ari?: number | null;   // Automated Readability Index
  cli?: number | null;   // Coleman–Liau Index
  overall?: number | null; // 0..100
};

const pickNum = (s?: string | null) => {
  if (!s) return null;
  const m = s.match(/(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

export function parseInterpretabilityTxt(raw: string): InterpretabilityParsed {
  const lines = raw.split(/\r?\n/).map(l => l.trim());

  const findLine = (re: RegExp) => lines.find(l => re.test(l)) || '';

  const fk  = pickNum(findLine(/Flesch[-–]Kincaid/i));
  const smog = pickNum(findLine(/SMOG/i));
  const ari = pickNum(findLine(/Automated Readability Index|ARI/i));
  const cli = pickNum(findLine(/Coleman[-–]Liau/i));
  const overall = pickNum(findLine(/Overall Score/i));

  return { fk, smog, ari, cli, overall };
}

/**
 * Map grade to desirability score (0..100), ideal window 8–9 == 100.
 * Linear falloff to 0 when ~7 grades away from the nearest edge.
 */
export function normalizeGradeToScore(grade?: number | null): number {
  if (grade == null || !isFinite(grade)) return 0;
  const IDEAL_MIN = 8;
  const IDEAL_MAX = 9;
  if (grade >= IDEAL_MIN && grade <= IDEAL_MAX) return 100;

  const dist = grade < IDEAL_MIN ? (IDEAL_MIN - grade) : (grade - IDEAL_MAX);
  const ZERO_AT = 7; // tweak if you want a sharper/softer curve
  const drop = Math.min(1, dist / ZERO_AT);
  return Math.round(100 * (1 - drop));
}
