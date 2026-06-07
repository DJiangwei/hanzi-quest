import { describe, expect, it } from 'vitest';
import {
  SOLAR_BODIES,
  SOLAR_TYPE_ORDER,
  TYPE_EMOJI,
  TYPE_LABELS,
} from '@/lib/collections/solarSystemData';

describe('solar grouping metadata', () => {
  it('SOLAR_TYPE_ORDER covers every type used by a body', () => {
    for (const b of SOLAR_BODIES) {
      expect(SOLAR_TYPE_ORDER).toContain(b.type);
    }
  });
  it('SOLAR_TYPE_ORDER has no duplicates and matches TYPE_LABELS keys', () => {
    expect(new Set(SOLAR_TYPE_ORDER).size).toBe(SOLAR_TYPE_ORDER.length);
    for (const t of SOLAR_TYPE_ORDER) {
      expect(TYPE_LABELS[t]).toBeDefined();
    }
  });
  it('every type has a header emoji', () => {
    for (const t of SOLAR_TYPE_ORDER) {
      expect(TYPE_EMOJI[t]).toBeTruthy();
    }
  });
});
