import { describe, it, expect, vi } from 'vitest';

// trophies.ts imports @/db, which throws at import time without DATABASE_URL
// (CI has none) — the documented mock-@/db landmine.
vi.mock('@/db', () => ({ db: {} }));

import { FINAL_BOSS_MAP_SLUGS } from '@/lib/scenes/final-boss-maps';
import { getFinalBoss } from '@/lib/scenes/final-boss-roster';
import {
  MAP_TO_CHAMPION_CARD,
  CHAMPION_TITLES,
  CHAMPIONS_BY_SLUG,
} from '@/lib/collections/championsData';
import { MAP_TO_CHAMPION_TROPHY } from '@/lib/db/trophies';
import { TROPHIES } from '../../scripts/seed-trophies';
import { defaultItems, rewardItems } from '@/lib/avatar/itemCatalog';

/**
 * Opening a map needs FIVE separate registrations, and 里海 shipped ten
 * authored weeks with none of them — the board drew a 👑 lair whose scene
 * could only answer "No overlord for this map." in English.
 *
 * Each piece lives in a different file, so nothing forced them to agree and
 * nothing failed when they didn't: a missing champion card just means beating
 * the boss grants nothing, silently. This is the guard that makes adding
 * map 3 a checklist the suite enforces rather than one someone remembers.
 */
describe('every map with an overlord has the complete reward chain', () => {
  const crowns = [...rewardItems(), ...defaultItems()].filter((i) => i.slot === 'hat');

  for (const slug of FINAL_BOSS_MAP_SLUGS) {
    describe(slug, () => {
      it('has a roster entry with a component and bilingual names', () => {
        const boss = getFinalBoss(slug);
        expect(boss, `${slug} is in FINAL_BOSS_MAP_SLUGS but not the roster`).not.toBeNull();
        expect(boss!.Component).toBeTypeOf('function');
        expect(boss!.nameZh).toBeTruthy();
        expect(boss!.nameEn).toBeTruthy();
      });

      it('has a champions-v1 card that actually exists', () => {
        const cardSlug = MAP_TO_CHAMPION_CARD[slug];
        expect(cardSlug, `no MAP_TO_CHAMPION_CARD entry for ${slug}`).toBeTruthy();
        const card = CHAMPIONS_BY_SLUG[cardSlug];
        expect(card, `${cardSlug} is mapped but missing from CHAMPIONS`).toBeTruthy();
        expect(card.nameZh).toBeTruthy();
        expect(card.nameEn).toBeTruthy();
        expect(card.loreZh).toBeTruthy();
        expect(card.loreEn).toBeTruthy();
      });

      it('has a crown whose unlockRef is that card slug', () => {
        // grantChampionCosmetic resolves the crown BY the card slug, so this
        // convention is load-bearing, not decorative.
        const cardSlug = MAP_TO_CHAMPION_CARD[slug];
        const crown = crowns.find((i) => i.unlockRef === cardSlug);
        expect(crown, `no hat ItemDef with unlockRef="${cardSlug}"`).toBeTruthy();
        expect(crown!.rewardOnly, 'a champion crown must be reward-only').toBe(true);
      });

      it('has a champion trophy that the seed script actually seeds', () => {
        // A granted slug with no `trophies` row silently grants nothing —
        // checkAndGrantTrophies filters to existing rows.
        const trophySlug = MAP_TO_CHAMPION_TROPHY[slug];
        expect(trophySlug, `no MAP_TO_CHAMPION_TROPHY entry for ${slug}`).toBeTruthy();
        const seeded = TROPHIES.find((t) => t.slug === trophySlug);
        expect(seeded, `${trophySlug} is mapped but not in seed-trophies.ts`).toBeTruthy();
      });

      it('has a bilingual champion title for the home chip', () => {
        const title = CHAMPION_TITLES[slug];
        expect(title, `no CHAMPION_TITLES entry for ${slug}`).toBeTruthy();
        expect(title.zh).toBeTruthy();
        expect(title.en).toBeTruthy();
      });
    });
  }

  it('champion cards, crowns and trophies are one-per-map — no shared slugs', () => {
    const cards = FINAL_BOSS_MAP_SLUGS.map((s) => MAP_TO_CHAMPION_CARD[s]);
    const trophies = FINAL_BOSS_MAP_SLUGS.map((s) => MAP_TO_CHAMPION_TROPHY[s]);
    expect(new Set(cards).size, 'two maps share a champion card').toBe(cards.length);
    expect(new Set(trophies).size, 'two maps share a champion trophy').toBe(trophies.length);
  });
});
