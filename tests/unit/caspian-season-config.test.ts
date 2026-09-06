// 里海远航 / Caspian Passage season config.
//
// Every slug a tier names is resolved at CLAIM time, inside a transaction on a
// child's device — a typo there is a failed claim in production, not a compile
// error. These tests are the only place the four slug namespaces (cards,
// cosmetics, trophies, the tier table) are checked against each other.
import { describe, expect, it } from 'vitest';
import { CASPIAN_VOYAGE_TIERS, CASPIAN_VOYAGE_META } from '@/lib/season/caspianVoyage';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';
import { SEASON_CARDS_BY_SLUG, SEASON_CARD_ITEMS } from '@/lib/collections/seasonCardsData';
import { ITEM_CATALOG } from '@/lib/avatar/itemCatalog';
import { TROPHIES } from '../../scripts/seed-trophies';

describe('Caspian Passage config', () => {
  it('has 30 tiers numbered 1..30', () => {
    expect(CASPIAN_VOYAGE_TIERS).toHaveLength(30);
    CASPIAN_VOYAGE_TIERS.forEach((t, i) => expect(t.tier).toBe(i + 1));
  });

  it('xpRequired is strictly increasing (the levels math depends on it)', () => {
    for (let i = 1; i < CASPIAN_VOYAGE_TIERS.length; i++) {
      expect(CASPIAN_VOYAGE_TIERS[i].xpRequired).toBeGreaterThan(
        CASPIAN_VOYAGE_TIERS[i - 1].xpRequired,
      );
    }
  });

  it('every card slug it names actually exists', () => {
    for (const t of CASPIAN_VOYAGE_TIERS) {
      if (t.reward.type === 'card') {
        expect(SEASON_CARDS_BY_SLUG[t.reward.cardSlug], t.reward.cardSlug).toBeDefined();
      }
    }
  });

  it('every cosmetic unlockRef it names actually exists', () => {
    for (const t of CASPIAN_VOYAGE_TIERS) {
      if (t.reward.type === 'cosmetic') {
        expect(ITEM_CATALOG[t.reward.unlockRef], t.reward.unlockRef).toBeDefined();
      }
      if (t.reward.type === 'cosmetic_set') {
        for (const ref of t.reward.unlockRefs) {
          expect(ITEM_CATALOG[ref], ref).toBeDefined();
        }
      }
    }
  });

  it('the tier-30 trophy exists in the seed script', () => {
    const grand = CASPIAN_VOYAGE_TIERS[29].reward;
    expect(grand.type).toBe('cosmetic_set');
    if (grand.type === 'cosmetic_set') {
      expect(TROPHIES.some((t) => t.slug === grand.trophySlug)).toBe(true);
    }
  });

  it('awards all five Caspian cards, and none of summer’s', () => {
    const slugs = CASPIAN_VOYAGE_TIERS.flatMap((t) =>
      t.reward.type === 'card' ? [t.reward.cardSlug] : [],
    );
    expect(slugs).toHaveLength(5);
    for (const s of slugs) expect(SEASON_CARDS_BY_SLUG[s].season).toBe('caspian-2026');
  });

  it('its cosmetics are reward-only and on the season theme', () => {
    // A season cosmetic that leaked into the shop would be buyable with coins,
    // which is the whole distinction between earned and sold.
    for (const t of CASPIAN_VOYAGE_TIERS) {
      const refs =
        t.reward.type === 'cosmetic'
          ? [t.reward.unlockRef]
          : t.reward.type === 'cosmetic_set'
            ? t.reward.unlockRefs
            : [];
      for (const ref of refs) {
        expect(ITEM_CATALOG[ref].rewardOnly, ref).toBe(true);
        expect(ITEM_CATALOG[ref].theme, ref).toBe('season');
      }
    }
  });

  it('is FRONT-LOADED relative to summer — the point of the recalibration', () => {
    // Measured over the summer season the two children earned 113 and 19
    // XP/day; over the four weeks after it, 64 and 5. On the lighter rate a
    // 12-week season buys ~420 XP, so summer's tier 10 (950) put the lighter
    // player four rungs up a thirty-rung ladder. A track a child watches
    // without moving is worse than a shorter one she finishes.
    const t10 = CASPIAN_VOYAGE_TIERS[9].xpRequired;
    expect(t10).toBeLessThan(SUMMER_VOYAGE_TIERS[9].xpRequired);
    expect(t10).toBeLessThanOrEqual(420);
    // The summit stays a real climb, so the heavier player still has a season.
    expect(CASPIAN_VOYAGE_TIERS[29].xpRequired).toBeGreaterThanOrEqual(3500);
  });

  it('pays 存钱罐 money at exactly tiers 10, 20 and 30, like summer', () => {
    const paid = CASPIAN_VOYAGE_TIERS.filter((t) => t.bonusMoneyPence);
    expect(paid.map((t) => t.tier)).toEqual([10, 20, 30]);
    expect(paid.map((t) => t.bonusMoneyPence)).toEqual([50, 100, 150]);
  });
});

describe('season cards data', () => {
  it('every card carries a season, so the Backpack can group them', () => {
    for (const c of SEASON_CARD_ITEMS) expect(c.season, c.slug).toBeTruthy();
  });

  it('slugs are unique across seasons — one pack holds them all', () => {
    const slugs = SEASON_CARD_ITEMS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('the Caspian cards teach a real, checkable fact in BOTH languages', () => {
    // The season's subject — the countries, peoples and history around the
    // Caspian — lives in this lore and deliberately NOT on the cosmetics.
    const caspian = SEASON_CARD_ITEMS.filter((c) => c.season === 'caspian-2026');
    expect(caspian).toHaveLength(5);
    for (const c of caspian) {
      expect(c.loreZh.length, c.slug).toBeGreaterThan(8);
      expect(c.loreEn.length, c.slug).toBeGreaterThan(20);
      expect(c.nameZh, c.slug).toBeTruthy();
      expect(c.nameEn, c.slug).toBeTruthy();
    }
  });

  it('the season id is not reused', () => {
    expect(CASPIAN_VOYAGE_META.id).not.toBe('summer-voyage-2026');
  });
});
