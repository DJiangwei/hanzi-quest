# PR #52 — Gacha Economy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace coin-purchased shop gacha with play-to-earn cards (Boss/repeats + perfect_week + story chapter, 10/wk cap) and per-pack shard swap mechanic where dupes auto-grant 1 shard and 3 shards trade for any chosen unowned card of that pack.

**Architecture:** Two new DB tables (`child_card_grants_weekly` for cap, `card_grants_log` for idempotency) + two new actions (`pullCardForChild`, `swapShardsForItem`). Three callsites wire in (boss-clear in `finishLevelAction`, `awardPerfectWeekIfDue` in coins, `markChapterReadAction` in story). Reuse existing `child_collections.count` + `shard_balances.shards`. Revert PR #51's `freePullClaimed` chest gating. Remove shop's coin-gacha button.

**Tech Stack:** Next.js 16, React 19, Drizzle (append-only migration 0018), Vitest + RTL + jsdom.

---

## Pre-flight (read once before starting)

**Branch:** `feat/pr52-gacha-redesign` (already created off `main`).

**PR #48 dependency:** This PR wires a `story_chapter` card source via `markChapterReadAction`, which lives in PR #48 (Story Mode, currently OPEN). Two cases:

- If PR #48 has merged to `main` by execution time: rebase this branch onto `main`, proceed.
- If PR #48 is still open: rebase this branch onto `feat/pr48-story-mode` so the story types and action are present. When PR #48 merges, this PR rebases cleanly onto main.

Recommended pre-flight:

```bash
git fetch origin main feat/pr48-story-mode
gh pr view 48 --json state,mergedAt
# If state = MERGED, rebase onto main; else rebase onto feat/pr48-story-mode
git rebase origin/feat/pr48-story-mode  # OR origin/main
```

If PR #48 abandoned entirely, drop Task 9 (story wiring) — the PR is still useful with just boss + perfect_week sources.

---

## File structure

### New files
| Path | Responsibility |
|---|---|
| `src/db/schema/gacha.ts` | New tables `child_card_grants_weekly` + `card_grants_log`. |
| `drizzle/0018_pr52_gacha.sql` | Migration (Drizzle-generated). |
| `src/lib/actions/gacha.ts` *(extend)* | New `pullCardForChild` + `swapShardsForItem` server actions. |
| `src/lib/errors/gacha-errors.ts` *(extend or create)* | New `InsufficientShardsError`, `WeeklyCapReachedError`. Pure client-safe error classes. |
| `src/lib/db/grants.ts` | DB layer for the gacha redesign: `getOrCreateWeeklyGrantRow`, `weightedRandomPick`, `recordGrantInTx`. Keep `pullCardForChild` action thin. |
| `src/lib/utils/iso-week.ts` | Pure `mondayOfIsoWeek(iso: string): string` helper, moved out of `src/app/play/[childId]/page.tsx`. |
| `src/components/play/SwapDialog.tsx` | Bottom-sheet "trade 3 shards" UI. Client component. |
| `src/components/play/ShardPill.tsx` | Small pill `🔹 5` for the pack-page header. |
| `tests/unit/iso-week.test.ts` | mondayOfIsoWeek covers Sun/Mon edge cases. |
| `tests/unit/pull-card-for-child.test.ts` | New action tests. |
| `tests/unit/swap-shards-for-item.test.ts` | New action tests. |
| `tests/unit/grants-db.test.ts` | DB layer unit tests with mocked Drizzle tx. |
| `tests/unit/components/play/SwapDialog.test.tsx` | Component tests. |
| `tests/unit/components/play/ShardPill.test.tsx` | Component tests. |

### Modified files
| Path | Change |
|---|---|
| `src/db/schema/index.ts` | Re-export new tables. |
| `src/lib/actions/play.ts` | `finishLevelAction` boss-clear branch calls `pullCardForChild`. Return shape adds `cardGrant`. |
| `src/lib/db/coins.ts` | `awardPerfectWeekIfDue` extended to also call `pullCardForChild` on first-award. Return adds `cardGrant`. |
| `src/lib/actions/story.ts` | `markChapterReadAction` extended to call `pullCardForChild` when first-read. (PR #48 file.) |
| `src/components/scenes/SceneRunner.tsx` | Remove the `freePullClaimed` state + gating from PR #51. `chestAvailable = lastSceneType === 'boss'` (unconditional). Capture `cardGrant` from `levelResult` and forward to `LevelFanfare`. |
| `src/components/scenes/fx/LevelFanfare.tsx` | New `cardGrant?` prop renders a card-reveal block when a card was granted; "card limit reached" copy when boss cleared but no grant. |
| `src/components/play/PackPageBody.tsx` | Remove the "Buy a pull" CTA, add shard pill at top, add `×N` count badge on owned items, add swap CTA on unowned items. |
| `src/app/play/[childId]/page.tsx` | Switch from inline `mondayOfIsoWeek` to `import { mondayOfIsoWeek } from '@/lib/utils/iso-week'`. |
| `src/components/play/GachaPullButton.tsx` | Mark deprecated. Remove from imports (pack-page no longer renders it). Keep file with comment `// deprecated PR #52`. |
| `src/lib/actions/gacha.ts` | `pullPaid` marked deprecated (kept for one release). |
| `tests/unit/scene-runner-pr51-chest.test.tsx` | DELETE (PR #51 behavior reverted). |
| `tests/unit/finish-level-boss.test.ts` | Assert `pullCardForChild` called; new return includes `cardGrant`. |
| `tests/unit/perfect-week.test.ts` (or wherever `awardPerfectWeekIfDue` is tested) | Assert card grant on first-award. |
| `tests/unit/story-actions.test.ts` (from PR #48) | Assert `pullCardForChild` called on first-read. |
| `tests/unit/pack-page-body.test.tsx` | Assert "Buy a pull" REMOVED; shard pill present; swap CTA on unowned with ≥3 shards. |
| `tests/unit/level-fanfare.test.tsx` | Assert card-reveal renders with `cardGrant` prop; cap-reached copy when `cardGrant` is null but boss cleared. |
| `CLAUDE.md` | Append PR #52 entry + 4 landmines. |

### Untouched (locked)
- `src/db/schema/collections.ts` — no schema change to `childCollections` / `shardBalances` / `collectibleItems`. PR #52 only ADDS tables.
- `packRegistry.ts` — pack metadata unchanged. `paidPullCost` becomes unused but stays in the type for backwards compat.
- Coin economy elsewhere (avatar/pet/decor/sounds/powerup purchases) — untouched.

---

## Task 1: Pre-flight — confirm branch + rebase target

- [ ] **Step 1.1: Confirm PR #48 status + rebase**

```bash
gh pr view 48 --json state,mergedAt
```

If `mergedAt` is set: rebase onto main.
```bash
git fetch origin main
git rebase origin/main
```

If still OPEN: rebase onto feat/pr48-story-mode so story files are present.
```bash
git fetch origin feat/pr48-story-mode
git rebase origin/feat/pr48-story-mode
```

If conflicts on `docs/superpowers/specs/` or `CLAUDE.md`: resolve by keeping both PR's content (the spec/landmines are additive).

- [ ] **Step 1.2: Verify story types are present after rebase**

```bash
ls src/lib/actions/story.ts src/db/schema/story.ts
grep -n "markChapterReadAction" src/lib/actions/story.ts
```

Expected: both files exist; `markChapterReadAction` defined. If absent, the rebase failed — abort and ask the controller for help.

- [ ] **Step 1.3: Run baseline four-green to confirm clean starting state**

```bash
rm -rf .next
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all green. Record the test count (will be the baseline for PR #52 delta).

No commit for Task 1 — pure setup.

---

## Task 2: Extract `mondayOfIsoWeek` to a shared util

**Files:**
- Create: `src/lib/utils/iso-week.ts`
- Modify: `src/app/play/[childId]/page.tsx`
- Test: `tests/unit/iso-week.test.ts`

- [ ] **Step 2.1: Write failing tests**

Create `tests/unit/iso-week.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mondayOfIsoWeek } from '@/lib/utils/iso-week';

describe('mondayOfIsoWeek', () => {
  it('returns the same date when called with a Monday', () => {
    expect(mondayOfIsoWeek('2026-05-25')).toBe('2026-05-25'); // 2026-05-25 is a Monday
  });

  it('returns the previous Monday for any other day of the week', () => {
    expect(mondayOfIsoWeek('2026-05-26')).toBe('2026-05-25'); // Tuesday
    expect(mondayOfIsoWeek('2026-05-30')).toBe('2026-05-25'); // Saturday
    expect(mondayOfIsoWeek('2026-05-31')).toBe('2026-05-25'); // Sunday (must roll back to Mon, NOT forward)
  });

  it('handles year and month boundaries', () => {
    expect(mondayOfIsoWeek('2026-01-01')).toBe('2025-12-29'); // 2026-01-01 = Thursday
  });
});
```

- [ ] **Step 2.2: Run + confirm failure**

```bash
pnpm vitest run tests/unit/iso-week.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement the util**

Create `src/lib/utils/iso-week.ts`:

```ts
/**
 * Returns the ISO date string (YYYY-MM-DD) of the Monday that starts the
 * UTC ISO week containing `iso`. Sunday rolls BACK to Monday (not forward).
 *
 * Used by:
 *  - `WeekStrip` activity range (existing).
 *  - PR #52 `child_card_grants_weekly` weekly cap counter.
 */
export function mondayOfIsoWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 2.4: Run tests — confirm pass**

```bash
pnpm vitest run tests/unit/iso-week.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 2.5: Switch home page to use the shared helper**

In `src/app/play/[childId]/page.tsx`, find the inline `mondayOfIsoWeek` function (around line 25) and DELETE it. Add the import at the top:

```ts
import { mondayOfIsoWeek } from '@/lib/utils/iso-week';
```

Leave the call site `const monday = mondayOfIsoWeek(todayIso);` unchanged — it now resolves to the imported helper.

- [ ] **Step 2.6: Run typecheck + tests — confirm pass**

```bash
pnpm typecheck && pnpm vitest run
```

Expected: green. No behavior change to the home page.

- [ ] **Step 2.7: Commit**

```bash
git add src/lib/utils/iso-week.ts tests/unit/iso-week.test.ts src/app/play/[childId]/page.tsx
git commit -m "feat(pr52): extract mondayOfIsoWeek to shared util"
```

---

## Task 3: Schema migration — `child_card_grants_weekly` + `card_grants_log`

**Files:**
- Create: `src/db/schema/gacha.ts`
- Modify: `src/db/schema/index.ts`
- Create: `drizzle/0018_pr52_gacha.sql` (generated)

- [ ] **Step 3.1: Write the schema file**

Create `src/db/schema/gacha.ts`:

```ts
// Drizzle schema · gacha — PR #52
import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

/**
 * Per-child weekly card-grant counter. Resets every UTC Monday.
 * Used by `pullCardForChild` to enforce the 10/wk cap.
 */
export const childCardGrantsWeekly = pgTable(
  'child_card_grants_weekly',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    weekStartUtc: text('week_start_utc').notNull(), // ISO YYYY-MM-DD of UTC Monday
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.childId, t.weekStartUtc] })],
);

/**
 * Idempotency log for card grants. Every (child, source, refId) can grant
 * at most once. Source values: 'boss_clear' | 'perfect_week' | 'story_chapter'.
 * refId: sessionId for boss_clear; weekId for perfect_week; chapterId for story_chapter.
 */
export const cardGrantsLog = pgTable(
  'card_grants_log',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    refId: text('ref_id').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.source, t.refId] })],
);
```

- [ ] **Step 3.2: Re-export from schema index**

In `src/db/schema/index.ts`, add:

```ts
export * from './gacha';
```

(If the file uses explicit named re-exports rather than barrel-star, append `childCardGrantsWeekly` and `cardGrantsLog` to the export list.)

- [ ] **Step 3.3: Generate migration**

```bash
pnpm drizzle-kit generate
```

Expected output: new file at `drizzle/0018_<adjective>_<noun>.sql` with `CREATE TABLE` statements for both new tables. Rename to `drizzle/0018_pr52_gacha.sql` if the generator produces a different name (drizzle allows renames before commit).

Inspect the SQL — it should create the two tables with composite PKs and FKs to `child_profiles`. No `DROP` statements.

- [ ] **Step 3.4: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean. The new tables should resolve through the schema barrel.

- [ ] **Step 3.5: Commit**

```bash
git add src/db/schema/gacha.ts src/db/schema/index.ts drizzle/0018_pr52_gacha.sql
git commit -m "feat(pr52): schema + migration 0018 (card grants weekly + log)"
```

---

## Task 4: Error classes for gacha

**Files:**
- Create or extend: `src/lib/errors/gacha-errors.ts`

- [ ] **Step 4.1: Add new error classes**

Create or extend `src/lib/errors/gacha-errors.ts`:

```ts
// Pure error classes — safe to import in client + server code.
// See CLAUDE.md landmine on 'use server' files exporting only async.

export class WeeklyCapReachedError extends Error {
  constructor(public childId: string, public cap: number, public cardsThisWeek: number) {
    super(`Child ${childId} reached the weekly card cap (${cardsThisWeek}/${cap})`);
    this.name = 'WeeklyCapReachedError';
  }
}

export class InsufficientShardsError extends Error {
  constructor(public childId: string, public packId: string, public needed: number, public have: number) {
    super(`Child ${childId} has ${have} shards for pack ${packId}; needs ${needed}`);
    this.name = 'InsufficientShardsError';
  }
}

export class CardGrantAlreadyExistsError extends Error {
  constructor(public childId: string, public source: string, public refId: string) {
    super(`Card grant already recorded for (${childId}, ${source}, ${refId})`);
    this.name = 'CardGrantAlreadyExistsError';
  }
}
```

If the file already exists with other errors (e.g. `AlreadyClaimedError` from PR #51), append the three new classes — don't replace the file.

- [ ] **Step 4.2: Commit**

```bash
git add src/lib/errors/gacha-errors.ts
git commit -m "feat(pr52): gacha error classes (WeeklyCap, InsufficientShards, AlreadyGranted)"
```

---

## Task 5: DB layer — `src/lib/db/grants.ts`

**Files:**
- Create: `src/lib/db/grants.ts`
- Test: `tests/unit/grants-db.test.ts`

Why a separate DB layer? Keeps the `pullCardForChild` action thin and lets us unit-test the weighted random + idempotency logic without spinning up the full action mock harness.

- [ ] **Step 5.1: Write failing tests for `weightedRandomPick`**

Create `tests/unit/grants-db.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { weightedRandomPick, type WeightedItem } from '@/lib/db/grants';

describe('weightedRandomPick', () => {
  const items: WeightedItem[] = [
    { id: 'a', packId: 'p1', dropWeight: 1 },
    { id: 'b', packId: 'p1', dropWeight: 1 },
    { id: 'c', packId: 'p2', dropWeight: 1 },
  ];

  it('picks an item from the catalog', () => {
    const ownedSet = new Set<string>();
    const picked = weightedRandomPick(items, ownedSet, () => 0.1);
    expect(['a', 'b', 'c']).toContain(picked.id);
  });

  it('biases toward packs with more unowned items', () => {
    // p1 has 2 unowned, p2 has 1 unowned → p1 items get weight=3 each (1*(1+2)), p2 gets weight=2 (1*(1+1))
    // Total weight: 3 + 3 + 2 = 8. p1 items take 0..6/8 of the roll space; p2 takes 6..8/8.
    const ownedSet = new Set<string>();
    const pickedAtZero = weightedRandomPick(items, ownedSet, () => 0);
    expect(pickedAtZero.packId).toBe('p1');
    const pickedAtNearEnd = weightedRandomPick(items, ownedSet, () => 0.95);
    expect(pickedAtNearEnd.packId).toBe('p2');
  });

  it('still picks an owned item when all items are owned (degenerate case)', () => {
    const ownedSet = new Set(['a', 'b', 'c']);
    const picked = weightedRandomPick(items, ownedSet, () => 0.5);
    expect(['a', 'b', 'c']).toContain(picked.id);
  });
});
```

- [ ] **Step 5.2: Run + confirm failure**

```bash
pnpm vitest run tests/unit/grants-db.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement the DB layer (pure functions first)**

Create `src/lib/db/grants.ts`:

```ts
// NEVER import this file from client code. It pulls in postgres.
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childCardGrantsWeekly, cardGrantsLog } from '@/db/schema/gacha';
import { childCollections, collectibleItems, collectionPacks, shardBalances } from '@/db/schema/collections';
import type { PgTransaction } from 'drizzle-orm/pg-core';

export const WEEKLY_CARD_CAP = 10;
export const SHARD_SWAP_COST = 3;

export interface WeightedItem {
  id: string;
  packId: string;
  dropWeight: number;
}

export function weightedRandomPick<T extends WeightedItem>(
  items: T[],
  ownedSet: Set<string>,
  rng: () => number = Math.random,
): T {
  if (items.length === 0) {
    throw new Error('weightedRandomPick called with empty catalog');
  }

  // Bias by per-pack unowned count.
  const packUnowned = new Map<string, number>();
  for (const item of items) {
    if (!ownedSet.has(item.id)) {
      packUnowned.set(item.packId, (packUnowned.get(item.packId) ?? 0) + 1);
    }
  }

  const weights = items.map((item) => item.dropWeight * (1 + (packUnowned.get(item.packId) ?? 0)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) {
    // Degenerate: every pack is 100% complete. Fall back to flat random.
    return items[Math.floor(rng() * items.length)];
  }

  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1]; // float-rounding safety net
}

export interface CardGrantResult {
  granted: true;
  itemId: string;
  packId: string;
  packSlug: string;
  isDupe: boolean;
  shardsAfter: number;
  cardsThisWeek: number;
}

export interface CardGrantSkipped {
  granted: false;
  reason: 'weekly_cap_reached' | 'already_granted';
  cardsThisWeek: number;
}

/**
 * Inside a transaction:
 *  1. SELECT/UPSERT child_card_grants_weekly (FOR UPDATE).
 *  2. If count >= cap → return skipped.
 *  3. INSERT card_grants_log; if PK collision → already_granted.
 *  4. Pick weighted random item.
 *  5. Upsert child_collections (count++).
 *  6. If was dupe → shard_balances++.
 *  7. Increment weekly counter.
 */
export async function pullCardInTx(
  tx: PgTransaction<never, typeof import('@/db/schema'), never>,
  childId: string,
  source: 'boss_clear' | 'perfect_week' | 'story_chapter',
  refId: string,
  weekStartUtc: string,
  rng: () => number = Math.random,
): Promise<CardGrantResult | CardGrantSkipped> {
  // 1. weekly counter with row lock
  const weeklyRows = await tx
    .select({ count: childCardGrantsWeekly.count })
    .from(childCardGrantsWeekly)
    .where(
      and(
        eq(childCardGrantsWeekly.childId, childId),
        eq(childCardGrantsWeekly.weekStartUtc, weekStartUtc),
      ),
    )
    .for('update');
  const currentCount = weeklyRows[0]?.count ?? 0;

  if (currentCount >= WEEKLY_CARD_CAP) {
    return { granted: false, reason: 'weekly_cap_reached', cardsThisWeek: currentCount };
  }

  // 2. idempotency log — INSERT with PK collision → already granted.
  try {
    await tx.insert(cardGrantsLog).values({ childId, source, refId });
  } catch (err) {
    // Postgres unique_violation (23505)
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
      return { granted: false, reason: 'already_granted', cardsThisWeek: currentCount };
    }
    throw err;
  }

  // 3. pick weighted random item from all active packs
  const catalog = await tx
    .select({
      id: collectibleItems.id,
      packId: collectibleItems.packId,
      packSlug: collectionPacks.slug,
      dropWeight: collectibleItems.dropWeight,
    })
    .from(collectibleItems)
    .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
    .where(eq(collectionPacks.isActive, true));

  const owned = await tx
    .select({ itemId: childCollections.itemId })
    .from(childCollections)
    .where(eq(childCollections.childId, childId));
  const ownedSet = new Set(owned.map((o) => o.itemId));

  const picked = weightedRandomPick(catalog, ownedSet, rng);
  const isDupe = ownedSet.has(picked.id);

  // 4. upsert child_collections
  if (isDupe) {
    await tx
      .update(childCollections)
      .set({ count: sql`${childCollections.count} + 1` })
      .where(
        and(eq(childCollections.childId, childId), eq(childCollections.itemId, picked.id)),
      );
  } else {
    await tx.insert(childCollections).values({ childId, itemId: picked.id, count: 1 });
  }

  // 5. shard grant on dupe
  let shardsAfter = 0;
  if (isDupe) {
    const existing = await tx
      .select({ shards: shardBalances.shards })
      .from(shardBalances)
      .where(
        and(eq(shardBalances.childId, childId), eq(shardBalances.packId, picked.packId)),
      );
    const prior = existing[0]?.shards ?? 0;
    if (existing.length > 0) {
      await tx
        .update(shardBalances)
        .set({ shards: prior + 1 })
        .where(
          and(eq(shardBalances.childId, childId), eq(shardBalances.packId, picked.packId)),
        );
    } else {
      await tx.insert(shardBalances).values({ childId, packId: picked.packId, shards: 1 });
    }
    shardsAfter = prior + 1;
  }

  // 6. increment weekly counter
  if (weeklyRows.length > 0) {
    await tx
      .update(childCardGrantsWeekly)
      .set({ count: currentCount + 1 })
      .where(
        and(
          eq(childCardGrantsWeekly.childId, childId),
          eq(childCardGrantsWeekly.weekStartUtc, weekStartUtc),
        ),
      );
  } else {
    await tx
      .insert(childCardGrantsWeekly)
      .values({ childId, weekStartUtc, count: 1 });
  }

  return {
    granted: true,
    itemId: picked.id,
    packId: picked.packId,
    packSlug: picked.packSlug,
    isDupe,
    shardsAfter,
    cardsThisWeek: currentCount + 1,
  };
}

/**
 * Trade SHARD_SWAP_COST shards for a chosen unowned item.
 */
export async function swapShardsInTx(
  tx: PgTransaction<never, typeof import('@/db/schema'), never>,
  childId: string,
  itemId: string,
): Promise<
  | { ok: true; shardsRemaining: number }
  | { ok: false; reason: 'insufficient_shards' | 'already_owned' | 'item_not_found' }
> {
  const items = await tx
    .select({ id: collectibleItems.id, packId: collectibleItems.packId })
    .from(collectibleItems)
    .where(eq(collectibleItems.id, itemId));
  if (items.length === 0) return { ok: false, reason: 'item_not_found' };
  const packId = items[0].packId;

  const owned = await tx
    .select({ itemId: childCollections.itemId })
    .from(childCollections)
    .where(
      and(eq(childCollections.childId, childId), eq(childCollections.itemId, itemId)),
    );
  if (owned.length > 0) return { ok: false, reason: 'already_owned' };

  const balRows = await tx
    .select({ shards: shardBalances.shards })
    .from(shardBalances)
    .where(and(eq(shardBalances.childId, childId), eq(shardBalances.packId, packId)))
    .for('update');
  const shards = balRows[0]?.shards ?? 0;
  if (shards < SHARD_SWAP_COST) return { ok: false, reason: 'insufficient_shards' };

  await tx
    .update(shardBalances)
    .set({ shards: shards - SHARD_SWAP_COST })
    .where(and(eq(shardBalances.childId, childId), eq(shardBalances.packId, packId)));
  await tx.insert(childCollections).values({ childId, itemId, count: 1 });

  return { ok: true, shardsRemaining: shards - SHARD_SWAP_COST };
}
```

- [ ] **Step 5.4: Run + confirm pure-function tests pass**

```bash
pnpm vitest run tests/unit/grants-db.test.ts
```

Expected: PASS (3/3) — the `weightedRandomPick` tests exercise the pure helper without touching the tx code.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/db/grants.ts tests/unit/grants-db.test.ts
git commit -m "feat(pr52): grants DB layer — weightedRandomPick + pullCardInTx + swapShardsInTx"
```

---

## Task 6: Server action `pullCardForChild`

**Files:**
- Modify: `src/lib/actions/gacha.ts`
- Test: `tests/unit/pull-card-for-child.test.ts`

- [ ] **Step 6.1: Write failing tests**

Create `tests/unit/pull-card-for-child.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transactionMock = vi.fn();

vi.mock('@/db', () => ({
  db: { transaction: transactionMock },
}));

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async (id: string) => ({ child: { id } })),
}));

vi.mock('@/lib/utils/iso-week', () => ({
  mondayOfIsoWeek: vi.fn(() => '2026-05-25'),
}));

vi.mock('@/lib/db/streaks', () => ({
  todayUtcIso: vi.fn(() => '2026-05-31'),
}));

import { pullCardForChild } from '@/lib/actions/gacha';

beforeEach(() => {
  transactionMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('pullCardForChild', () => {
  it('returns the grant result from pullCardInTx', async () => {
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    );
    const grantsModule = await import('@/lib/db/grants');
    const spy = vi.spyOn(grantsModule, 'pullCardInTx').mockResolvedValue({
      granted: true,
      itemId: 'item-1',
      packId: 'pack-1',
      packSlug: 'flags',
      isDupe: false,
      shardsAfter: 0,
      cardsThisWeek: 1,
    });

    const result = await pullCardForChild('child-1', 'boss_clear', 'sess-1');

    expect(result.granted).toBe(true);
    if (result.granted) expect(result.itemId).toBe('item-1');
    expect(spy).toHaveBeenCalledWith({}, 'child-1', 'boss_clear', 'sess-1', '2026-05-25', Math.random);
  });

  it('returns weekly_cap_reached when DB layer returns it', async () => {
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    );
    const grantsModule = await import('@/lib/db/grants');
    vi.spyOn(grantsModule, 'pullCardInTx').mockResolvedValue({
      granted: false,
      reason: 'weekly_cap_reached',
      cardsThisWeek: 10,
    });
    const result = await pullCardForChild('child-1', 'boss_clear', 'sess-2');
    expect(result.granted).toBe(false);
    if (!result.granted) expect(result.reason).toBe('weekly_cap_reached');
  });
});
```

- [ ] **Step 6.2: Run + confirm failure**

```bash
pnpm vitest run tests/unit/pull-card-for-child.test.ts
```

Expected: FAIL — `pullCardForChild` not exported.

- [ ] **Step 6.3: Implement the action**

Append to `src/lib/actions/gacha.ts` (preserve existing `pullFreeFromBoss` and `pullPaid`):

```ts
import { db } from '@/db';
import { mondayOfIsoWeek } from '@/lib/utils/iso-week';
import { todayUtcIso } from '@/lib/db/streaks';
import { pullCardInTx, type CardGrantResult, type CardGrantSkipped } from '@/lib/db/grants';
import { revalidatePath } from 'next/cache';

export type CardGrantSource = 'boss_clear' | 'perfect_week' | 'story_chapter';

export async function pullCardForChild(
  childId: string,
  source: CardGrantSource,
  refId: string,
): Promise<CardGrantResult | CardGrantSkipped> {
  const weekStartUtc = mondayOfIsoWeek(todayUtcIso());
  const result = await db.transaction((tx) =>
    pullCardInTx(tx, childId, source, refId, weekStartUtc, Math.random),
  );
  if (result.granted) {
    revalidatePath(`/play/${childId}/collection/${result.packSlug}`);
  }
  return result;
}
```

Note: do NOT add `requireChild` inside — the callers (`finishLevelAction`, `awardPerfectWeekIfDue`, `markChapterReadAction`) already auth-gate before invoking. `pullCardForChild` is a trust-the-caller helper.

- [ ] **Step 6.4: Run tests + confirm pass**

```bash
pnpm vitest run tests/unit/pull-card-for-child.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/actions/gacha.ts tests/unit/pull-card-for-child.test.ts
git commit -m "feat(pr52): pullCardForChild server action"
```

---

## Task 7: Server action `swapShardsForItem`

**Files:**
- Modify: `src/lib/actions/gacha.ts`
- Test: `tests/unit/swap-shards-for-item.test.ts`

- [ ] **Step 7.1: Write failing tests**

Create `tests/unit/swap-shards-for-item.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transactionMock = vi.fn();

vi.mock('@/db', () => ({
  db: { transaction: transactionMock },
}));

vi.mock('@/lib/auth/guards', () => ({
  requireChild: vi.fn(async (id: string) => ({ child: { id } })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { swapShardsForItem } from '@/lib/actions/gacha';

beforeEach(() => {
  transactionMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('swapShardsForItem', () => {
  it('returns success when DB layer succeeds', async () => {
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    );
    const grantsModule = await import('@/lib/db/grants');
    vi.spyOn(grantsModule, 'swapShardsInTx').mockResolvedValue({
      ok: true,
      shardsRemaining: 4,
    });

    const result = await swapShardsForItem('child-1', 'item-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.shardsRemaining).toBe(4);
  });

  it('propagates insufficient_shards failure', async () => {
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    );
    const grantsModule = await import('@/lib/db/grants');
    vi.spyOn(grantsModule, 'swapShardsInTx').mockResolvedValue({
      ok: false,
      reason: 'insufficient_shards',
    });
    const result = await swapShardsForItem('child-1', 'item-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('insufficient_shards');
  });
});
```

- [ ] **Step 7.2: Run + confirm failure**

```bash
pnpm vitest run tests/unit/swap-shards-for-item.test.ts
```

Expected: FAIL — `swapShardsForItem` not exported.

- [ ] **Step 7.3: Implement the action**

Append to `src/lib/actions/gacha.ts`:

```ts
import { swapShardsInTx } from '@/lib/db/grants';
import { requireChild } from '@/lib/auth/guards';

export async function swapShardsForItem(
  childId: string,
  itemId: string,
): Promise<
  | { ok: true; shardsRemaining: number }
  | { ok: false; reason: 'insufficient_shards' | 'already_owned' | 'item_not_found' }
> {
  const { child } = await requireChild(childId);
  const result = await db.transaction((tx) => swapShardsInTx(tx, child.id, itemId));
  if (result.ok) {
    revalidatePath(`/play/${child.id}/collection`);
  }
  return result;
}
```

(Note: `swapShardsForItem` IS the user-tappable surface, so it DOES need `requireChild`. The `pullCardForChild` from Task 6 trusts callers.)

- [ ] **Step 7.4: Run tests + confirm pass**

```bash
pnpm vitest run tests/unit/swap-shards-for-item.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/actions/gacha.ts tests/unit/swap-shards-for-item.test.ts
git commit -m "feat(pr52): swapShardsForItem server action"
```

---

## Task 8: Wire boss-clear → `pullCardForChild`

**Files:**
- Modify: `src/lib/actions/play.ts`
- Modify: `tests/unit/finish-level-boss.test.ts`

- [ ] **Step 8.1: Add failing test**

In `tests/unit/finish-level-boss.test.ts`, locate the existing `describe('finishLevelAction return shape (PR #51)')` block (added in PR #51 Task 5). Add a new describe after it:

```ts
describe('finishLevelAction card grant (PR #52)', () => {
  it('calls pullCardForChild on boss clear and returns cardGrant', async () => {
    // Reuse the same mock harness pattern as the PR #51 tests.
    // Mock pullCardForChild to return a successful grant.
    const grantSpy = vi.fn().mockResolvedValue({
      granted: true,
      itemId: 'item-x',
      packId: 'pack-x',
      packSlug: 'flags',
      isDupe: false,
      shardsAfter: 0,
      cardsThisWeek: 1,
    });
    vi.doMock('@/lib/actions/gacha', () => ({
      pullCardForChild: grantSpy,
    }));

    // Drive finishLevelAction through a boss-clear path (same harness as PR #51 test).
    const result = await runFinishLevelHarness({
      bossCleared: true,
      existingWeekProgress: null,
    });

    expect(grantSpy).toHaveBeenCalledWith('c1', 'boss_clear', expect.any(String));
    expect(result.cardGrant).toEqual(expect.objectContaining({ granted: true }));
  });
});
```

`runFinishLevelHarness` is whatever helper the PR #51 test file uses to invoke the action with mocked DBs. Reuse it. If the file used inline mock setup, follow that pattern.

- [ ] **Step 8.2: Confirm failure**

```bash
pnpm vitest run tests/unit/finish-level-boss.test.ts
```

Expected: FAIL — `cardGrant` is undefined on the result; spy not called.

- [ ] **Step 8.3: Wire pullCardForChild into finishLevelAction**

In `src/lib/actions/play.ts`, find `finishLevelAction`. After the `if (bossCleared && !alreadyAwarded) { ... }` block (around line 257), add:

```ts
let cardGrant: Awaited<ReturnType<typeof pullCardForChild>> | null = null;
if (bossCleared) {
  cardGrant = await pullCardForChild(child.id, 'boss_clear', parsed.sessionId);
}
```

Add the import at the top:

```ts
import { pullCardForChild } from './gacha';
```

Update the return statement (around line 284) to include `cardGrant`:

```ts
return {
  ok: true,
  bossCleared,
  freePullClaimed: existing?.freePullClaimed ?? false,
  cardGrant,
  bonuses,
  trophies: collectedTrophies,
};
```

(`freePullClaimed` stays in the return for one release; just don't read it client-side after Task 11 lands.)

- [ ] **Step 8.4: Run tests + typecheck**

```bash
pnpm vitest run tests/unit/finish-level-boss.test.ts
pnpm typecheck
```

Expected: PASS (existing PR #51 tests + new card grant test).

- [ ] **Step 8.5: Commit**

```bash
git add src/lib/actions/play.ts tests/unit/finish-level-boss.test.ts
git commit -m "feat(pr52): wire boss clear → pullCardForChild (incl. repeats)"
```

---

## Task 9: Wire perfect_week → `pullCardForChild`

**Files:**
- Modify: `src/lib/db/coins.ts`
- Test: extend the existing `awardPerfectWeekIfDue` test (locate via `grep`).

- [ ] **Step 9.1: Locate the existing test**

```bash
grep -rl "awardPerfectWeekIfDue" tests/
```

Note the file. If none, create `tests/unit/perfect-week-card.test.ts`.

- [ ] **Step 9.2: Write failing test**

Add (or create):

```ts
describe('awardPerfectWeekIfDue card grant (PR #52)', () => {
  it('calls pullCardForChild with source=perfect_week on first award', async () => {
    const grantSpy = vi.fn().mockResolvedValue({ granted: true, itemId: 'x' /* etc */ });
    vi.doMock('@/lib/actions/gacha', () => ({
      pullCardForChild: grantSpy,
    }));
    // Mock DB so awardPerfectWeekIfDue returns { awarded: true, delta: 200 }
    // (reuse existing mock harness in this file)
    const result = await awardPerfectWeekIfDue('c1', 'w1');
    expect(grantSpy).toHaveBeenCalledWith('c1', 'perfect_week', 'w1');
    expect(result.cardGrant).toBeDefined();
  });

  it('does NOT call pullCardForChild when already-awarded', async () => {
    const grantSpy = vi.fn();
    vi.doMock('@/lib/actions/gacha', () => ({
      pullCardForChild: grantSpy,
    }));
    // Mock so awardPerfectWeekIfDue returns { awarded: false }
    const result = await awardPerfectWeekIfDue('c1', 'w1');
    expect(grantSpy).not.toHaveBeenCalled();
    expect(result.cardGrant).toBeNull();
  });
});
```

- [ ] **Step 9.3: Confirm failure**

```bash
pnpm vitest run tests/unit/perfect-week-card.test.ts
# or the existing file you extended
```

Expected: FAIL — `cardGrant` not on return.

- [ ] **Step 9.4: Wire it in**

In `src/lib/db/coins.ts`, find `awardPerfectWeekIfDue` (around line 173). After the coin award (where it returns `{ awarded, delta }`), extend to:

```ts
import { pullCardForChild } from '@/lib/actions/gacha';

export async function awardPerfectWeekIfDue(
  childId: string,
  weekId: string,
): Promise<{ awarded: boolean; delta: number; cardGrant: Awaited<ReturnType<typeof pullCardForChild>> | null }> {
  // ... existing logic ...
  // Inside the "first time" branch (after the coin transaction commits):
  if (firstTime) {
    cardGrant = await pullCardForChild(childId, 'perfect_week', weekId);
  }
  return { awarded: firstTime, delta, cardGrant };
}
```

Preserve all existing behavior; only the return shape grows.

NOTE: importing `pullCardForChild` from `src/lib/actions/gacha.ts` in `src/lib/db/coins.ts` may seem like an inversion (actions importing db is the normal direction). However `pullCardForChild` itself is a thin server-action wrapper that opens a db transaction — invoking it from another db helper is fine. If the import causes circular-dep issues, move the action body to `src/lib/db/grants.ts` and call `pullCardInTx` directly with the existing transaction tx.

- [ ] **Step 9.5: Update the call site in `finishLevelAction`**

The caller in `src/lib/actions/play.ts` (around line 247) destructures the old return:

```ts
const perfectAward = await awardPerfectWeekIfDue(child.id, parsed.weekId);
if (perfectAward.awarded) {
  bonuses.push({ ... });
}
```

Extend:

```ts
const perfectAward = await awardPerfectWeekIfDue(child.id, parsed.weekId);
if (perfectAward.awarded) {
  bonuses.push({ ... });
}
// Capture perfect-week card grant alongside the boss-clear one.
// (The boss-clear cardGrant from Task 8 stays; this PR's perfect_week grant
//  is surfaced via the bonuses array or a separate cardGrants list — see
//  Task 12 for the LevelFanfare wiring.)
```

For simplicity in this task: just let `cardGrant` from Task 8 be the only one threaded back. The `awardPerfectWeekIfDue.cardGrant` is consumed inside that fn and doesn't need to bubble up unless the LevelFanfare wants two card reveals. Task 12 will decide.

- [ ] **Step 9.6: Run tests + typecheck — confirm pass**

```bash
pnpm vitest run tests/unit/perfect-week-card.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 9.7: Commit**

```bash
git add src/lib/db/coins.ts tests/unit/perfect-week-card.test.ts
git commit -m "feat(pr52): wire perfect_week → pullCardForChild (first-award only)"
```

---

## Task 10: Wire story chapter → `pullCardForChild`

**Files:**
- Modify: `src/lib/actions/story.ts` (PR #48 file)
- Test: `tests/unit/story-actions.test.ts` (PR #48 file)

- [ ] **Step 10.1: Locate the test file**

```bash
grep -rl "markChapterReadAction" tests/
```

PR #48 should have created `tests/unit/story-actions.test.ts` or similar. Note the path.

- [ ] **Step 10.2: Write failing test**

Add to the test file:

```ts
describe('markChapterReadAction card grant (PR #52)', () => {
  it('calls pullCardForChild with source=story_chapter on first read', async () => {
    const grantSpy = vi.fn().mockResolvedValue({ granted: true, itemId: 'x' /* etc */ });
    vi.doMock('@/lib/actions/gacha', () => ({
      pullCardForChild: grantSpy,
    }));
    // Mock markChapterRead so it reports the row was previously unread.
    const result = await markChapterReadAction({ chapterId: 'chap-1', childId: 'c1' });
    expect(grantSpy).toHaveBeenCalledWith('c1', 'story_chapter', 'chap-1');
  });

  it('does NOT call pullCardForChild when chapter already read', async () => {
    const grantSpy = vi.fn();
    vi.doMock('@/lib/actions/gacha', () => ({
      pullCardForChild: grantSpy,
    }));
    // Mock markChapterRead to report row was already-read (no state change).
    await markChapterReadAction({ chapterId: 'chap-2', childId: 'c1' });
    expect(grantSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 10.3: Confirm failure**

```bash
pnpm vitest run tests/unit/story-actions.test.ts
```

Expected: FAIL.

- [ ] **Step 10.4: Wire it in**

In `src/lib/actions/story.ts`, extend `markChapterReadAction` and the underlying `markChapterRead` DB helper to return whether the read was new:

In `src/lib/db/story.ts` (the DB helper):

```ts
export async function markChapterRead(
  chapterId: string,
  childId: string,
): Promise<{ wasNew: boolean }> {
  // Existing UPDATE: SET read_at = NOW() WHERE chapter_id = ... AND read_at IS NULL
  // Use RETURNING to detect whether the row was updated.
  const updated = await db
    .update(storyChapters)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(storyChapters.id, chapterId),
        eq(storyChapters.childId, childId),
        isNull(storyChapters.readAt),
      ),
    )
    .returning({ id: storyChapters.id });
  return { wasNew: updated.length > 0 };
}
```

Then in `src/lib/actions/story.ts`:

```ts
import { pullCardForChild } from './gacha';

export async function markChapterReadAction(
  input: z.input<typeof MarkReadSchema>,
): Promise<{ ok: true; cardGrant: Awaited<ReturnType<typeof pullCardForChild>> | null }> {
  const parsed = MarkReadSchema.parse(input);
  const { child } = await requireChild(parsed.childId);
  const { wasNew } = await markChapterRead(parsed.chapterId, child.id);
  let cardGrant: Awaited<ReturnType<typeof pullCardForChild>> | null = null;
  if (wasNew) {
    cardGrant = await pullCardForChild(child.id, 'story_chapter', parsed.chapterId);
  }
  revalidatePath(`/play/${child.id}`);
  return { ok: true, cardGrant };
}
```

- [ ] **Step 10.5: Confirm pass**

```bash
pnpm vitest run tests/unit/story-actions.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 10.6: Commit**

```bash
git add src/lib/actions/story.ts src/lib/db/story.ts tests/unit/story-actions.test.ts
git commit -m "feat(pr52): wire story chapter first-read → pullCardForChild"
```

---

## Task 11: Revert PR #51 chest hide; thread cardGrant into LevelFanfare

**Files:**
- Modify: `src/components/scenes/SceneRunner.tsx`
- Modify: `src/components/scenes/fx/LevelFanfare.tsx`
- DELETE: `tests/unit/scene-runner-pr51-chest.test.tsx` (PR #51 behavior reverted)
- Add: `tests/unit/scene-runner-pr52-card-grant.test.tsx`

- [ ] **Step 11.1: Delete the PR #51 chest test**

```bash
git rm tests/unit/scene-runner-pr51-chest.test.tsx
```

- [ ] **Step 11.2: Revert chest gating in SceneRunner**

In `src/components/scenes/SceneRunner.tsx`, find the PR #51 state vars (around line 110):

```tsx
const [freePullClaimed, setFreePullClaimed] = useState(false);
```

DELETE that line.

Find the `finishLevelAction` await block (around line 192) — DELETE:

```tsx
setFreePullClaimed(levelResult.freePullClaimed);
```

Find the `LevelFanfare` render (around line 165):

```tsx
chestAvailable={lastSceneType === 'boss' && !freePullClaimed}
```

Change back to:

```tsx
chestAvailable={lastSceneType === 'boss'}
```

Also add a new state to capture the card grant:

```tsx
const [cardGrant, setCardGrant] = useState<{
  granted: boolean;
  itemId?: string;
  packSlug?: string;
  isDupe?: boolean;
} | null>(null);
```

In the finishLevelAction await block, capture:

```tsx
if (levelResult.cardGrant) {
  setCardGrant({
    granted: levelResult.cardGrant.granted,
    ...(levelResult.cardGrant.granted ? {
      itemId: levelResult.cardGrant.itemId,
      packSlug: levelResult.cardGrant.packSlug,
      isDupe: levelResult.cardGrant.isDupe,
    } : {}),
  });
}
```

Pass to LevelFanfare:

```tsx
<LevelFanfare
  weekLabel={weekLabel}
  coinsThisSession={coinsThisSession}
  childId={childId}
  weekId={weekId}
  chestAvailable={lastSceneType === 'boss'}
  cardGrant={cardGrant}
  onContinue={() => router.push(resolvedExitHref)}
/>
```

- [ ] **Step 11.3: Extend LevelFanfare with cardGrant prop**

In `src/components/scenes/fx/LevelFanfare.tsx`:

```tsx
interface CardGrantSummary {
  granted: boolean;
  itemId?: string;
  packSlug?: string;
  isDupe?: boolean;
}

interface LevelFanfareProps {
  // existing props ...
  cardGrant?: CardGrantSummary | null;
}

// Inside the component, after existing chest UI:
{cardGrant?.granted ? (
  <div className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-center text-amber-900">
    <p className="text-sm font-semibold">
      {cardGrant.isDupe ? '+1 碎片 / +1 shard' : '🎴 新卡片！/ New card!'}
    </p>
  </div>
) : cardGrant?.granted === false && lastSceneType === 'boss' ? (
  <div className="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-center text-stone-700">
    <p className="text-sm">今天的卡片满了 🎉 / Card limit reached</p>
  </div>
) : null}
```

(Note: `lastSceneType` isn't on `LevelFanfare`'s props. Either pass it through, or use `chestAvailable` as the proxy — chest is only available on boss, so `chestAvailable && cardGrant?.granted === false` indicates the cap-reached case.)

Use `chestAvailable` as the proxy:

```tsx
{cardGrant?.granted ? (
  // card reveal block
) : chestAvailable && cardGrant?.granted === false ? (
  // cap reached block
) : null}
```

- [ ] **Step 11.4: Write new test for card-grant path**

Create `tests/unit/scene-runner-pr52-card-grant.test.tsx` mirroring the PR #51 mock harness:

```tsx
// Mock finishLevelAction to return cardGrant: { granted: true, ... }
// Assert LevelFanfare receives data-card-granted="true" (use a similar mock-LevelFanfare with data attributes)
// Assert chestAvailable === true always (no longer gated by freePullClaimed)
```

Full test:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/actions/play', () => ({
  finishLevelAction: vi.fn().mockResolvedValue({
    ok: true,
    bossCleared: true,
    freePullClaimed: true, // would have hidden chest in PR #51; PR #52 ignores this
    cardGrant: {
      granted: true,
      itemId: 'item-x',
      packId: 'pack-x',
      packSlug: 'flags',
      isDupe: false,
      shardsAfter: 0,
      cardsThisWeek: 1,
    },
    bonuses: [],
    trophies: [],
  }),
  startSessionAction: vi.fn().mockResolvedValue({ sessionId: 'sess-1' }),
  finishAttemptAction: vi.fn().mockResolvedValue({ ok: true, bonuses: [], trophies: [] }),
}));

vi.mock('@/components/scenes/fx/LevelFanfare', () => ({
  LevelFanfare: (props: { chestAvailable: boolean; cardGrant?: { granted: boolean } }) => (
    <div
      data-testid="fanfare"
      data-chest={String(props.chestAvailable)}
      data-card-granted={String(props.cardGrant?.granted ?? '')}
    />
  ),
}));

import { SceneRunner } from '@/components/scenes/SceneRunner';

describe('SceneRunner card grant (PR #52)', () => {
  it('shows chest AND card grant on repeat boss clear', async () => {
    // Drive runner with a boss-only level array.
    render(<SceneRunner /* ... props ... */ />);
    // ... advance + finish
    const fanfare = await screen.findByTestId('fanfare');
    expect(fanfare).toHaveAttribute('data-chest', 'true');
    expect(fanfare).toHaveAttribute('data-card-granted', 'true');
  });
});
```

- [ ] **Step 11.5: Run + confirm pass**

```bash
pnpm vitest run tests/unit/scene-runner-pr52-card-grant.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 11.6: Commit**

```bash
git add src/components/scenes/SceneRunner.tsx src/components/scenes/fx/LevelFanfare.tsx tests/unit/scene-runner-pr51-chest.test.tsx tests/unit/scene-runner-pr52-card-grant.test.tsx
git commit -m "feat(pr52): revert PR #51 chest gating; thread cardGrant into LevelFanfare"
```

---

## Task 12: Remove shop gacha button from pack page

**Files:**
- Modify: `src/components/play/PackPageBody.tsx`
- Modify: `src/components/play/GachaPullButton.tsx`
- Modify: `tests/unit/pack-page-body.test.tsx`

- [ ] **Step 12.1: Add failing test asserting button removed**

In `tests/unit/pack-page-body.test.tsx`, add:

```tsx
describe('PackPageBody gacha removal (PR #52)', () => {
  it('does NOT render "Buy a pull" CTA', () => {
    render(<PackPageBody {/* props */} />);
    expect(screen.queryByRole('button', { name: /buy a pull|抽卡|抽一张/i })).toBeNull();
  });
});
```

- [ ] **Step 12.2: Confirm failure**

Expected: FAIL — the button currently renders.

- [ ] **Step 12.3: Remove the button from the page**

In `src/components/play/PackPageBody.tsx`, find the `<GachaPullButton ... />` usage and DELETE that line. Keep the import for one release if other components might still use it (grep first):

```bash
grep -rln "GachaPullButton" src/
```

If `PackPageBody` is the only consumer, remove the import too. Mark the component file as deprecated:

In `src/components/play/GachaPullButton.tsx`, add a top-of-file comment:

```tsx
// @deprecated PR #52 — coin gacha removed. File retained for one release.
//   Drop entirely in PR #53+ along with `pullPaid` action.
```

- [ ] **Step 12.4: Confirm pass**

```bash
pnpm vitest run tests/unit/pack-page-body.test.tsx
```

Expected: PASS.

- [ ] **Step 12.5: Commit**

```bash
git add src/components/play/PackPageBody.tsx src/components/play/GachaPullButton.tsx tests/unit/pack-page-body.test.tsx
git commit -m "feat(pr52): remove coin gacha button from pack page"
```

---

## Task 13: Shard pill + dupe badge on pack page

**Files:**
- Create: `src/components/play/ShardPill.tsx`
- Modify: `src/components/play/PackPageBody.tsx`
- Modify: `src/lib/db/collections.ts` (add `getShardBalance(childId, packId)` query)
- Test: `tests/unit/components/play/ShardPill.test.tsx`
- Test: extend `tests/unit/pack-page-body.test.tsx`

- [ ] **Step 13.1: Write failing tests**

Create `tests/unit/components/play/ShardPill.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShardPill } from '@/components/play/ShardPill';

describe('ShardPill', () => {
  it('renders the shard count with emoji', () => {
    render(<ShardPill count={5} />);
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/🔹/)).toBeInTheDocument();
  });

  it('renders 0 when count is 0', () => {
    render(<ShardPill count={0} />);
    expect(screen.getByText(/0/)).toBeInTheDocument();
  });
});
```

Extend pack-page-body test:

```tsx
it('renders ShardPill in the header (PR #52)', () => {
  render(<PackPageBody {...propsWithShardCount(7)} />);
  expect(screen.getByText(/🔹.*7/)).toBeInTheDocument();
});

it('renders ×N count badge for dupes', () => {
  render(<PackPageBody {...propsWithOwnedCount('item-1', 3)} />);
  expect(screen.getByText(/×3/)).toBeInTheDocument();
});
```

- [ ] **Step 13.2: Implement ShardPill**

Create `src/components/play/ShardPill.tsx`:

```tsx
interface ShardPillProps {
  count: number;
}

export function ShardPill({ count }: ShardPillProps) {
  return (
    <span
      aria-label={`${count} shards`}
      className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-900"
    >
      <span aria-hidden>🔹</span>
      <span>{count}</span>
    </span>
  );
}
```

- [ ] **Step 13.3: Add shard query**

In `src/lib/db/collections.ts`, append:

```ts
import { shardBalances } from '@/db/schema/collections';

export async function getShardBalance(childId: string, packId: string): Promise<number> {
  const rows = await db
    .select({ shards: shardBalances.shards })
    .from(shardBalances)
    .where(
      and(eq(shardBalances.childId, childId), eq(shardBalances.packId, packId)),
    );
  return rows[0]?.shards ?? 0;
}
```

- [ ] **Step 13.4: Render ShardPill in PackPageBody**

In `src/components/play/PackPageBody.tsx`, add `shardCount: number` to the Props, render `<ShardPill count={shardCount} />` near the header.

Also render `×N` badge on owned items where `count > 1`. The page already maps over `ownedItems`; extend the item card render to show the count.

The data flow: server page (`src/app/play/[childId]/collection/[packSlug]/page.tsx`) fetches `getShardBalance(childId, packId)` and passes to `PackPageBody`.

- [ ] **Step 13.5: Confirm pass**

```bash
pnpm vitest run tests/unit/components/play/ShardPill.test.tsx tests/unit/pack-page-body.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 13.6: Commit**

```bash
git add src/components/play/ShardPill.tsx src/components/play/PackPageBody.tsx src/lib/db/collections.ts tests/unit/components/play/ShardPill.test.tsx tests/unit/pack-page-body.test.tsx src/app/play/[childId]/collection/[packSlug]/page.tsx
git commit -m "feat(pr52): shard pill + dupe count badge on pack page"
```

---

## Task 14: SwapDialog component

**Files:**
- Create: `src/components/play/SwapDialog.tsx`
- Modify: `src/components/play/PackPageBody.tsx` (wire swap CTA)
- Test: `tests/unit/components/play/SwapDialog.test.tsx`

- [ ] **Step 14.1: Write failing tests**

Create `tests/unit/components/play/SwapDialog.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwapDialog } from '@/components/play/SwapDialog';

describe('SwapDialog', () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    itemNameZh: '法国',
    itemNameEn: 'France',
    shardCost: 3,
    shardBalance: 5,
    onConfirm: vi.fn(),
  };

  it('shows cost and remaining shards', () => {
    render(<SwapDialog {...baseProps} />);
    expect(screen.getByText(/3/)).toBeInTheDocument(); // cost
    expect(screen.getByText(/5/)).toBeInTheDocument(); // balance
  });

  it('confirm calls onConfirm when sufficient shards', () => {
    const onConfirm = vi.fn();
    render(<SwapDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm|换/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables confirm when insufficient shards', () => {
    render(<SwapDialog {...baseProps} shardBalance={2} />);
    const confirm = screen.getByRole('button', { name: /confirm|换/i });
    expect(confirm).toBeDisabled();
  });
});
```

- [ ] **Step 14.2: Confirm failure**

```bash
pnpm vitest run tests/unit/components/play/SwapDialog.test.tsx
```

Expected: FAIL.

- [ ] **Step 14.3: Implement SwapDialog**

Create `src/components/play/SwapDialog.tsx`:

```tsx
'use client';

interface SwapDialogProps {
  open: boolean;
  onClose: () => void;
  itemNameZh: string;
  itemNameEn: string;
  shardCost: number;
  shardBalance: number;
  onConfirm: () => void;
}

export function SwapDialog({
  open,
  onClose,
  itemNameZh,
  itemNameEn,
  shardCost,
  shardBalance,
  onConfirm,
}: SwapDialogProps) {
  if (!open) return null;
  const canAfford = shardBalance >= shardCost;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-3xl bg-white px-6 py-5">
        <h2 className="text-lg font-bold text-stone-900">
          换取 / Trade for {itemNameZh} / {itemNameEn}?
        </h2>
        <p className="mt-2 text-sm text-stone-700">
          需要 <strong>{shardCost} 🔹</strong> 碎片 / {shardCost} shards
          <br />
          你现在有 <strong>{shardBalance} 🔹</strong> / You have {shardBalance}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-stone-200 px-4 py-2 font-semibold text-stone-900"
          >
            取消 / Cancel
          </button>
          <button
            type="button"
            disabled={!canAfford}
            onClick={onConfirm}
            className={`flex-1 rounded-full px-4 py-2 font-semibold ${
              canAfford ? 'bg-sky-500 text-white' : 'bg-stone-300 text-stone-500'
            }`}
          >
            换! / Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 14.4: Wire into PackPageBody**

In `PackPageBody.tsx`, add a tap handler on unowned items that opens `<SwapDialog>` with the item details. The confirm handler calls `swapShardsForItem(childId, itemId)` via the action.

Sketch (inside a `'use client'` boundary):

```tsx
const [swapItem, setSwapItem] = useState<CollectibleItem | null>(null);

// In the unowned-item card click handler:
onClick={() => setSwapItem(item)}

// At the bottom of the component:
{swapItem ? (
  <SwapDialog
    open
    onClose={() => setSwapItem(null)}
    itemNameZh={swapItem.nameZh}
    itemNameEn={swapItem.nameEn}
    shardCost={3}
    shardBalance={shardCount}
    onConfirm={async () => {
      const result = await swapShardsForItem(childId, swapItem.id);
      if (result.ok) {
        setSwapItem(null);
        // Page should revalidate via the action's revalidatePath call.
      } else {
        // Show toast based on result.reason
      }
    }}
  />
) : null}
```

- [ ] **Step 14.5: Run tests + typecheck**

```bash
pnpm vitest run tests/unit/components/play/SwapDialog.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 14.6: Commit**

```bash
git add src/components/play/SwapDialog.tsx src/components/play/PackPageBody.tsx tests/unit/components/play/SwapDialog.test.tsx
git commit -m "feat(pr52): SwapDialog + pack-page wiring"
```

---

## Task 15: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 15.1: Bump refresh date + add PR #52 entry**

Update the line `## Current state (last refreshed YYYY-MM-DD)` to today's date.

After the last PR entry in "Current state", append:

```markdown
- **PR #52 (shipped YYYY-MM-DD)** — Gacha economy redesign. Removed coin-purchased shop gacha entirely. Cards now flow from Boss (including REPEATS — reverting PR #51's `freePullClaimed` chest hide), perfect_week first-award, and Story chapter first-read. Cap: 10 cards/wk (UTC Monday reset), tracked in new `child_card_grants_weekly` table. Duplicates auto-grant 1 shard of the picked pack; spend 3 shards on any chosen unowned card via the new `SwapDialog`. New `pullCardForChild` + `swapShardsForItem` server actions; pure `weightedRandomPick` algorithm biases toward packs with more unowned items. Migration 0018 adds `child_card_grants_weekly` + `card_grants_log`. `pullPaid` + `GachaPullButton` marked deprecated (kept one release). `awardPerfectWeekIfDue` + `markChapterReadAction` extended to return `cardGrant`. +N tests.
```

- [ ] **Step 15.2: Add landmines**

Append to the "Landmines" section:

```markdown
- **Boss-clear card grants use `sessionId` as refId, not `weekId`.** Each boss clear runs in its own `play_sessions` row; sessionId is naturally unique per clear. If you use weekId by mistake, only the FIRST boss clear ever grants a card — repeats silently no-op. Always pass `parsed.sessionId` to `pullCardForChild`.
- **Shards are per-pack, not global.** `shard_balances` table is `(childId, packId, shards)`. Shards from flag dupes can only buy flag cards. UI must show shard counts per pack page, NOT a global wallet — combining them would mislead.
- **Weekly cap is 10 cards across ALL sources per UTC week.** `child_card_grants_weekly (childId, weekStartUtc)` with `count` integer. Cap check runs FOR UPDATE inside the same transaction as the grant. Don't add a card source without consulting this counter.
- **PR #51's `week_progress.freePullClaimed` column is now dead read-side but kept in DB.** PR #52 reverts the client gate but doesn't drop the column (additive-only migrations). Comment as deprecated; future PRs may reuse for "first-ever boss clear" celebration UX.
- **`pullPaid` + `GachaPullButton` are deprecated, not deleted.** Marked `@deprecated PR #52` for one release. If PR #52 needs a rollback, easy revert path. Drop entirely in PR #53+ once stable.
- **`weightedRandomPick` reads ~100 rows synchronously inside the tx.** Fine for 87 items. If catalog grows past 1000 items, precompute weights into a materialized view or external cache.
```

- [ ] **Step 15.3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record PR #52 (gacha redesign) + landmines"
```

---

## Task 16: Verify + push + open PR

- [ ] **Step 16.1: Run four-green gate**

```bash
rm -rf .next
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all four green.

- [ ] **Step 16.2: Backfill test count**

Compare count vs baseline (from Task 1.3). Update CLAUDE.md `+N tests` placeholder. Commit:

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): backfill PR #52 test count"
```

- [ ] **Step 16.3: Manual dev smoke**

```bash
pnpm dev
```

Walk through:
1. Sign in → boss-clear a week → confirm card reveal in fanfare (and shard if dupe).
2. Replay same boss → another card reveal (no longer hidden).
3. Hit 10/wk → 11th boss clear shows "card limit reached" copy.
4. Backpack pack page → shard pill in header; dupe items show `×N`; unowned items tappable → SwapDialog opens.
5. Tap "Trade 3 shards" with sufficient balance → item appears in owned grid.
6. Tap with insufficient balance → button disabled.
7. Old `child_collections` rows from PR #21-#27 coin-gacha era still render with `count=1` (no data migration impact).

- [ ] **Step 16.4: Push + open PR**

```bash
git push -u origin feat/pr52-gacha-redesign
gh pr create --title "feat(pr52): gacha economy redesign — play-to-earn cards + shard swap" --body "$(cat <<'EOF'
## Summary

Replaces coin-purchased shop gacha with play-to-earn cards across three channels (Boss clears including repeats, perfect_week first-award, Story chapter first-read), capped at 10 cards/wk (UTC Monday reset). Duplicates auto-grant 1 per-pack shard; spend 3 shards on any chosen unowned card via new SwapDialog.

## Architecture

- **2 new tables** (migration 0018): `child_card_grants_weekly` (cap counter) + `card_grants_log` (idempotency PK).
- **2 new actions**: `pullCardForChild(childId, source, refId)` + `swapShardsForItem(childId, itemId)`.
- **`weightedRandomPick`** algorithm biases toward packs with more unowned items.
- **3 callsites wired**: boss-clear (`finishLevelAction`), perfect_week (`awardPerfectWeekIfDue`), story (`markChapterReadAction`).
- **Reverts PR #51's `freePullClaimed` chest hide** — chest now shows on every boss clear.
- **Shop gacha removed**: `GachaPullButton` + `pullPaid` deprecated (kept for one release).

## Test plan

- [ ] First boss clear → card reveal in fanfare
- [ ] Repeat boss clear → another card reveal (no longer hidden)
- [ ] After 10 cards/wk → 11th clear shows "card limit reached"
- [ ] Pack page → shard pill + ×N dupe badges + swap CTA on unowned
- [ ] Tap swap with ≥3 shards → item moves to owned
- [ ] Tap swap with <3 shards → button disabled, helper copy
- [ ] No "Buy a pull" button anywhere in shop
- [ ] Existing collection rows (pre-PR-52) still render at count=1

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review (controller checklist)

Spec coverage:

| Spec § | Item | Implementing task |
|---|---|---|
| 3 / Card sources | Boss + perfect + story | Tasks 8, 9, 10 |
| 3 / Weekly cap 10 | Counter + check | Tasks 3, 5, 6 |
| 3 / Random pack pick | weightedRandomPick | Task 5 |
| 3 / Dupes → count++ | childCollections upsert | Task 5 (pullCardInTx) |
| 3 / Per-pack shards | shardBalances increment on dupe | Task 5 |
| 3 / 3-shard swap | swapShardsInTx + SwapDialog | Tasks 5, 7, 14 |
| 3 / Shop gacha removal | PackPageBody change | Task 12 |
| 3 / PR #51 revert | SceneRunner chest unconditional | Task 11 |
| 4.1 / migration 0018 | Schema + drizzle-kit generate | Task 3 |
| 4.2 / pullCardForChild | server action | Task 6 |
| 4.3 / swapShardsForItem | server action | Task 7 |
| 4.4 / boss wiring | finishLevelAction | Task 8 |
| 4.4 / perfect_week wiring | awardPerfectWeekIfDue | Task 9 |
| 4.4 / story wiring | markChapterReadAction | Task 10 |
| 4.5 / pack page UI | ShardPill + dupe badge + Swap CTA | Tasks 13, 14 |
| 4.5 / LevelFanfare | cardGrant prop | Task 11 |
| 4.6 / weighted random | weightedRandomPick | Task 5 |
| 6 / card_grants_log idempotency | INSERT with PK collision detect | Task 5 |
| 6 / boss refId = sessionId | finishLevelAction calls pullCardForChild('boss_clear', sessionId) | Task 8 |
| 7 / error handling | Skip card, no error toast | Tasks 6, 11 |
| 8 / tests enumerated | covered across all tasks |
| 11 / landmines documented | CLAUDE.md | Task 15 |

Placeholder scan: no "TBD" or vague steps; every step has full code or commands.

Type consistency:
- `CardGrantResult` / `CardGrantSkipped` defined in Task 5, consumed in Tasks 6, 8, 9, 10, 11.
- `swapShardsForItem` return type identical between Task 7 implementation and Task 14 UI consumption.
- `mondayOfIsoWeek(iso: string): string` used identically in Task 2 and Task 6.
- `WEEKLY_CARD_CAP = 10` exported from grants.ts (Task 5); referenced consistently.
- `SHARD_SWAP_COST = 3` same.

Plan is internally consistent and ready for execution.
