import { describe, expect, it } from 'vitest';
import {
  flagEmojiFromIso2,
  CONTINENT_LABELS,
  CONTINENT_ORDER,
} from '@/lib/collections/flagsData';

describe('flagEmojiFromIso2', () => {
  it('maps iso2 → regional-indicator flag emoji', () => {
    expect(flagEmojiFromIso2('cn')).toBe('🇨🇳');
    expect(flagEmojiFromIso2('gb')).toBe('🇬🇧');
    expect(flagEmojiFromIso2('us')).toBe('🇺🇸');
  });
  it('is case-insensitive', () => {
    expect(flagEmojiFromIso2('CN')).toBe('🇨🇳');
  });
  it('returns a white flag for malformed input', () => {
    expect(flagEmojiFromIso2('xyz')).toBe('🏳️');
    expect(flagEmojiFromIso2('')).toBe('🏳️');
  });
});

describe('continent metadata', () => {
  it('CONTINENT_ORDER lists all 6 inhabited continents once', () => {
    expect(CONTINENT_ORDER).toHaveLength(6);
    expect(new Set(CONTINENT_ORDER).size).toBe(6);
  });
  it('every continent has a bilingual label + emoji', () => {
    for (const c of CONTINENT_ORDER) {
      expect(CONTINENT_LABELS[c].zh).toBeTruthy();
      expect(CONTINENT_LABELS[c].en).toBeTruthy();
      expect(CONTINENT_LABELS[c].emoji).toBeTruthy();
    }
  });
});
