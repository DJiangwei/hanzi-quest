import { describe, expect, it } from 'vitest';
import { MAP_BOARDS, getMapBoard } from '@/lib/play/map-boards';

describe('map-boards config', () => {
  it('has Caribbean (10 hotspots) and Indian Ocean (9 hotspots)', () => {
    expect(getMapBoard('pirate-class-level-1')?.hotspots).toHaveLength(10);
    expect(getMapBoard('pirate-class-level-2')?.hotspots).toHaveLength(9);
  });

  it('returns null for unconfigured packs', () => {
    expect(getMapBoard('school-custom')).toBeNull();
    expect(getMapBoard('nope')).toBeNull();
  });

  it('every hotspot has in-range coords and bilingual labels', () => {
    for (const cfg of Object.values(MAP_BOARDS)) {
      expect(cfg.imageSrc).toMatch(/^\/maps\/.+\.webp$/);
      expect(cfg.nameZh).toBeTruthy();
      expect(cfg.nameEn).toBeTruthy();
      for (const h of cfg.hotspots) {
        expect(h.xPct).toBeGreaterThanOrEqual(0);
        expect(h.xPct).toBeLessThanOrEqual(100);
        expect(h.yPct).toBeGreaterThanOrEqual(0);
        expect(h.yPct).toBeLessThanOrEqual(100);
        expect(h.labelZh).toBeTruthy();
        expect(h.labelEn).toBeTruthy();
      }
    }
  });
});
