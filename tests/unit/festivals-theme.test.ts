import { describe, expect, it } from 'vitest';
import {
  FESTIVAL_THEMES,
  festivalThemeForMonth,
} from '@/lib/calendar/festivals';
import { FESTIVALS_BY_SLUG, FESTIVAL_ITEMS } from '@/lib/collections/festivalsData';

describe('festival themes', () => {
  it('has a theme for all 12 Gregorian months', () => {
    for (let m = 1; m <= 12; m++) {
      expect(FESTIVAL_THEMES[m]).toBeDefined();
      expect(FESTIVAL_THEMES[m].month).toBe(m);
    }
  });

  it('every theme cardSlug exists in the festivals pack data', () => {
    for (let m = 1; m <= 12; m++) {
      expect(FESTIVALS_BY_SLUG[FESTIVAL_THEMES[m].cardSlug]).toBeDefined();
    }
  });

  it('all 12 cardSlugs are unique', () => {
    const slugs = Object.values(FESTIVAL_THEMES).map((t) => t.cardSlug);
    expect(new Set(slugs).size).toBe(12);
  });

  it('thresholds are sane (1–28 days)', () => {
    for (const t of Object.values(FESTIVAL_THEMES)) {
      expect(t.thresholdDays).toBeGreaterThanOrEqual(1);
      expect(t.thresholdDays).toBeLessThanOrEqual(28);
    }
  });

  it('festivalThemeForMonth picks the month from a yyyy-mm key', () => {
    expect(festivalThemeForMonth('2026-06').cardSlug).toBe('dragon-boat');
    expect(festivalThemeForMonth('2026-09').cardSlug).toBe('mid-autumn');
    expect(festivalThemeForMonth('2026-02').cardSlug).toBe('spring-festival');
  });

  it('festivals pack data has 12 unique-slug items, all bilingual', () => {
    expect(FESTIVAL_ITEMS).toHaveLength(12);
    expect(new Set(FESTIVAL_ITEMS.map((f) => f.slug)).size).toBe(12);
    for (const f of FESTIVAL_ITEMS) {
      expect(f.nameZh).toBeTruthy();
      expect(f.nameEn).toBeTruthy();
      expect(f.emoji).toBeTruthy();
      expect(f.loreZh).toBeTruthy();
      expect(f.loreEn).toBeTruthy();
    }
  });
});
