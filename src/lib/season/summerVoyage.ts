import type { SeasonTier } from './types';

export const SUMMER_VOYAGE_SLUG = 'summer-voyage-2026';

export const SUMMER_VOYAGE_META = {
  id: SUMMER_VOYAGE_SLUG,
  nameZh: '夏季航海',
  nameEn: 'Summer Voyage',
  themeEmoji: '⛵',
} as const;

/**
 * 30 tiers — see the spec §3 table. Cosmetic `unlockRef`s match the itemCatalog
 * season items; card `cardSlug`s match seasonCardsData; the tier-30 `trophySlug`
 * matches seed-trophies. Strictly increasing `xpRequired` (the levels math relies
 * on it; season-config.test.ts guards the invariant).
 */
export const SUMMER_VOYAGE_TIERS: SeasonTier[] = [
  { tier: 1, xpRequired: 50, reward: { type: 'coins', amount: 100 } },
  { tier: 2, xpRequired: 100, reward: { type: 'cosmetic', unlockRef: 'season-sailor-hat' } },
  { tier: 3, xpRequired: 175, reward: { type: 'coins', amount: 50 } },
  { tier: 4, xpRequired: 250, reward: { type: 'powerup', kind: 'streak_freeze', count: 1 } },
  { tier: 5, xpRequired: 350, reward: { type: 'cosmetic', unlockRef: 'season-anchor-decor' } },
  { tier: 6, xpRequired: 450, reward: { type: 'coins', amount: 100 } },
  { tier: 7, xpRequired: 550, reward: { type: 'powerup', kind: 'skip', count: 2 } },
  { tier: 8, xpRequired: 675, reward: { type: 'shards', amount: 5 } },
  { tier: 9, xpRequired: 800, reward: { type: 'cosmetic', unlockRef: 'season-parrot-decor' } },
  { tier: 10, xpRequired: 950, reward: { type: 'card', cardSlug: 'season-tortoise' } },
  { tier: 11, xpRequired: 1100, reward: { type: 'coins', amount: 150 } },
  { tier: 12, xpRequired: 1250, reward: { type: 'powerup', kind: 'skip', count: 2 } },
  { tier: 13, xpRequired: 1400, reward: { type: 'cosmetic', unlockRef: 'season-spyglass-decor' } },
  { tier: 14, xpRequired: 1575, reward: { type: 'coins', amount: 200 } },
  { tier: 15, xpRequired: 1750, reward: { type: 'cosmetic', unlockRef: 'season-wheel-decor' } },
  { tier: 16, xpRequired: 1950, reward: { type: 'powerup', kind: 'streak_freeze', count: 1 } },
  { tier: 17, xpRequired: 2150, reward: { type: 'coins', amount: 250 } },
  { tier: 18, xpRequired: 2350, reward: { type: 'cosmetic', unlockRef: 'season-sunset-bg' } },
  { tier: 19, xpRequired: 2575, reward: { type: 'card', cardSlug: 'season-flyingfish' } },
  { tier: 20, xpRequired: 2800, reward: { type: 'card', cardSlug: 'season-dolphin' } },
  { tier: 21, xpRequired: 3050, reward: { type: 'coins', amount: 300 } },
  { tier: 22, xpRequired: 3200, reward: { type: 'shards', amount: 8 } },
  { tier: 23, xpRequired: 3300, reward: { type: 'coins', amount: 300 } },
  { tier: 24, xpRequired: 3400, reward: { type: 'shards', amount: 8 } },
  { tier: 25, xpRequired: 3500, reward: { type: 'card', cardSlug: 'season-kraken' } },
  { tier: 26, xpRequired: 3650, reward: { type: 'coins', amount: 400 } },
  { tier: 27, xpRequired: 3800, reward: { type: 'coins', amount: 400 } },
  { tier: 28, xpRequired: 3900, reward: { type: 'shards', amount: 10 } },
  { tier: 29, xpRequired: 3950, reward: { type: 'coins', amount: 400 } },
  {
    tier: 30,
    xpRequired: 4100,
    reward: {
      type: 'cosmetic_set',
      unlockRefs: ['season-captain-coat', 'season-captain-hat'],
      trophySlug: 'season-summer-master',
    },
  },
];
