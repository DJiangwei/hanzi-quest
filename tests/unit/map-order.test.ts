import { describe, expect, it } from 'vitest';
import { mapOrderIndex } from '@/lib/play/map-order';

describe('mapOrderIndex', () => {
  it('parses pirate-class-level-N', () => {
    expect(mapOrderIndex('pirate-class-level-1')).toBe(1);
    expect(mapOrderIndex('pirate-class-level-2')).toBe(2);
  });
  it('sorts non-conforming slugs last (large sentinel)', () => {
    expect(mapOrderIndex('school-custom')).toBeGreaterThan(1000);
  });
});
