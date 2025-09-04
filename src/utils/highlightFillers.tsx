// src/utils/highlightFillers.tsx
import React from 'react';
import { Text } from 'react-native';
import { COLORS as C } from '../theme/colors';

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

  // Build a single regex for all terms, case-insensitive.
  // Use word-ish boundaries; allow multi-word phrases.
  const parts: React.ReactNode[] = [];
  const pattern = terms
    .map(t => escapeRx(t).replace(/\s+/g, '\\s+')) // "you know" -> you\s+know
    .filter(Boolean)
    .join('|');

  if (!pattern) return <Text style={{ color: C.text }}>{text}</Text>;

  // \b is imperfect for phrases—pair with non-letter boundaries
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
        </Text>
      );
    }

    parts.push(
      <Text key={`h-${start}`} style={{ color, fontWeight: '800' }}>
        {text.slice(start, end)}
      </Text>
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push(
      <Text key={`p-end`} style={{ color: C.text }}>
        {text.slice(lastIndex)}
      </Text>
    );
  }

  return <Text selectable>{parts}</Text>;
}
