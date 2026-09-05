import { describe, expect, it } from 'vitest';
import {
  VOYAGE_MAPS,
  getVoyageMap,
  getMapAccent,
  DEFAULT_MAP_ACCENT,
} from '@/lib/play/map-boards';
import { MAP_TO_VAULT_CARD, VAULT_TREASURES_BY_SLUG } from '@/lib/collections/keyVaultData';

describe('voyage maps config', () => {
  it('has Caribbean as map 1 and the Caspian Sea as map 2', () => {
    expect(getVoyageMap('pirate-class-level-1')?.nameZh).toBe('加勒比海');
    expect(getVoyageMap('pirate-class-level-2')?.nameZh).toBe('里海');
    expect(getVoyageMap('pirate-class-level-2')?.nameEn).toBe('Caspian Sea');
  });

  it('keeps the Indian Ocean ready as map 3 rather than discarding it', () => {
    // Re-themed out of map 2 on 2026-09-05, kept whole so a future third map
    // is a seed row plus a backdrop rather than a rewrite.
    const indian = getVoyageMap('pirate-class-level-3');
    expect(indian?.nameZh).toBe('印度洋');
    expect(indian?.stops.map((s) => s.labelEn)).toContain('Maldives Lagoons');
  });

  it('gives every configured map exactly one stop per week of its map', () => {
    // VoyageBoard renders `map.stops.map(...)` — ONE medallion per stop. A
    // 10-week map with 9 stops therefore drops its last island off the board
    // entirely and the child can never reach it, which is exactly how week 10
    // went missing in PR #151. The Indian Ocean config shipped with 9.
    for (const [slug, m] of Object.entries(VOYAGE_MAPS)) {
      expect(m.stops.length, `${slug} must have 10 stops for a 10-week map`).toBe(10);
    }
  });

  it('returns null for unconfigured packs', () => {
    expect(getVoyageMap('school-custom')).toBeNull();
    expect(getVoyageMap('nope')).toBeNull();
  });

  it('gives each themed map an accent distinct from the default AND from each other', () => {
    const caspian = getMapAccent('pirate-class-level-2');
    const indian = getMapAccent('pirate-class-level-3');
    expect(caspian).not.toEqual(DEFAULT_MAP_ACCENT);
    expect(indian).not.toEqual(DEFAULT_MAP_ACCENT);
    // The accent is the whole point of the per-map chrome — two maps sharing
    // one would make the header pill stop telling her where she is.
    expect(caspian).not.toEqual(indian);
    // Caribbean uses the default; unknown packs do too.
    expect(getMapAccent('pirate-class-level-1')).toEqual(DEFAULT_MAP_ACCENT);
    expect(getMapAccent('nope')).toEqual(DEFAULT_MAP_ACCENT);
  });

  it('points every backdrop at its OWN slug', () => {
    // maps/<slug>.jpg is keyed by SLUG, so a URL pasted into the wrong entry
    // silently gives one sea another sea's picture — the exact hazard when map
    // 2 was re-themed and its path still held the Indian Ocean art. No test can
    // check what is INSIDE a JPEG, so this pins the one thing a string can
    // prove: the filename matches the map it is configured on.
    for (const [slug, m] of Object.entries(VOYAGE_MAPS)) {
      if (!m.imageUrl) continue;
      expect(m.imageUrl, `${slug} backdrop points elsewhere`).toContain(`/maps/${slug}.`);
    }
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

describe('every map that can be completed has a treasure to award', () => {
  it('resolves every MAP_TO_VAULT_CARD target to a real treasure', () => {
    // claimKeyVaultPrize looks the card up by this slug when the tenth key
    // lands. A mapping pointing at a treasure that does not exist turns the
    // payoff for collecting an entire map into a silent no-op.
    for (const [mapSlug, cardSlug] of Object.entries(MAP_TO_VAULT_CARD)) {
      expect(
        VAULT_TREASURES_BY_SLUG[cardSlug],
        `${mapSlug} → ${cardSlug} has no treasure`,
      ).toBeDefined();
    }
  });

  it('gives the Caspian its own treasure and leaves the Indian Ocean its own', () => {
    expect(MAP_TO_VAULT_CARD['pirate-class-level-2']).toBe('vault-caspian');
    expect(MAP_TO_VAULT_CARD['pirate-class-level-3']).toBe('vault-indian-ocean');
  });
});
