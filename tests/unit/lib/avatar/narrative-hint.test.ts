import { describe, expect, it } from 'vitest';
import {
  ITEM_CATALOG,
  resolveNarrativeHint,
} from '@/lib/avatar/itemCatalog';

describe('itemCatalog narrativeHint', () => {
  it('every entry has a narrativeHint string', () => {
    for (const [id, item] of Object.entries(ITEM_CATALOG)) {
      expect(
        typeof item.narrativeHint,
        `${id} is missing narrativeHint`,
      ).toBe('string');
      expect(item.narrativeHint.length).toBeGreaterThan(0);
    }
  });

  it('resolveNarrativeHint returns the hint for a known id', () => {
    const firstId = Object.keys(ITEM_CATALOG)[0]!;
    expect(resolveNarrativeHint(firstId)).toBe(
      ITEM_CATALOG[firstId]!.narrativeHint,
    );
  });

  it('resolveNarrativeHint falls back to a placeholder for unknown id', () => {
    expect(resolveNarrativeHint('does-not-exist')).toBe('a pirate kid');
  });

  it('resolveNarrativeHint falls back for null/undefined', () => {
    expect(resolveNarrativeHint(null)).toBe('a pirate kid');
    expect(resolveNarrativeHint(undefined)).toBe('a pirate kid');
  });
});
