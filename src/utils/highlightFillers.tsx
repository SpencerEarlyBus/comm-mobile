// src/utils/highlightFillers.tsx
import React from 'react';
import { Text } from 'react-native';
import { COLORS as C } from '../theme/colors';

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalizeSentence(s: string) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

// very lightweight sentence splitter that doesn’t use lookbehind (RN-safe)
function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  const trail = `"'”’)]`;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    buf += ch;

    if (ch === '.' || ch === '!' || ch === '?') {
      // consume trailing quotes/brackets right after punctuation
      let j = i + 1;
      while (j < text.length && trail.includes(text[j])) {
        buf += text[j];
        i = j;
        j++;
      }
      const next = text[i + 1] ?? '';
      if (next === '' || next === ' ' || next === '\n' || next === '\t') {
        if (buf.trim()) out.push(buf.trim());
        buf = '';
      }
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * Remove repeated trailing sentence block(s).
 * Detects if the last 1..3 sentences are repeated ≥2 times consecutively
 * and keeps only the first occurrence of that final block.
 */
export function dedupeTrailingSentences(text: string, maxBlock = 3): string {
  if (!text) return text;
  const sents = splitSentences(text);
  if (sents.length >= 2) {
    const minChars = 6;
    const n = sents.length;

    // 1) Trailing repeated sentence-blocks (1..maxBlock sentences)
    for (let k = 1; k <= Math.min(maxBlock, Math.floor(n / 2)); k++) {
      const block = sents.slice(n - k, n);
      if (block.join(' ').replace(/\s+/g, '').length < minChars) continue;

      const normBlock = block.map(normalizeSentence).join(' | ');
      let repeats = 1;
      let start = n - k;
      let prevStart = start - k;

      while (prevStart >= 0) {
        const prevBlock = sents.slice(prevStart, prevStart + k);
        const prevNorm = prevBlock.map(normalizeSentence).join(' | ');
        if (prevNorm === normBlock) {
          repeats++;
          start = prevStart;
          prevStart = start - k;
        } else {
          break;
        }
      }

      if (repeats >= 2) {
        const keepUntil = n - (repeats - 1) * k;
        const kept = sents.slice(0, keepUntil);
        return kept.join(' ');
      }
    }
  }

  // 2) Last-line spam fallback (newline-separated)
  const lines = text.split(/\r?\n/);
  if (lines.length >= 3) {
    const last = lines[lines.length - 1].trim();
    const penul = lines[lines.length - 2].trim();
    if (last && normalizeSentence(last) === normalizeSentence(penul) && last.length >= 6) {
      let i = lines.length - 2;
      while (i - 1 >= 0 && normalizeSentence(lines[i - 1].trim()) === normalizeSentence(last)) i--;
      return lines.slice(0, i + 1).join('\n');
    }
  }

  // 3) NEW: Trailing repeated phrase blocks (no punctuation/newlines)
  //    Look at the last 6..18 words; if that phrase repeats ≥2× at the end, collapse to 1×.
  const words = text.match(/[A-Za-z0-9']+/g) || [];
  if (words.length >= 12) {
    const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (let k = Math.min(18, Math.floor(words.length / 2)); k >= 6; k--) {
      const tailWords = words.slice(-k).map(escape);
      // Build a case-insensitive pattern that tolerates whitespace between words
      const pattern = tailWords.join('\\s+');
      // Capture one copy, then match ≥1 extra copies at the end
      const rx = new RegExp(`(${pattern})(?:\\s+${pattern})+\\s*$`, 'i');
      if (rx.test(text)) {
        // Replace repeated tail with a single copy
        return text.replace(rx, (_m, g1) => g1);
      }
    }
  }

  return text;
}


export function HighlightedTranscript({
  text,
  terms,
  color = C.accent,
}: {
  text: string;
  terms: string[];
  color?: string;
}) {
  if (!text || !terms?.length) return <Text style={{ color: C.text }}>{text}</Text>;

  const parts: React.ReactNode[] = [];
  const pattern = terms
    .map((t) => escapeRx(t).replace(/\s+/g, '\\s+'))
    .filter(Boolean)
    .join('|');

  if (!pattern) return <Text style={{ color: C.text }}>{text}</Text>;

  // word-ish boundary: avoid splitting inside other words; allow phrases
  const rx = new RegExp(`(?:(?<=^)|(?<=[^A-Za-z]))(${pattern})(?:(?=$)|(?=[^A-Za-z]))`, 'gi');

  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = rx.exec(text))) {
    const start = m.index;
    const end = rx.lastIndex;

    if (start > lastIndex) {
      parts.push(
        <Text key={`p-${lastIndex}`} style={{ color: C.text }}>
          {text.slice(lastIndex, start)}
        </Text>,
      );
    }

    parts.push(
      <Text key={`h-${start}`} style={{ color, fontWeight: '800' }}>
        {text.slice(start, end)}
      </Text>,
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push(
      <Text key="p-end" style={{ color: C.text }}>
        {text.slice(lastIndex)}
      </Text>,
    );
  }

  return <Text selectable>{parts}</Text>;
}
