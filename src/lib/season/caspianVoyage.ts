import type { SeasonTier } from './types';

export const CASPIAN_VOYAGE_SLUG = 'caspian-voyage-2026';

export const CASPIAN_VOYAGE_META = {
  id: CASPIAN_VOYAGE_SLUG,
  nameZh: '里海远航',
  nameEn: 'Caspian Passage',
  themeEmoji: '🏺',
} as const;

/**
 * 30 tiers, deliberately FRONT-LOADED — the one real change from 夏季航海.
 *
 * Summer put tier 10 at 950 XP. Measured over that season, the two children
 * earned 113 and **19** XP/day; over the four weeks after it ended, 64 and
 * **5**. On the lighter of those rates a 12-week season buys ~420 XP total, so
 * summer's curve hands one child a 30-tier track she can see and reach four
 * rungs of. This one puts tier 10 at 400, so a light player still finishes the
 * first third, while tier 30 stays at 4,000 and remains a real climb for the
 * heavier player (~9 weeks at 64/day).
 *
 * A track a child watches without moving is worse than a shorter one she
 * finishes, in a product that softens 畏难情绪 everywhere else — `boss_courage`
 * pays on a LOSS, the boss keeps progress on retry, T3 names rewards before
 * the fight.
 *
 * Invariants (`season-config.test.ts` pins them): 30 tiers numbered 1..30,
 * `xpRequired` strictly increasing (the levels math depends on it), cosmetic
 * `unlockRef`s matching itemCatalog, `cardSlug`s matching seasonCardsData, and
 * tier 30's `trophySlug` matching seed-trophies.
 */
export const CASPIAN_VOYAGE_TIERS: SeasonTier[] = [
  { tier: 1, xpRequired: 40, reward: { type: 'coins', amount: 100 } },
  { tier: 2, xpRequired: 90, reward: { type: 'cosmetic', unlockRef: 'season-caspian-lantern' } },
  { tier: 3, xpRequired: 140, reward: { type: 'coins', amount: 60 } },
  { tier: 4, xpRequired: 190, reward: { type: 'powerup', kind: 'streak_freeze', count: 1 } },
  { tier: 5, xpRequired: 240, reward: { type: 'cosmetic', unlockRef: 'season-caspian-compass' } },
  { tier: 6, xpRequired: 280, reward: { type: 'coins', amount: 100 } },
  { tier: 7, xpRequired: 310, reward: { type: 'powerup', kind: 'skip', count: 2 } },
  { tier: 8, xpRequired: 340, reward: { type: 'card', cardSlug: 'season-caspian-seal' } },
  { tier: 9, xpRequired: 370, reward: { type: 'shards', amount: 5 } },
  { tier: 10, xpRequired: 400, reward: { type: 'cosmetic', unlockRef: 'season-caspian-seal-decor' }, bonusMoneyPence: 50 },
  { tier: 11, xpRequired: 500, reward: { type: 'coins', amount: 150 } },
  { tier: 12, xpRequired: 620, reward: { type: 'powerup', kind: 'skip', count: 2 } },
  { tier: 13, xpRequired: 740, reward: { type: 'cosmetic', unlockRef: 'season-caspian-pomegranate' } },
  { tier: 14, xpRequired: 860, reward: { type: 'card', cardSlug: 'season-caspian-sturgeon' } },
  { tier: 15, xpRequired: 980, reward: { type: 'coins', amount: 200 } },
  { tier: 16, xpRequired: 1100, reward: { type: 'powerup', kind: 'streak_freeze', count: 1 } },
  { tier: 17, xpRequired: 1220, reward: { type: 'shards', amount: 6 } },
  { tier: 18, xpRequired: 1340, reward: { type: 'cosmetic', unlockRef: 'season-caspian-steppe-bg' } },
  { tier: 19, xpRequired: 1470, reward: { type: 'coins', amount: 250 } },
  { tier: 20, xpRequired: 1600, reward: { type: 'card', cardSlug: 'season-caspian-eagle' }, bonusMoneyPence: 100 },
  { tier: 21, xpRequired: 1830, reward: { type: 'coins', amount: 300 } },
  { tier: 22, xpRequired: 2060, reward: { type: 'shards', amount: 8 } },
  { tier: 23, xpRequired: 2290, reward: { type: 'cosmetic', unlockRef: 'season-caspian-explorer-hat' } },
  { tier: 24, xpRequired: 2520, reward: { type: 'coins', amount: 300 } },
  { tier: 25, xpRequired: 2750, reward: { type: 'card', cardSlug: 'season-caspian-horse' } },
  { tier: 26, xpRequired: 2990, reward: { type: 'coins', amount: 400 } },
  { tier: 27, xpRequired: 3230, reward: { type: 'shards', amount: 10 } },
  { tier: 28, xpRequired: 3480, reward: { type: 'coins', amount: 400 } },
  { tier: 29, xpRequired: 3730, reward: { type: 'card', cardSlug: 'season-caspian-baku' } },
  {
    tier: 30,
    xpRequired: 4000,
    reward: {
      type: 'cosmetic_set',
      unlockRefs: ['season-caspian-silkroad-coat', 'season-caspian-silkroad-hat'],
      trophySlug: 'season-caspian-master',
    },
    bonusMoneyPence: 150,
  },
];
