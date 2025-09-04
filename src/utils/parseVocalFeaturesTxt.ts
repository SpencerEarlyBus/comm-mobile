// src/utils/parseVocalFeaturesTxt.ts
export type VocalFeaturesParsed = {
  pitchVariability?: number;   // /100
  speechRhythm?: number;       // /100
  energyConsistency?: number;  // /100
  wpm?: number;
  wpmGrade?: number;           // /100
  wordsCounted?: number;
  speakingTimeSec?: number;
  windowSec?: number;
  silencePenalty?: number;
  overallScore?: number;       // /100
};

export function parseVocalFeaturesTxt(s: string): VocalFeaturesParsed {
  const num = (re: RegExp) => {
    const m = s.match(re);
    return m ? parseFloat(m[1]) : undefined;
  };
  const int = (re: RegExp) => {
    const m = s.match(re);
    return m ? parseInt(m[1], 10) : undefined;
  };

  return {
    pitchVariability:   num(/Pitch\s+Variability:\s*([\d.]+)\s*\/\s*100/i),
    speechRhythm:       num(/Speech\s+Rhythm:\s*([\d.]+)\s*\/\s*100/i),
    energyConsistency:  num(/Energy\s+Consistency:\s*([\d.]+)\s*\/\s*100/i),
    wpm:                num(/Words\s+per\s+Minute:\s*([\d.]+)\s*WPM/i),
    wpmGrade:           num(/WPM\s+Grade:\s*([\d.]+)\s*\/\s*100/i),
    wordsCounted:       int(/Words\s+Counted:\s*(\d+)/i),
    speakingTimeSec:    num(/Speaking\s+Time:\s*([\d.]+)s/i),
    windowSec:          num(/Window:\s*([\d.]+)s/i),
    silencePenalty:     num(/Silence\s+Penalty:\s*([\d.]+)/i),
    overallScore:       num(/Overall\s+Score:\s*([\d.]+)\s*\/\s*100/i),
  };
}
