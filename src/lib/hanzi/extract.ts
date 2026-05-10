const HANZI_RE = /\p{Script=Han}/gu;

/**
 * Extract unique Chinese characters from a free-form string. Anything that
 * isn't a Han ideograph (whitespace, punctuation, English, pinyin tone marks,
 * digits, emoji) is dropped. Order is preserved; duplicates are removed.
 */
export function extractHanzi(raw: string): string[] {
  const matches = raw.match(HANZI_RE) ?? [];
  return Array.from(new Set(matches));
}
