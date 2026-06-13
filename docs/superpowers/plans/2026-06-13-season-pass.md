# Season Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A calendar-fixed, limited-time 30-tier reward track that turns the already-shipped XP currency into a season-long goal, with zero changes to any existing earn loop.

**Architecture:** Season progress is **derived** from the existing `xp_events` ledger — `seasonXp = SUM(xp_events.amount)` within the season's `[starts_at, ends_at]` window. A `seasons` row holds the typed tier config in JSONB; per-child claim state is an `int[]` of claimed tiers in `child_season_progress`. Rewards dispatch by type, reusing the shipped coin / powerup / shard / collectible-card / reward-only-avatar-theme mechanics. Auto-bank at season end (nothing lost); per-tap claim + chest reveal during the season.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM (Neon Postgres, append-only migrations), Clerk, Vitest + RTL + jsdom, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-13-season-pass-design.md` (read §3 for the authoritative 30-tier reward table).

**Branch:** `feat/season-pass` (exists; spec committed).

**Four-green gate (run before PR open):** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

---

## Conventions you MUST follow (from CLAUDE.md)

- **`'use server'` files** (`src/lib/actions/*`) export ONLY async functions. Pure helpers/errors go in `src/lib/errors/*` or `src/lib/season/*`.
- **`src/lib/db/*` is server-only** (postgres). NEVER import it into a `'use client'` component.
- **Never pass a function-bearing object (`PackUiMeta`) across an RSC boundary.** Client components take `packSlug: string` and call `getPackMeta(slug)` themselves.
- **Tests mock external boundaries**: `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`. Any action test that transitively imports a new `@/lib/db/*` must `vi.mock` it, or the real `@/db` import throws `DATABASE_URL` at load.
- **Bilingual chrome rule**: every new kid-facing label is `中文 / English` (ZH first). Use `bi(zh, en)` from `@/lib/i18n/bilingual` or paired spans.
- **Drizzle migrations are append-only.** Generate, never hand-edit committed SQL. Source of truth is `src/db/schema/*.ts`.
- **Reduced motion**: any animated fx must respect `useReducedMotion()`.
- **`react-hooks/purity`**: no `Date.now()`/`Math.random()` in render bodies — pass `nowMs` as a server-computed prop.

---

## File structure

**New files**
- `src/db/schema/season.ts` — `seasons` + `childSeasonProgress` tables.
- `src/lib/season/types.ts` — `SeasonReward` union, `SeasonTier`, `SeasonRow` types.
- `src/lib/season/summerVoyage.ts` — the typed tier config + season metadata constant (single source of truth; the seed writes it to JSONB).
- `src/lib/season/levels.ts` — pure: `tierForSeasonXp`, `xpToNextTier`, `claimableTiers`.
- `src/lib/errors/season-errors.ts` — pure error classes (client-safe).
- `src/lib/db/season.ts` — `getActiveSeason`, `getSeasonXp`, `getSeasonProgress`, `claimSeasonTierInTx`, `syncSeasonProgress`, `getSeasonView`, `getSeasonBannerState`.
- `src/lib/actions/season.ts` — `claimSeasonTierAction`, `claimAllSeasonTiersAction`.
- `src/lib/collections/seasonCardsData.ts` — 4 season cards.
- `src/components/play/items/SeasonCard.tsx` — card renderer (wraps `CardArt`).
- `src/components/play/SeasonBanner.tsx` — home banner (server-rendered link).
- `src/app/play/[childId]/season/page.tsx` — season route.
- `src/components/play/SeasonTrack.tsx` — client track (claim + `CardChestReveal`).
- `scripts/seed-season-summer.ts`, `scripts/seed-season-cards.ts` — idempotent seeds.

**Modified files**
- `src/db/schema/economy.ts` — add `'season_reward'` to `coinReason`.
- `src/db/schema/trophies.ts` — add `'season'` to `trophyCategory`.
- `src/db/schema/index.ts` — `export * from './season'`.
- `src/lib/collections/packRegistry.ts` — add `season-summer-v1` entry.
- `src/lib/avatar/themes.ts` — add `'season'` theme + display name + `REWARD_THEMES`.
- `src/lib/avatar/itemCatalog.tsx` — add 8 season cosmetics to `ALL_ITEMS`.
- `src/lib/db/shop.ts` — add `'season'` to `REWARD_WARDROBE_THEMES`.
- `src/app/play/[childId]/page.tsx` — mount `SeasonBanner`.
- `scripts/seed-trophies.ts` — add `season-summer-master`; widen `Category` type.
- `scripts/generate-collectible-art-cloudflare.ts` — add `season-summer-v1` prompt recipe.

---

## Task 1: Schema — season tables + enum additions + migration

**Files:**
- Create: `src/db/schema/season.ts`
- Modify: `src/db/schema/economy.ts:15-30` (coinReason), `src/db/schema/trophies.ts:13-20` (trophyCategory), `src/db/schema/index.ts`
- Generate: `drizzle/0029_*.sql`

- [ ] **Step 1: Create the season schema file**

`src/db/schema/season.ts`:
```ts
import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

/** One active season at a time. `tier_config` holds SeasonTier[] (see src/lib/season/types.ts). */
export const seasons = pgTable('seasons', {
  id: text('id').primaryKey(), // slug, e.g. 'summer-voyage-2026'
  nameZh: text('name_zh').notNull(),
  nameEn: text('name_en').notNull(),
  themeEmoji: text('theme_emoji').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  tierConfig: jsonb('tier_config').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Per-child claim state. Season XP is DERIVED (sum of xp_events in window) — not stored here. */
export const childSeasonProgress = pgTable(
  'child_season_progress',
  {
    childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
    seasonId: text('season_id').notNull().references(() => seasons.id),
    tiersClaimed: integer('tiers_claimed').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.seasonId] })],
);
```

- [ ] **Step 2: Add the coin reason + trophy category enum values**

In `src/db/schema/economy.ts`, append `'season_reward'` as the last element of the `coinReason` `pgEnum` array (after `'homework_complete'`).

In `src/db/schema/trophies.ts`, append `'season'` as the last element of the `trophyCategory` `pgEnum` array (after `'story'`).

In `src/db/schema/index.ts`, add `export * from './season';` (after the `homework` line).

- [ ] **Step 3: Generate the migration**

Run: `pnpm drizzle-kit generate`
Expected: a new `drizzle/0029_*.sql` containing `CREATE TABLE "seasons"`, `CREATE TABLE "child_season_progress"`, `ALTER TYPE "coin_reason" ADD VALUE 'season_reward'`, `ALTER TYPE "trophy_category" ADD VALUE 'season'`.

Verify visually that the generated SQL has all four statements. Do NOT hand-edit it.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (the new tables compile; `db.insert(seasons)` etc. are type-valid).

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/season.ts src/db/schema/economy.ts src/db/schema/trophies.ts src/db/schema/index.ts drizzle/0029_*.sql drizzle/meta
git commit -m "feat(season): schema — seasons + child_season_progress + enum values (migration 0029)"
```

---

## Task 2: Pure season-levels math

**Files:**
- Create: `src/lib/season/types.ts`, `src/lib/season/levels.ts`
- Test: `tests/unit/season-levels.test.ts`

- [ ] **Step 1: Define the reward + tier types**

`src/lib/season/types.ts`:
```ts
export type SeasonReward =
  | { type: 'coins'; amount: number }
  | { type: 'powerup'; kind: 'skip' | 'streak_freeze'; count: number }
  | { type: 'shards'; amount: number }
  | { type: 'card'; cardSlug: string } // resolved within the season-summer-v1 pack
  | { type: 'cosmetic'; unlockRef: string } // avatar_items.unlock_ref
  | { type: 'cosmetic_set'; unlockRefs: string[]; trophySlug: string };

export interface SeasonTier {
  tier: number; // 1..30
  xpRequired: number; // cumulative XP to reach this tier
  reward: SeasonReward;
}

export interface SeasonRow {
  id: string;
  nameZh: string;
  nameEn: string;
  themeEmoji: string;
  startsAt: Date;
  endsAt: Date;
  tierConfig: SeasonTier[];
  isActive: boolean;
}
```

- [ ] **Step 2: Write the failing test**

`tests/unit/season-levels.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { tierForSeasonXp, xpToNextTier, claimableTiers } from '@/lib/season/levels';
import type { SeasonTier } from '@/lib/season/types';

const tiers: SeasonTier[] = [
  { tier: 1, xpRequired: 50, reward: { type: 'coins', amount: 100 } },
  { tier: 2, xpRequired: 100, reward: { type: 'coins', amount: 50 } },
  { tier: 3, xpRequired: 175, reward: { type: 'coins', amount: 50 } },
];

describe('season levels', () => {
  it('tierForSeasonXp returns the highest tier whose xpRequired <= xp (0 below tier 1)', () => {
    expect(tierForSeasonXp(0, tiers)).toBe(0);
    expect(tierForSeasonXp(49, tiers)).toBe(0);
    expect(tierForSeasonXp(50, tiers)).toBe(1);
    expect(tierForSeasonXp(120, tiers)).toBe(2);
    expect(tierForSeasonXp(9999, tiers)).toBe(3);
  });

  it('xpToNextTier returns XP remaining to the next unreached tier, or null at max', () => {
    expect(xpToNextTier(0, tiers)).toBe(50);
    expect(xpToNextTier(60, tiers)).toBe(40); // → tier 2 at 100
    expect(xpToNextTier(175, tiers)).toBeNull(); // all reached
  });

  it('claimableTiers = reached tiers not in tiersClaimed', () => {
    expect(claimableTiers(120, [], tiers)).toEqual([1, 2]);
    expect(claimableTiers(120, [1], tiers)).toEqual([2]);
    expect(claimableTiers(49, [], tiers)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test season-levels`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement**

`src/lib/season/levels.ts`:
```ts
import type { SeasonTier } from './types';

/** Highest tier whose cumulative xpRequired ≤ xp; 0 when below tier 1. */
export function tierForSeasonXp(xp: number, tiers: SeasonTier[]): number {
  let reached = 0;
  for (const t of tiers) {
    if (xp >= t.xpRequired) reached = t.tier;
    else break;
  }
  return reached;
}

/** XP remaining to the next unreached tier; null when every tier is reached. */
export function xpToNextTier(xp: number, tiers: SeasonTier[]): number | null {
  for (const t of tiers) {
    if (xp < t.xpRequired) return t.xpRequired - xp;
  }
  return null;
}

/** Reached tiers (by xp) that are not yet in `claimed`. Sorted ascending. */
export function claimableTiers(xp: number, claimed: number[], tiers: SeasonTier[]): number[] {
  const claimedSet = new Set(claimed);
  return tiers.filter((t) => xp >= t.xpRequired && !claimedSet.has(t.tier)).map((t) => t.tier);
}
```
(Assumes `tiers` is sorted ascending by `xpRequired`, which the config guarantees — Task 3 tests that invariant.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test season-levels`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/season/types.ts src/lib/season/levels.ts tests/unit/season-levels.test.ts
git commit -m "feat(season): pure tier math (tierForSeasonXp / xpToNextTier / claimableTiers)"
```

---

## Task 3: Summer Voyage tier config

**Files:**
- Create: `src/lib/season/summerVoyage.ts`
- Test: `tests/unit/season-config.test.ts`

- [ ] **Step 1: Write the config**

`src/lib/season/summerVoyage.ts` — encode the **spec §3** table exactly. Season metadata + 30 tiers:
```ts
import type { SeasonTier } from './types';

export const SUMMER_VOYAGE_SLUG = 'summer-voyage-2026';
export const SUMMER_VOYAGE_META = {
  id: SUMMER_VOYAGE_SLUG,
  nameZh: '夏季航海',
  nameEn: 'Summer Voyage',
  themeEmoji: '⛵',
} as const;

/** 30 tiers — see spec §3. Cosmetic unlockRefs match itemCatalog (Task 9); card
 * slugs match seasonCardsData (Task 8); the trophy slug matches seed-trophies (Task 12). */
export const SUMMER_VOYAGE_TIERS: SeasonTier[] = [
  { tier: 1,  xpRequired: 50,   reward: { type: 'coins', amount: 100 } },
  { tier: 2,  xpRequired: 100,  reward: { type: 'cosmetic', unlockRef: 'season-sailor-hat' } },
  { tier: 3,  xpRequired: 175,  reward: { type: 'coins', amount: 50 } },
  { tier: 4,  xpRequired: 250,  reward: { type: 'powerup', kind: 'streak_freeze', count: 1 } },
  { tier: 5,  xpRequired: 350,  reward: { type: 'cosmetic', unlockRef: 'season-anchor-decor' } },
  { tier: 6,  xpRequired: 450,  reward: { type: 'coins', amount: 100 } },
  { tier: 7,  xpRequired: 550,  reward: { type: 'powerup', kind: 'skip', count: 2 } },
  { tier: 8,  xpRequired: 675,  reward: { type: 'shards', amount: 5 } },
  { tier: 9,  xpRequired: 800,  reward: { type: 'cosmetic', unlockRef: 'season-parrot-decor' } },
  { tier: 10, xpRequired: 950,  reward: { type: 'card', cardSlug: 'season-tortoise' } },
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
  { tier: 30, xpRequired: 4100, reward: { type: 'cosmetic_set', unlockRefs: ['season-captain-coat', 'season-captain-hat'], trophySlug: 'season-summer-master' } },
];
```

- [ ] **Step 2: Write the invariant test**

`tests/unit/season-config.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

describe('Summer Voyage config', () => {
  it('has 30 tiers numbered 1..30', () => {
    expect(SUMMER_VOYAGE_TIERS).toHaveLength(30);
    SUMMER_VOYAGE_TIERS.forEach((t, i) => expect(t.tier).toBe(i + 1));
  });

  it('xpRequired is strictly increasing (levels math depends on this)', () => {
    for (let i = 1; i < SUMMER_VOYAGE_TIERS.length; i++) {
      expect(SUMMER_VOYAGE_TIERS[i].xpRequired).toBeGreaterThan(SUMMER_VOYAGE_TIERS[i - 1].xpRequired);
    }
  });

  it('references exactly 4 season cards and the grand-set trophy at tier 30', () => {
    const cards = SUMMER_VOYAGE_TIERS.filter((t) => t.reward.type === 'card');
    expect(cards).toHaveLength(4);
    const grand = SUMMER_VOYAGE_TIERS[29].reward;
    expect(grand.type).toBe('cosmetic_set');
    if (grand.type === 'cosmetic_set') {
      expect(grand.unlockRefs).toHaveLength(2);
      expect(grand.trophySlug).toBe('season-summer-master');
    }
  });
});
```

- [ ] **Step 3: Run test**

Run: `pnpm test season-config`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/season/summerVoyage.ts tests/unit/season-config.test.ts
git commit -m "feat(season): Summer Voyage 30-tier config"
```

---

## Task 4: DB reads — active season, derived season XP, progress

**Files:**
- Create: `src/lib/db/season.ts` (reads only this task), `src/lib/errors/season-errors.ts`
- Test: `tests/unit/season-db-reads.test.ts`

- [ ] **Step 1: Pure errors**

`src/lib/errors/season-errors.ts`:
```ts
export class NoActiveSeasonError extends Error {
  constructor() { super('No active season'); this.name = 'NoActiveSeasonError'; }
}
export class TierNotReachedError extends Error {
  constructor(public tier: number) { super(`Tier ${tier} not reached`); this.name = 'TierNotReachedError'; }
}
```

- [ ] **Step 2: Write the failing test**

`tests/unit/season-db-reads.test.ts` (mock `@/db`):
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: [] as unknown[], sumValue: 0 }));

vi.mock('@/db', () => {
  const chain = {
    from: () => chain, where: () => chain, limit: () => Promise.resolve(mocks.rows),
  };
  return {
    db: {
      select: (sel?: unknown) =>
        // sum query returns [{ total }]; row query returns mocks.rows
        sel && 'total' in (sel as Record<string, unknown>)
          ? { from: () => ({ where: () => Promise.resolve([{ total: mocks.sumValue }]) }) }
          : chain,
    },
  };
});

import { getActiveSeason, getSeasonXp } from '@/lib/db/season';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

beforeEach(() => { mocks.rows = []; mocks.sumValue = 0; });

describe('season db reads', () => {
  it('getActiveSeason returns null when no active row', async () => {
    mocks.rows = [];
    expect(await getActiveSeason()).toBeNull();
  });

  it('getActiveSeason maps a row to SeasonRow with parsed tierConfig', async () => {
    mocks.rows = [{
      id: 's1', nameZh: '夏', nameEn: 'Summer', themeEmoji: '⛵',
      startsAt: new Date('2026-06-15'), endsAt: new Date('2026-08-10'),
      tierConfig: SUMMER_VOYAGE_TIERS, isActive: true,
    }];
    const s = await getActiveSeason();
    expect(s?.id).toBe('s1');
    expect(s?.tierConfig).toHaveLength(30);
  });

  it('getSeasonXp returns the windowed sum', async () => {
    mocks.sumValue = 1234;
    const s = { id: 's1', startsAt: new Date('2026-06-15'), endsAt: new Date('2026-08-10') } as never;
    expect(await getSeasonXp('c1', s)).toBe(1234);
  });
});
```
(The mock is intentionally loose; the goal is to pin the row→SeasonRow mapping and the sum extraction, not Drizzle internals.)

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test season-db-reads`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the reads**

`src/lib/db/season.ts` (this task adds only the reads; later tasks append to the same file):
```ts
// NEVER import this file from client code. It pulls in postgres.
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { seasons, childSeasonProgress, xpEvents } from '@/db/schema';
import type { SeasonRow, SeasonTier } from '@/lib/season/types';

function mapSeason(row: typeof seasons.$inferSelect): SeasonRow {
  return {
    id: row.id, nameZh: row.nameZh, nameEn: row.nameEn, themeEmoji: row.themeEmoji,
    startsAt: row.startsAt, endsAt: row.endsAt,
    tierConfig: row.tierConfig as SeasonTier[],
    isActive: row.isActive,
  };
}

/** The single active season (is_active = true), or null. */
export async function getActiveSeason(): Promise<SeasonRow | null> {
  const rows = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  return rows[0] ? mapSeason(rows[0]) : null;
}

/** Derived season XP: sum of xp_events.amount within [startsAt, endsAt]. */
export async function getSeasonXp(childId: string, season: Pick<SeasonRow, 'startsAt' | 'endsAt'>): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(and(
      eq(xpEvents.childId, childId),
      gte(xpEvents.createdAt, season.startsAt),
      lte(xpEvents.createdAt, season.endsAt),
    ));
  return Number(row?.total ?? 0);
}

/** Per-child claim state; ensures a row exists (idempotent). */
export async function getSeasonProgress(childId: string, seasonId: string): Promise<number[]> {
  const rows = await db
    .select({ tiersClaimed: childSeasonProgress.tiersClaimed })
    .from(childSeasonProgress)
    .where(and(eq(childSeasonProgress.childId, childId), eq(childSeasonProgress.seasonId, seasonId)))
    .limit(1);
  return rows[0]?.tiersClaimed ?? [];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test season-db-reads`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/season.ts src/lib/errors/season-errors.ts tests/unit/season-db-reads.test.ts
git commit -m "feat(season): db reads — active season, derived season XP, claim state"
```

---

## Task 5: `claimSeasonTierInTx` reward dispatch

**Files:**
- Modify: `src/lib/db/season.ts` (append the dispatch + claim helpers)
- Test: `tests/unit/season-claim.test.ts`

This is the core grant logic. It claims ONE tier inside a transaction: verifies the tier is reached + not already claimed, grants the reward by type, then appends the tier to `tiers_claimed`.

- [ ] **Step 1: Write the failing test**

`tests/unit/season-claim.test.ts` — mock `@/db` with a transaction stub that records calls. Test each reward type routes to the right grant + idempotency. Use a spy-based tx:
```ts
import { describe, expect, it, vi } from 'vitest';

// Capture which grant branch ran via the inserted table name.
const inserts: string[] = [];
vi.mock('@/db', () => {
  const tx = {
    insert: (table: { _: { name?: string } } | unknown) => {
      inserts.push(JSON.stringify(table).slice(0, 40));
      return { values: () => ({ onConflictDoNothing: () => Promise.resolve(), onConflictDoUpdate: () => Promise.resolve(), returning: () => Promise.resolve([{ shards: 5 }]) }) };
    },
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  };
  return { db: { transaction: (cb: (t: typeof tx) => unknown) => cb(tx) } };
});

import { claimSeasonTierInTx } from '@/lib/db/season';
import type { SeasonTier } from '@/lib/season/types';
```
Because the table-name capture is brittle, prefer asserting the **return shape** instead: `claimSeasonTierInTx` returns `{ claimed: true, reveal: RevealCard | null }` for card/cosmetic tiers and `{ claimed: true, reveal: null }` for coins/powerup/shards; and `{ claimed: false }` when the tier is already in `claimed`. Write the test to assert those returns for: a coins tier, a powerup tier, a shards tier, an already-claimed tier (returns `claimed: false`), and a card tier (returns a reveal with the resolved name). Mock the collectible lookup `select` to return the card row for the card-tier case.

(Keep the test focused on the return contract; the per-branch DB writes are covered by the integration of reusing the already-tested `awardCoinsInTx` / festival card-grant pattern.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test season-claim`
Expected: FAIL (`claimSeasonTierInTx` not exported).

- [ ] **Step 3: Implement the dispatch**

Append to `src/lib/db/season.ts`:
```ts
import {
  collectionPacks, collectibleItems, childCollections,
  childShards, powerupInventory, avatarItems, childAvatarInventory,
  childAvatarEquipped, trophies, childTrophies,
} from '@/db/schema';
import { awardCoinsInTx } from '@/lib/db/coins';
import type { Tx } from '@/lib/db/grants';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { SeasonReward } from '@/lib/season/types';

export const SEASON_PACK_SLUG = 'season-summer-v1';

export interface SeasonClaimResult { claimed: boolean; reveal: RevealCard | null; }

async function grantCardInTx(tx: Tx, childId: string, cardSlug: string): Promise<RevealCard> {
  const [item] = await tx
    .select({
      id: collectibleItems.id, slug: collectibleItems.slug,
      nameZh: collectibleItems.nameZh, nameEn: collectibleItems.nameEn,
      loreZh: collectibleItems.loreZh, loreEn: collectibleItems.loreEn,
    })
    .from(collectibleItems)
    .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
    .where(and(eq(collectionPacks.slug, SEASON_PACK_SLUG), eq(collectibleItems.slug, cardSlug)));
  if (!item) throw new Error(`season card not seeded: ${SEASON_PACK_SLUG}/${cardSlug}`);

  const owned = await tx
    .select({ count: childCollections.count })
    .from(childCollections)
    .where(and(eq(childCollections.childId, childId), eq(childCollections.itemId, item.id)));
  const isDupe = owned.length > 0;
  if (isDupe) {
    await tx.update(childCollections).set({ count: sql`${childCollections.count} + 1` })
      .where(and(eq(childCollections.childId, childId), eq(childCollections.itemId, item.id)));
  } else {
    await tx.insert(childCollections).values({ childId, itemId: item.id, count: 1 });
  }
  return { id: item.id, slug: item.slug, packSlug: SEASON_PACK_SLUG, nameZh: item.nameZh, nameEn: item.nameEn, loreZh: item.loreZh, loreEn: item.loreEn, isDupe, shardsAfter: 0 };
}

async function grantCosmeticInTx(tx: Tx, childId: string, unlockRef: string, equip: boolean): Promise<void> {
  const [item] = await tx.select({ id: avatarItems.id, slotId: avatarItems.slotId })
    .from(avatarItems).where(eq(avatarItems.unlockRef, unlockRef)).limit(1);
  if (!item) return; // best effort — not seeded yet
  await tx.insert(childAvatarInventory).values({ childId, avatarItemId: item.id }).onConflictDoNothing();
  if (equip) {
    await tx.insert(childAvatarEquipped).values({ childId, slotId: item.slotId, avatarItemId: item.id })
      .onConflictDoUpdate({ target: [childAvatarEquipped.childId, childAvatarEquipped.slotId], set: { avatarItemId: item.id } });
  }
}

async function grantTrophyInTx(tx: Tx, childId: string, slug: string): Promise<void> {
  const [t] = await tx.select({ id: trophies.id }).from(trophies).where(eq(trophies.slug, slug)).limit(1);
  if (!t) return; // best effort — not seeded yet
  await tx.insert(childTrophies).values({ childId, trophyId: t.id }).onConflictDoNothing();
}

async function grantRewardInTx(tx: Tx, childId: string, seasonId: string, tier: number, reward: SeasonReward): Promise<RevealCard | null> {
  switch (reward.type) {
    case 'coins':
      await awardCoinsInTx(tx, { childId, delta: reward.amount, reason: 'season_reward', refType: 'season_tier', refId: `${seasonId}:${tier}` });
      return null;
    case 'powerup':
      await tx.insert(powerupInventory).values({ childId, kind: reward.kind, count: reward.count })
        .onConflictDoUpdate({ target: [powerupInventory.childId, powerupInventory.kind], set: { count: sql`${powerupInventory.count} + ${reward.count}` } });
      return null;
    case 'shards':
      await tx.insert(childShards).values({ childId, shards: reward.amount })
        .onConflictDoUpdate({ target: childShards.childId, set: { shards: sql`${childShards.shards} + ${reward.amount}` } });
      return null;
    case 'card':
      return grantCardInTx(tx, childId, reward.cardSlug);
    case 'cosmetic':
      await grantCosmeticInTx(tx, childId, reward.unlockRef, false); // NOT equipped
      return null;
    case 'cosmetic_set':
      for (const ref of reward.unlockRefs) await grantCosmeticInTx(tx, childId, ref, true); // grand set auto-equips
      await grantTrophyInTx(tx, childId, reward.trophySlug);
      return null;
  }
}

/** Claim one reached tier. Reads claim state FOR UPDATE-style (re-read inside tx), grants, appends. */
export async function claimSeasonTierInTx(tx: Tx, childId: string, seasonId: string, tier: SeasonTier): Promise<SeasonClaimResult> {
  // Ensure a progress row + read current claimed inside the tx.
  await tx.insert(childSeasonProgress).values({ childId, seasonId, tiersClaimed: [] }).onConflictDoNothing();
  const [row] = await tx.select({ tiersClaimed: childSeasonProgress.tiersClaimed })
    .from(childSeasonProgress)
    .where(and(eq(childSeasonProgress.childId, childId), eq(childSeasonProgress.seasonId, seasonId)))
    .limit(1);
  const claimed = row?.tiersClaimed ?? [];
  if (claimed.includes(tier.tier)) return { claimed: false, reveal: null };

  const reveal = await grantRewardInTx(tx, childId, seasonId, tier.tier, tier.reward);

  await tx.update(childSeasonProgress)
    .set({ tiersClaimed: sql`array_append(${childSeasonProgress.tiersClaimed}, ${tier.tier})` })
    .where(and(eq(childSeasonProgress.childId, childId), eq(childSeasonProgress.seasonId, seasonId)));
  return { claimed: true, reveal };
}
```

Note: confirm `powerupInventory` columns are `(childId, kind, count)` with a composite PK `(childId, kind)` (in `src/db/schema/avatar.ts`) — adjust the `onConflictDoUpdate` target if the column names differ.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test season-claim`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/season.ts tests/unit/season-claim.test.ts
git commit -m "feat(season): claimSeasonTierInTx — reward dispatch (coins/powerup/shards/card/cosmetic/set)"
```

---

## Task 6: `syncSeasonProgress` + view + banner state

**Files:**
- Modify: `src/lib/db/season.ts` (append)
- Test: `tests/unit/season-view.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/season-view.test.ts` — mock `getActiveSeason` / `getSeasonXp` / `getSeasonProgress` (vi.mock the season module partially is awkward; instead mock `@/db` and the helpers it calls). Simpler: extract the **pure view assembly** into a tested helper.

Add a pure helper `assembleSeasonView(season, xp, claimed, nowMs)` and test THAT:
```ts
import { describe, expect, it } from 'vitest';
import { assembleSeasonView } from '@/lib/season/view';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

const season = {
  id: 's1', nameZh: '夏季航海', nameEn: 'Summer Voyage', themeEmoji: '⛵',
  startsAt: new Date('2026-06-15'), endsAt: new Date('2026-08-10'),
  tierConfig: SUMMER_VOYAGE_TIERS, isActive: true,
};

describe('assembleSeasonView', () => {
  it('classifies each tier as locked / claimable / claimed', () => {
    const v = assembleSeasonView(season, 980, [10], Date.parse('2026-07-01'));
    expect(v.currentTier).toBe(10);
    const t10 = v.tiers.find((t) => t.tier === 10)!;
    expect(t10.state).toBe('claimed');
    const t9 = v.tiers.find((t) => t.tier === 9)!;
    expect(t9.state).toBe('claimable');
    const t11 = v.tiers.find((t) => t.tier === 11)!;
    expect(t11.state).toBe('locked');
  });

  it('reports XP-to-next and days remaining', () => {
    const v = assembleSeasonView(season, 980, [], Date.parse('2026-07-01'));
    expect(v.xpToNext).toBe(SUMMER_VOYAGE_TIERS[10].xpRequired - 980); // tier 11
    expect(v.daysRemaining).toBe(40); // 06-15 window: 07-01 → 08-10 = 40 days
    expect(v.ended).toBe(false);
  });

  it('marks ended after endsAt', () => {
    const v = assembleSeasonView(season, 980, [], Date.parse('2026-08-20'));
    expect(v.ended).toBe(true);
    expect(v.daysRemaining).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test season-view`
Expected: FAIL.

- [ ] **Step 3: Implement the pure view + the DB wrappers**

`src/lib/season/view.ts`:
```ts
import type { SeasonRow } from './types';
import { tierForSeasonXp, xpToNextTier } from './levels';

export interface SeasonViewTier {
  tier: number; xpRequired: number;
  reward: SeasonRow['tierConfig'][number]['reward'];
  state: 'locked' | 'claimable' | 'claimed';
}
export interface SeasonView {
  id: string; nameZh: string; nameEn: string; themeEmoji: string;
  seasonXp: number; currentTier: number; xpToNext: number | null;
  daysRemaining: number; ended: boolean;
  tiers: SeasonViewTier[];
}

const DAY_MS = 86_400_000;

export function assembleSeasonView(season: SeasonRow, xp: number, claimed: number[], nowMs: number): SeasonView {
  const claimedSet = new Set(claimed);
  const currentTier = tierForSeasonXp(xp, season.tierConfig);
  const ended = nowMs > season.endsAt.getTime();
  const daysRemaining = ended ? 0 : Math.max(0, Math.ceil((season.endsAt.getTime() - nowMs) / DAY_MS));
  const tiers: SeasonViewTier[] = season.tierConfig.map((t) => ({
    tier: t.tier, xpRequired: t.xpRequired, reward: t.reward,
    state: claimedSet.has(t.tier) ? 'claimed' : xp >= t.xpRequired ? 'claimable' : 'locked',
  }));
  return {
    id: season.id, nameZh: season.nameZh, nameEn: season.nameEn, themeEmoji: season.themeEmoji,
    seasonXp: xp, currentTier, xpToNext: xpToNextTier(xp, season.tierConfig),
    daysRemaining, ended, tiers,
  };
}
```

Append to `src/lib/db/season.ts`:
```ts
import { db } from '@/db'; // already imported at top
import { assembleSeasonView, type SeasonView } from '@/lib/season/view';
import { claimableTiers } from '@/lib/season/levels';

/** End-of-season auto-bank: if the season has ended, claim every reached-unclaimed tier silently. */
export async function syncSeasonProgress(childId: string): Promise<void> {
  const season = await getActiveSeason();
  if (!season) return;
  if (Date.now() <= season.endsAt.getTime()) return; // only sweep AFTER end
  const xp = await getSeasonXp(childId, season);
  const claimed = await getSeasonProgress(childId, season.id);
  const toClaim = claimableTiers(xp, claimed, season.tierConfig);
  if (toClaim.length === 0) return;
  await db.transaction(async (tx) => {
    for (const tierNum of toClaim) {
      const tier = season.tierConfig.find((t) => t.tier === tierNum)!;
      await claimSeasonTierInTx(tx, childId, season.id, tier);
    }
  });
}

/** Full season view for the season page. Returns null when no active season. */
export async function getSeasonView(childId: string): Promise<SeasonView | null> {
  const season = await getActiveSeason();
  if (!season) return null;
  const [xp, claimed] = await Promise.all([getSeasonXp(childId, season), getSeasonProgress(childId, season.id)]);
  return assembleSeasonView(season, xp, claimed, Date.now());
}

/** Compact state for the home banner. */
export interface SeasonBannerState { nameZh: string; nameEn: string; themeEmoji: string; currentTier: number; totalTiers: number; xpToNext: number | null; claimableCount: number; }
export async function getSeasonBannerState(childId: string): Promise<SeasonBannerState | null> {
  const view = await getSeasonView(childId);
  if (!view) return null;
  const claimableCount = view.tiers.filter((t) => t.state === 'claimable').length;
  return { nameZh: view.nameZh, nameEn: view.nameEn, themeEmoji: view.themeEmoji, currentTier: view.currentTier, totalTiers: view.tiers.length, xpToNext: view.xpToNext, claimableCount };
}
```
(`syncSeasonProgress` / `getSeasonView` call `Date.now()` in a server module — that's allowed; the purity lint only flags render bodies.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test season-view`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/season/view.ts src/lib/db/season.ts tests/unit/season-view.test.ts
git commit -m "feat(season): assembleSeasonView + syncSeasonProgress + banner state"
```

---

## Task 7: Server actions — claim one / claim all

**Files:**
- Create: `src/lib/actions/season.ts`
- Test: `tests/unit/season-actions.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/season-actions.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn().mockResolvedValue({ child: { id: 'c1' } }),
  getActiveSeason: vi.fn(),
  getSeasonXp: vi.fn().mockResolvedValue(1000),
  getSeasonProgress: vi.fn().mockResolvedValue([]),
  claimSeasonTierInTx: vi.fn().mockResolvedValue({ claimed: true, reveal: null }),
}));
vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/season', () => ({
  getActiveSeason: mocks.getActiveSeason, getSeasonXp: mocks.getSeasonXp,
  getSeasonProgress: mocks.getSeasonProgress, claimSeasonTierInTx: mocks.claimSeasonTierInTx,
}));
vi.mock('@/db', () => ({ db: { transaction: (cb: (t: unknown) => unknown) => cb({}) } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { claimSeasonTierAction } from '@/lib/actions/season';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

const season = { id: 's1', startsAt: new Date('2026-06-15'), endsAt: new Date('2026-08-10'), tierConfig: SUMMER_VOYAGE_TIERS };
beforeEach(() => { vi.clearAllMocks(); mocks.getActiveSeason.mockResolvedValue(season); mocks.getSeasonXp.mockResolvedValue(1000); mocks.getSeasonProgress.mockResolvedValue([]); });

describe('claimSeasonTierAction', () => {
  it('claims a reached tier and returns the reveal list', async () => {
    const res = await claimSeasonTierAction('c1', 10); // tier 10 needs 950 ≤ 1000
    expect(mocks.claimSeasonTierInTx).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });
  it('rejects an unreached tier', async () => {
    mocks.getSeasonXp.mockResolvedValue(100);
    await expect(claimSeasonTierAction('c1', 30)).rejects.toThrow();
    expect(mocks.claimSeasonTierInTx).not.toHaveBeenCalled();
  });
  it('throws when there is no active season', async () => {
    mocks.getActiveSeason.mockResolvedValue(null);
    await expect(claimSeasonTierAction('c1', 1)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test season-actions`
Expected: FAIL.

- [ ] **Step 3: Implement the actions**

`src/lib/actions/season.ts`:
```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { requireChild } from '@/lib/auth/guards';
import { getActiveSeason, getSeasonXp, getSeasonProgress, claimSeasonTierInTx } from '@/lib/db/season';
import { claimableTiers, tierForSeasonXp } from '@/lib/season/levels';
import { NoActiveSeasonError, TierNotReachedError } from '@/lib/errors/season-errors';
import type { RevealCard } from '@/lib/play/reveal-card';

const TierSchema = z.number().int().min(1).max(60);

export async function claimSeasonTierAction(childId: string, tierNum: number): Promise<{ ok: true; reveals: RevealCard[] }> {
  const { child } = await requireChild(childId);
  TierSchema.parse(tierNum);
  const season = await getActiveSeason();
  if (!season) throw new NoActiveSeasonError();
  const xp = await getSeasonXp(child.id, season);
  if (tierForSeasonXp(xp, season.tierConfig) < tierNum) throw new TierNotReachedError(tierNum);
  const tier = season.tierConfig.find((t) => t.tier === tierNum);
  if (!tier) throw new TierNotReachedError(tierNum);

  const result = await db.transaction((tx) => claimSeasonTierInTx(tx, child.id, season.id, tier));
  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/season`);
  return { ok: true, reveals: result.reveal ? [result.reveal] : [] };
}

export async function claimAllSeasonTiersAction(childId: string): Promise<{ ok: true; reveals: RevealCard[] }> {
  const { child } = await requireChild(childId);
  const season = await getActiveSeason();
  if (!season) throw new NoActiveSeasonError();
  const xp = await getSeasonXp(child.id, season);
  const claimed = await getSeasonProgress(child.id, season.id);
  const toClaim = claimableTiers(xp, claimed, season.tierConfig);
  const reveals: RevealCard[] = [];
  await db.transaction(async (tx) => {
    for (const tierNum of toClaim) {
      const tier = season.tierConfig.find((t) => t.tier === tierNum)!;
      const r = await claimSeasonTierInTx(tx, child.id, season.id, tier);
      if (r.reveal) reveals.push(r.reveal);
    }
  });
  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/season`);
  return { ok: true, reveals };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test season-actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/season.ts tests/unit/season-actions.test.ts
git commit -m "feat(season): claim actions (claimSeasonTierAction / claimAllSeasonTiersAction)"
```

---

## Task 8: Season cards data + `SeasonCard` + pack registry

**Files:**
- Create: `src/lib/collections/seasonCardsData.ts`, `src/components/play/items/SeasonCard.tsx`
- Modify: `src/lib/collections/packRegistry.ts`
- Test: `tests/unit/season-card.test.tsx`

- [ ] **Step 1: Card data**

`src/lib/collections/seasonCardsData.ts` (mirror `festivalsData.ts`):
```ts
export interface SeasonCardItem { slug: string; nameZh: string; nameEn: string; emoji: string; loreZh: string; loreEn: string; rarity: 'rare' | 'epic'; }

export const SEASON_CARD_ITEMS: SeasonCardItem[] = [
  { slug: 'season-tortoise', nameZh: '海龟船长', nameEn: 'Captain Tortoise', emoji: '🐢', rarity: 'rare', loreZh: '最年长的航海家，背着整片海的故事。', loreEn: 'The oldest navigator, carrying the whole sea on its back.' },
  { slug: 'season-flyingfish', nameZh: '飞鱼信使', nameEn: 'Flying-Fish Courier', emoji: '🐟', rarity: 'rare', loreZh: '在浪尖上飞驰，替船队传递消息。', loreEn: 'Skimming the wave-tops, carrying messages for the fleet.' },
  { slug: 'season-dolphin', nameZh: '海豚伙伴', nameEn: 'Dolphin Friend', emoji: '🐬', rarity: 'epic', loreZh: '夏天最快乐的朋友，总在船头跳跃。', loreEn: "Summer's happiest friend, always leaping at the bow." },
  { slug: 'season-kraken', nameZh: '黄金海怪', nameEn: 'Golden Kraken', emoji: '🐙', rarity: 'epic', loreZh: '传说中守护夏季宝藏的金色海怪。', loreEn: 'The golden kraken said to guard the summer treasure.' },
];

export const SEASON_CARDS_BY_SLUG: Record<string, SeasonCardItem> = Object.fromEntries(SEASON_CARD_ITEMS.map((c) => [c.slug, c]));
```

- [ ] **Step 2: Card component (test-first)**

`tests/unit/season-card.test.tsx`:
```ts
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeasonCard } from '@/components/play/items/SeasonCard';

const item = { id: 'i1', slug: 'season-tortoise', nameZh: '海龟船长', nameEn: 'Captain Tortoise', loreZh: 'x', loreEn: 'y', imageUrl: null } as never;

describe('SeasonCard', () => {
  it('renders bilingual name; locked when unowned', () => {
    render(<SeasonCard item={item} owned={false} />);
    expect(screen.getByText('海龟船长')).toBeInTheDocument();
    expect(screen.getByText('Captain Tortoise')).toBeInTheDocument();
  });
  it('shows lore at lg when owned', () => {
    render(<SeasonCard item={item} owned size="lg" />);
    expect(screen.getByText('x')).toBeInTheDocument();
  });
});
```

`src/components/play/items/SeasonCard.tsx` — copy `FestivalCard.tsx`, swap `FESTIVALS_BY_SLUG` → `SEASON_CARDS_BY_SLUG`, default emoji `'🎴'`, `data-testid="season-card"`, and an ocean/teal owned-border palette (`border-teal-400 bg-gradient-to-b from-cyan-50 to-teal-100`). Same `CardArt` usage, same bilingual blocks, same `🔒` when unowned.

- [ ] **Step 3: Register the pack**

In `src/lib/collections/packRegistry.ts`, import `SEASON_CARDS_BY_SLUG` + `SeasonCard`, and add to `PACK_REGISTRY`:
```ts
  'season-summer-v1': {
    displayNameZh: '夏季航海', displayNameEn: 'Summer Voyage',
    sloganZh: '赛季限定，随航海图一起收集。', sloganEn: 'Season-exclusive — earned along the voyage.',
    themeEmoji: '⛵',
    themeBannerClass: 'bg-gradient-to-br from-cyan-200 via-teal-300 to-sky-500',
    themeAccentClass: 'text-teal-900',
    paidPullCost: 0, // reward-only — never sold / pulled via gacha
    gridColumns: 3,
    ItemCard: SeasonCard,
    resolveRevealEmoji: (slug) => SEASON_CARDS_BY_SLUG[slug]?.emoji ?? null,
  },
```

- [ ] **Step 4: Run tests**

Run: `pnpm test season-card`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/seasonCardsData.ts src/components/play/items/SeasonCard.tsx src/lib/collections/packRegistry.ts tests/unit/season-card.test.tsx
git commit -m "feat(season): season-summer-v1 card pack (data + SeasonCard + registry)"
```

---

## Task 9: Season avatar cosmetics + theme + wardrobe

**Files:**
- Modify: `src/lib/avatar/themes.ts`, `src/lib/avatar/itemCatalog.tsx`, `src/lib/db/shop.ts`
- Test: `tests/unit/season-cosmetics.test.ts`

- [ ] **Step 1: Add the theme**

In `src/lib/avatar/themes.ts`: add `'season'` to `AVATAR_THEMES`; add `season: { zh: '夏季航海', en: 'Summer Voyage' }` to `THEME_DISPLAY_NAMES`; add `'season'` to `REWARD_THEMES` (so it's excluded from `SHOP_FILTER_THEMES`).

- [ ] **Step 2: Add 8 cosmetics to the catalog**

In `src/lib/avatar/itemCatalog.tsx`, define 8 `ItemDef` constants (mirror the festival items: `rewardOnly: true`, `theme: 'season'`, NO `priceCoins`, a flat-color `renderSvg` with NO `<defs>`/gradients, `key` = unlockRef), then add all 8 to the `ALL_ITEMS` array. Exact contracts (author a simple flat-SVG per item, in the festival style):

| unlockRef | slot | displayName | rarity | narrativeHint |
|---|---|---|---|---|
| `season-sailor-hat` | hat | 水手帽 | rare | `a white sailor hat with a blue ribbon` |
| `season-anchor-decor` | decor | 船锚挂饰 | rare | `with a small iron anchor charm` |
| `season-parrot-decor` | decor | 鹦鹉肩饰 | rare | `with a colorful parrot on the shoulder` |
| `season-spyglass-decor` | decor | 望远镜 | rare | `holding a brass spyglass` |
| `season-wheel-decor` | decor | 船舵挂饰 | rare | `with a small ship's wheel emblem` |
| `season-sunset-bg` | background | 夕阳海湾 | rare | `against a warm sunset bay` |
| `season-captain-coat` | top | 船长大衣 | epic | `a navy captain's coat with gold buttons` |
| `season-captain-hat` | hat | 船长帽 | epic | `a navy captain's bicorne hat` |

Because they are `rewardOnly: true`, `rewardItems()` (which filters `rewardOnly === true`) auto-includes them — so `scripts/seed-festival-avatar-items.ts` (which iterates `rewardItems()`) will seed them with no script change.

- [ ] **Step 3: Surface in the rewards wardrobe**

In `src/lib/db/shop.ts`, add `'season'` to the `REWARD_WARDROBE_THEMES` array (currently `['festival', 'continent']` → `['festival', 'continent', 'season']`). This makes claimed season cosmetics re-equippable in the 奖励衣橱.

- [ ] **Step 4: Write the test**

`tests/unit/season-cosmetics.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { rewardItems } from '@/lib/avatar/itemCatalog';
import { SHOP_FILTER_THEMES, AVATAR_THEMES } from '@/lib/avatar/themes';
import { SUMMER_VOYAGE_TIERS } from '@/lib/season/summerVoyage';

describe('season cosmetics', () => {
  it("'season' is a theme but not a shop filter chip", () => {
    expect(AVATAR_THEMES).toContain('season');
    expect(SHOP_FILTER_THEMES).not.toContain('season');
  });

  it('rewardItems() includes all 8 season cosmetics, all rewardOnly', () => {
    const season = rewardItems().filter((i) => i.theme === 'season');
    expect(season).toHaveLength(8);
    season.forEach((i) => { expect(i.rewardOnly).toBe(true); expect(i.priceCoins).toBeUndefined(); });
  });

  it('every cosmetic unlockRef referenced by a tier exists in the catalog', () => {
    const refs = new Set(rewardItems().map((i) => i.unlockRef));
    for (const t of SUMMER_VOYAGE_TIERS) {
      if (t.reward.type === 'cosmetic') expect(refs.has(t.reward.unlockRef)).toBe(true);
      if (t.reward.type === 'cosmetic_set') t.reward.unlockRefs.forEach((r) => expect(refs.has(r)).toBe(true));
    }
  });
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm test season-cosmetics`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/avatar/themes.ts src/lib/avatar/itemCatalog.tsx src/lib/db/shop.ts tests/unit/season-cosmetics.test.ts
git commit -m "feat(season): 8 reward-only season cosmetics + 'season' theme + wardrobe"
```

---

## Task 10: Home banner

**Files:**
- Create: `src/components/play/SeasonBanner.tsx`
- Modify: `src/app/play/[childId]/page.tsx`
- Test: `tests/unit/season-banner.test.tsx`

- [ ] **Step 1: Write the test**

`tests/unit/season-banner.test.tsx`:
```ts
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeasonBanner } from '@/components/play/SeasonBanner';

describe('SeasonBanner', () => {
  it('renders nothing when state is null', () => {
    const { container } = render(<SeasonBanner childId="c1" state={null} />);
    expect(container.firstChild).toBeNull();
  });
  it('shows tier, bilingual name, and a claimable chip when claimableCount > 0', () => {
    render(<SeasonBanner childId="c1" state={{ nameZh: '夏季航海', nameEn: 'Summer Voyage', themeEmoji: '⛵', currentTier: 12, totalTiers: 30, xpToNext: 320, claimableCount: 2 }} />);
    expect(screen.getByText(/夏季航海/)).toBeInTheDocument();
    expect(screen.getByText(/Summer Voyage/)).toBeInTheDocument();
    expect(screen.getByText(/12\s*\/\s*30/)).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument(); // claimable chip
  });
});
```

- [ ] **Step 2: Implement the banner**

`src/components/play/SeasonBanner.tsx` (server-safe; a plain `Link`, no hooks):
```tsx
import Link from 'next/link';
import type { SeasonBannerState } from '@/lib/db/season';

export function SeasonBanner({ childId, state }: { childId: string; state: SeasonBannerState | null }) {
  if (!state) return null;
  return (
    <Link
      href={`/play/${childId}/season`}
      className="flex items-center justify-between gap-2 rounded-2xl border-2 border-teal-300 bg-gradient-to-r from-cyan-100 to-teal-100 px-4 py-2.5 shadow-sm"
    >
      <span className="flex items-center gap-2 font-hanzi text-sm font-bold text-teal-900">
        <span className="text-xl" aria-hidden="true">{state.themeEmoji}</span>
        <span>{state.nameZh} / {state.nameEn}</span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">Tier {state.currentTier}/{state.totalTiers}</span>
      </span>
      {state.claimableCount > 0 ? (
        <span className="animate-bonus-pop rounded-full bg-amber-400 px-2.5 py-1 text-xs font-extrabold text-amber-900">
          🎁 {state.claimableCount} 可领 / Claim
        </span>
      ) : state.xpToNext !== null ? (
        <span className="text-xs font-semibold text-teal-700">还需 {state.xpToNext} XP / to next</span>
      ) : (
        <span className="text-xs font-semibold text-teal-700">已满级 / Maxed</span>
      )}
    </Link>
  );
}
```

- [ ] **Step 3: Mount on the home page**

In `src/app/play/[childId]/page.tsx`:
- Add imports: `import { SeasonBanner } from '@/components/play/SeasonBanner';` and `import { getSeasonBannerState, syncSeasonProgress } from '@/lib/db/season';`.
- Before the `Promise.all`, after `requireChild`, add `await syncSeasonProgress(child.id);` (banks any leftover tiers once the season has ended; no-op during the season).
- Add `getSeasonBannerState(child.id)` to the `Promise.all` array (destructure as `seasonBanner`).
- Render `<SeasonBanner childId={childId} state={seasonBanner} />` inside the HUD column `<div className="flex flex-col gap-5">`, immediately AFTER the `DailyQuestsPanel` block (still inside that div, before its closing `</div>`).

- [ ] **Step 4: Run tests**

Run: `pnpm test season-banner`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/play/SeasonBanner.tsx src/app/play/[childId]/page.tsx tests/unit/season-banner.test.tsx
git commit -m "feat(season): home banner below Daily Quests + end-of-season auto-bank on render"
```

---

## Task 11: Season route + track UI

**Files:**
- Create: `src/app/play/[childId]/season/page.tsx`, `src/components/play/SeasonTrack.tsx`
- Test: `tests/unit/season-track.test.tsx`

- [ ] **Step 1: Write the track test**

`tests/unit/season-track.test.tsx`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/season', () => ({
  claimSeasonTierAction: vi.fn().mockResolvedValue({ ok: true, reveals: [] }),
  claimAllSeasonTiersAction: vi.fn().mockResolvedValue({ ok: true, reveals: [] }),
}));

import { SeasonTrack } from '@/components/play/SeasonTrack';
import { claimSeasonTierAction } from '@/lib/actions/season';

const view = {
  id: 's1', nameZh: '夏季航海', nameEn: 'Summer Voyage', themeEmoji: '⛵',
  seasonXp: 980, currentTier: 9, xpToNext: 120, daysRemaining: 30, ended: false,
  tiers: [
    { tier: 9, xpRequired: 800, reward: { type: 'coins', amount: 100 }, state: 'claimable' },
    { tier: 10, xpRequired: 950, reward: { type: 'card', cardSlug: 'season-tortoise' }, state: 'claimable' },
    { tier: 11, xpRequired: 1100, reward: { type: 'coins', amount: 150 }, state: 'locked' },
  ],
} as never;

describe('SeasonTrack', () => {
  it('renders tiers + bilingual header + claim buttons on claimable tiers', () => {
    render(<SeasonTrack childId="c1" view={view} />);
    expect(screen.getByText(/夏季航海/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /领取|claim/i }).length).toBeGreaterThan(0);
  });
  it('claims a tier on tap', async () => {
    render(<SeasonTrack childId="c1" view={view} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^领取|claim$/i })[0]);
    await waitFor(() => expect(claimSeasonTierAction).toHaveBeenCalledWith('c1', 9));
  });
});
```

- [ ] **Step 2: Implement the client track**

`src/components/play/SeasonTrack.tsx` (`'use client'`): renders the season header (emoji + `nameZh / nameEn`, XP bar `seasonXp / next xpRequired`, `距赛季结束 {daysRemaining} 天 / days left`), a `一键领取 / Claim all` button (visible when any tier is `claimable`), and a vertical list of tier rows. Each row shows tier number, a reward label (see helper below), and a state affordance: `locked` → 🔒 grey; `claimable` → a 领取 / Claim `<button>`; `claimed` → ✅ 已领 / Claimed. On claim, call `claimSeasonTierAction(childId, tier)`; on claim-all, `claimAllSeasonTiersAction(childId)`. Collect returned `reveals` into a `RevealCard[]` queue and render `<CardChestReveal cards={queue} onDone={...} />` (import from `@/components/scenes/fx/CardChestReveal`) when non-empty; on done, `router.refresh()`. Use `useTransition` for pending state. Bilingual chrome throughout.

Reward-label helper (inline, pure):
```ts
function rewardLabel(reward: SeasonViewTier['reward']): { zh: string; en: string; icon: string } {
  switch (reward.type) {
    case 'coins': return { zh: `${reward.amount} 金币`, en: `${reward.amount} coins`, icon: '🪙' };
    case 'powerup': return reward.kind === 'skip'
      ? { zh: `跳过 ×${reward.count}`, en: `Skip ×${reward.count}`, icon: '⏭️' }
      : { zh: `护级 ×${reward.count}`, en: `Streak Freeze ×${reward.count}`, icon: '🧊' };
    case 'shards': return { zh: `碎片 ×${reward.amount}`, en: `Shards ×${reward.amount}`, icon: '🔹' };
    case 'card': return { zh: '赛季限定卡', en: 'Season card', icon: '🎴' };
    case 'cosmetic': return { zh: '赛季装扮', en: 'Season cosmetic', icon: '🎀' };
    case 'cosmetic_set': return { zh: '船长套装 + 徽章', en: 'Captain set + badge', icon: '🏆' };
  }
}
```
Import `SeasonViewTier` from `@/lib/season/view`. Respect `useReducedMotion()` for any glow/pulse on claimable rows (fall back to a static ring).

- [ ] **Step 3: Implement the route page**

`src/app/play/[childId]/season/page.tsx` (server component):
```tsx
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getSeasonView } from '@/lib/db/season';
import { SeasonTrack } from '@/components/play/SeasonTrack';

export default async function SeasonPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { child } = await requireChild(childId);
  const view = await getSeasonView(child.id);
  if (!view) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="font-hanzi text-lg font-bold text-teal-900">暂无进行中的赛季 / No active season</p>
        <p className="mt-2 text-sm text-teal-700">敬请期待下一季 / Stay tuned for the next season.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 lg:max-w-2xl">
      <SeasonTrack childId={childId} view={view} />
    </main>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test season-track`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/play/[childId]/season/page.tsx src/components/play/SeasonTrack.tsx tests/unit/season-track.test.tsx
git commit -m "feat(season): /season route + 30-tier track UI with claim + reveal"
```

---

## Task 12: Seeds + trophy + CF art recipe

**Files:**
- Create: `scripts/seed-season-summer.ts`, `scripts/seed-season-cards.ts`
- Modify: `scripts/seed-trophies.ts`, `scripts/generate-collectible-art-cloudflare.ts`
- Test: `tests/unit/season-seed-trophy.test.ts` (light — assert the trophy row is present in the TROPHIES array)

- [ ] **Step 1: Season-cards seed**

`scripts/seed-season-cards.ts` — copy `scripts/seed-festivals-pack.ts`; change slug → `'season-summer-v1'`, name → `'夏季航海'`, description → `'Season-exclusive cards — earned along the Summer Voyage track.'`, `themeColor: '#14b8a6'`, `isActive: true`, `gachaEligible: false`; iterate `SEASON_CARD_ITEMS` (from `../src/lib/collections/seasonCardsData`) for the `collectibleItems` insert, mapping `rarity` from each item (`f.rarity`). `image_url` left NULL (CardArt renders emoji until flux art lands).

- [ ] **Step 2: Season-summer seed (the season row)**

`scripts/seed-season-summer.ts` — `loadEnv()` + dynamic `@/db` import pattern (see `seed-festivals-pack.ts`). Upsert the `seasons` row by PK `id = SUMMER_VOYAGE_SLUG`:
```ts
// inside main(), after importing { db }, { seasons }, { eq }, and the config:
const { SUMMER_VOYAGE_SLUG, SUMMER_VOYAGE_META, SUMMER_VOYAGE_TIERS } = await import('../src/lib/season/summerVoyage');
const startsAt = new Date(); // live now
const endsAt = new Date(startsAt.getTime() + 56 * 86_400_000); // +8 weeks
await db.insert(seasons).values({
  id: SUMMER_VOYAGE_META.id, nameZh: SUMMER_VOYAGE_META.nameZh, nameEn: SUMMER_VOYAGE_META.nameEn,
  themeEmoji: SUMMER_VOYAGE_META.themeEmoji, startsAt, endsAt, tierConfig: SUMMER_VOYAGE_TIERS, isActive: true,
}).onConflictDoNothing();
console.log('seeded season:', SUMMER_VOYAGE_META.id);
```
(Idempotent: re-running keeps the original `starts_at`/`ends_at`. To re-window later, update the row by hand or add a `--reset` flag — out of scope.)

- [ ] **Step 3: Add the trophy**

In `scripts/seed-trophies.ts`: widen the `Category` type to include `'season'`; append to `TROPHIES`:
```ts
{ slug: 'season-summer-master', emoji: '⛵', nameZh: '夏季航海大师', nameEn: 'Summer Voyage Master', descriptionZh: '完成夏季航海赛季的全部 30 个档位', descriptionEn: 'Reach tier 30 of the Summer Voyage season', loreZh: '整片夏日海洋都记得你的名字。', loreEn: 'The whole summer sea remembers your name.', category: 'season', displayOrder: 60 },
```

- [ ] **Step 4: CF art recipe**

In `scripts/generate-collectible-art-cloudflare.ts`, add a prompt recipe branch for pack slug `'season-summer-v1'` (mirror the existing per-pack recipes): a nautical cartoon style preamble + per-card subject keyed by slug (tortoise captain in a sailor hat / flying fish leaping over waves / friendly dolphin / golden cartoon kraken), bright kid-friendly, single subject, no text. (No run needed in this task — it's invoked post-merge once a `CF_API_TOKEN` is available.)

- [ ] **Step 5: Trophy presence test**

`tests/unit/season-seed-trophy.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { TROPHIES } from '../../scripts/seed-trophies';

describe('season trophy seed', () => {
  it('includes season-summer-master in category season', () => {
    const t = TROPHIES.find((x) => x.slug === 'season-summer-master');
    expect(t).toBeDefined();
    expect(t?.category).toBe('season');
  });
});
```
(If `TROPHIES` isn't exported, add `export` to the `const TROPHIES` declaration in `scripts/seed-trophies.ts`.)

- [ ] **Step 6: Run tests**

Run: `pnpm test season-seed-trophy`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/seed-season-summer.ts scripts/seed-season-cards.ts scripts/seed-trophies.ts scripts/generate-collectible-art-cloudflare.ts tests/unit/season-seed-trophy.test.ts
git commit -m "feat(season): seeds (season row + cards + trophy) + CF art recipe"
```

---

## Task 13: Four-green gate + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: PASS (all prior suites + the new season suites). Fix any cross-file breakage (e.g. a snapshot of `AVATAR_THEMES` length, or a bilingual-chrome test that enumerates nav labels — the season route is reached via the home banner, NOT a nav tab, so `KidNavBar` is unchanged).

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Common catches: a `react-hooks/purity` flag if `Date.now()` slipped into a component render (it must live only in server modules / `assembleSeasonView` callers); an unused import after wiring.

- [ ] **Step 3: Build (applies migration 0029 to PROD — be aware)**

Run: `pnpm build`
Expected: PASS. ⚠️ Per the CLAUDE.md landmine, `pnpm build` runs `scripts/migrate.ts` against the prod `DATABASE_URL` first — this CREATES the `seasons` + `child_season_progress` tables and adds the enum values in prod early. That's additive and harmless (the tables sit empty until the seeds run + the deploy ships). Confirm the build's migrate step logs success.

- [ ] **Step 4: Manual smoke (pnpm dev)**

```
pnpm tsx scripts/seed-season-cards.ts        # pack + 4 cards
pnpm tsx scripts/seed-festival-avatar-items.ts  # now also seeds the 8 season cosmetics (rewardItems())
pnpm tsx scripts/seed-trophies.ts            # season-summer-master
pnpm tsx scripts/seed-season-summer.ts       # season row LAST (references cards/cosmetics)
pnpm dev
```
Then as a test child:
1. Home page shows the ⛵ season banner below Daily Quests.
2. Earn enough XP (play a few scenes) → banner shows `🎁 N 可领`.
3. Open `/play/[childId]/season` → 30-tier track; claimable tiers have a 领取 button.
4. Claim a coins tier → coin balance rises; tier flips to ✅.
5. Claim the tier-10 card → `CardChestReveal` plays; the card appears in Backpack → 夏季航海 pack.
6. Claim a cosmetic tier → it lands in the 奖励衣橱 / Rewards Wardrobe (NOT auto-equipped); the grand T30 set DOES auto-equip + grants the trophy.
7. Reduced-motion (DevTools) → no janky glow; claim still works.

- [ ] **Step 5: Final review + PR**

Dispatch the final code-reviewer over the whole branch, then push + open the PR (SSH remote). PR body must list the **post-merge ops** (the four seed commands in Step 4, in that order) + the optional `CF_API_TOKEN=… pnpm tsx scripts/generate-collectible-art-cloudflare.ts` for the 4 season-card images.

```bash
git push -u origin feat/season-pass
gh pr create --title "feat: Season Pass — Summer Voyage 30-tier reward track" --body "..."
```

---

## Post-merge ops (for the PR body)

Run against prod **in this order** (migration 0029 auto-applies on the Vercel build):
1. `pnpm tsx scripts/seed-season-cards.ts` — pack `season-summer-v1` + 4 cards.
2. `pnpm tsx scripts/seed-festival-avatar-items.ts` — seeds the 8 season cosmetics (idempotent; now covers `theme:'season'` via `rewardItems()`).
3. `pnpm tsx scripts/seed-trophies.ts` — adds `season-summer-master`.
4. `pnpm tsx scripts/seed-season-summer.ts` — the season row **last** (claims reference the above).
5. *(optional art)* `CF_ACCOUNT_ID=… CF_API_TOKEN=… pnpm tsx scripts/generate-collectible-art-cloudflare.ts` — flux art for the 4 season cards.

---

## Self-review notes (gaps checked against the spec)

- **§2 engine** → Tasks 1, 4, 6 (tables, derived XP, sync). ✓
- **§2.3 claim model** (per-tap during season, auto-bank at end) → Task 5 (`claimSeasonTierInTx`), Task 6 (`syncSeasonProgress` end-only sweep), Task 7 (actions), Task 11 (UI). ✓
- **§3 tier table** → Task 3 (encoded) + Task 3 test (counts/monotonic). ✓
- **§4 dispatch** → Task 5 (all 6 reward types + trophy). ✓
- **§5 cards** → Task 8 (data/component/registry) + Task 12 (seed + flux recipe). ✓
- **§6 cosmetics** → Task 9 (8 items, `season` theme, wardrobe). ✓
- **§7 UI** → Task 10 (banner) + Task 11 (track). ✓
- **§8 integration** (no earn-loop changes) → confirmed: only home/season render + actions call season code; no existing action modified. ✓
- **§9 seeds** → Task 12 + post-merge ops. ✓
- **Type consistency:** `unlockRef` strings in Task 3 tier config === Task 9 catalog table; `cardSlug` strings in Task 3 === Task 8 `SEASON_CARD_ITEMS` slugs; `trophySlug` Task 3 === Task 12 trophy slug; `SEASON_PACK_SLUG`/`season-summer-v1` consistent across Tasks 5/8/12. ✓
