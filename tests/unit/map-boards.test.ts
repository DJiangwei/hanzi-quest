import { describe, expect, it } from 'vitest';
import { VOYAGE_MAPS, getVoyageMap } from '@/lib/play/map-boards';

describe('voyage maps config', () => {
  it('has Caribbean (10 stops) and Indian Ocean (9 stops)', () => {
    expect(getVoyageMap('pirate-class-level-1')?.stops).toHaveLength(10);
    expect(getVoyageMap('pirate-class-level-2')?.stops).toHaveLength(9);
  });

  it('returns null for unconfigured packs', () => {
    expect(getVoyageMap('school-custom')).toBeNull();
    expect(getVoyageMap('nope')).toBeNull();
  });

  it('every stop has bilingual labels + an emoji', () => {
    for (const m of Object.values(VOYAGE_MAPS)) {
      expect(m.nameZh).toBeTruthy();
      expect(m.nameEn).toBeTruthy();
      for (const s of m.stops) {
        expect(s.labelZh).toBeTruthy();
        expect(s.labelEn).toBeTruthy();
        expect(s.emoji).toBeTruthy();
      }
    }
  });
});
