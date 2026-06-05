# Card Economy v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cards flow more freely (daily cap 10/day), surface the existing shard-swap so kids can spend shards, and add a weekly 5-of-7 check-in gift pack (one card per active collection pack).

**Architecture:** Three independent changes to the PR #52 gacha system. (A) is client-only (PackPageBody chip). (B) swaps the weekly cap counter for a new per-day table. (C) adds a gift-pack grant path keyed off the existing daily-login check-in signal, surfaced via a new reveal component. No `week_levels` change → **no recompile**.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle (append-only migrations), Vitest + RTL (mock `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`).

**Spec:** `docs/superpowers/specs/2026-06-04-card-economy-v2-design.md`

**Branch:** `feat/card-economy-v2` (already created; spec already committed).

---

## Key existing shapes (read before starting)

- `src/lib/db/grants.ts` — `pullCardInTx(tx, childId, source, refId, weekStartUtc, rng)`. Reads/writes `childCardGrantsWeekly`, caps at `WEEKLY_CARD_CAP = 10`. Returns `CardGrantResult` (`{granted:true, itemId, packId, packSlug, isDupe, shardsAfter, cardsThisWeek}`) or `CardGrantSkipped` (`{granted:false, reason:'weekly_cap_reached'|'already_granted', cardsThisWeek}`). Pure helper `weightedRandomPick(items, ownedSet, rng)` already tested in `tests/unit/grants-db.test.ts`.
- `src/lib/actions/gacha.ts` — `pullCardForChild(childId, source, refId)` computes `weekStartUtc = mondayOfIsoWeek(todayUtcIso())` then `db.transaction(tx => pullCardInTx(...))`. `swapShardsForItem(childId, itemId)` (user-tappable, `requireChild`).
- `src/lib/errors/gacha-errors.ts:30` — `WeeklyCardCapError` constructor takes `cardsThisWeek`.
- Callers of `pullCardForChild`: `play.ts:287` (perfect_week, fire-and-forget), `play.ts:320` (boss_clear, awaited), `story.ts:137` (story_chapter).
- UI consumers of a card grant read only `granted`, `itemId`, `packSlug`, `isDupe` (`SceneRunner.tsx:211-221`, `LevelFanfare.tsx:130-138`). They do NOT read `cardsThisWeek` or `reason`. `LevelFanfare.tsx:138` already says "今天的卡片满了 / Card limit reached" (daily-friendly text — keep as-is).
- `src/lib/db/activity.ts` — `getActivityForRange(childId, startIso, endIso): ActivityDay[]`; each `ActivityDay` has `dailyLoginBonus: boolean`. A "check-in day" = `dailyLoginBonus === true`.
- `src/lib/actions/play.ts:142-178` — `finishAttemptAction` ticks streak, and inside `if (tick.ticked)` calls `awardDailyLoginIfDue(child.id, today)`. `daily.awarded === true` ⇒ first play of a fresh UTC day. **This is the gift-pack trigger point.**
- `src/lib/utils/iso-week.ts` — `mondayOfIsoWeek(iso)`. `src/lib/db/streaks.ts` — `todayUtcIso()`.
- Home page `src/app/play/[childId]/page.tsx:41,62,148` — computes `monday`, fetches `weekActivity = getActivityForRange(child.id, monday, sunday)`, renders `<WeekStrip activity={weekActivity} todayIso childId />`.
- `src/db/schema/gacha.ts` — `childCardGrantsWeekly`, `cardGrantsLog(childId, source, refId, grantedAt)`.

---

## File structure

**New files**
- `drizzle/00XX_<name>.sql` + `drizzle/meta/00XX_snapshot.json` — generated, `child_card_grants_daily` table.
- `src/components/play/GiftPackReveal.tsx` — celebratory modal showing the N gift cards.
- Test files (one per task, see tasks).

**Modified files**
- `src/db/schema/gacha.ts` — add `childCardGrantsDaily`.
- `src/lib/db/grants.ts` — daily cap in `pullCardInTx`; `DAILY_CARD_CAP`; new `grantGiftPackInTx`; rename `cardsThisWeek`→`cardsToday`, reason `weekly_cap_reached`→`daily_cap_reached`.
- `src/lib/errors/gacha-errors.ts` — rename `cardsThisWeek` ctor field → `cardsToday` (and message).
- `src/lib/actions/gacha.ts` — `pullCardForChild` passes `dayUtc`; new `claimWeeklyGiftIfDue(childId)`.
- `src/lib/actions/play.ts` — trigger `claimWeeklyGiftIfDue` after daily-login; add `giftPack` to `finishAttemptAction` return type.
- `src/components/scenes/SceneRunner.tsx` — mount `GiftPackReveal` from `finishAttemptAction` result.
- `src/components/play/PackPageBody.tsx` — visible trade chip + header hint (Change A).
- `src/app/play/[childId]/page.tsx` + `src/components/play/WeekStrip.tsx` — `N/5` gift progress hint.
- `CLAUDE.md` — PR entry + landmines.

---

## Task 1: Migration + schema for `child_card_grants_daily`

**Files:**
- Modify: `src/db/schema/gacha.ts`
- Create: `drizzle/00XX_*.sql` (generated)

- [ ] **Step 1: Add the schema table.** In `src/db/schema/gacha.ts`, after `childCardGrantsWeekly`, add:

```ts
/**
 * Per-child DAILY card-grant counter (PR card-economy-v2). Replaces the
 * weekly cap. Resets every UTC midnight. Used by `pullCardInTx` to enforce
 * DAILY_CARD_CAP. The older `childCardGrantsWeekly` table is now dead (kept
 * per the append-only migration rule).
 */
export const childCardGrantsDaily = pgTable(
  'child_card_grants_daily',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    dayUtc: text('day_utc').notNull(), // ISO YYYY-MM-DD (UTC)
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.childId, t.dayUtc] })],
);
```

- [ ] **Step 2: Generate the migration.**

Run: `pnpm drizzle-kit generate`
Expected: a new `drizzle/00XX_*.sql` containing `CREATE TABLE "child_card_grants_daily"` + a `drizzle/meta/00XX_snapshot.json`. Note the generated number for the commit.

- [ ] **Step 3: Verify the SQL is additive only.**

Run: `git diff --stat drizzle/`
Expected: only new files (one `.sql`, one snapshot) + `_journal.json` updated. **No edits to any prior `drizzle/*.sql`.** If drizzle tries to alter/drop anything else, stop and investigate.

- [ ] **Step 4: Typecheck.**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 5: Commit.**

```bash
git add src/db/schema/gacha.ts drizzle/
git commit -m "feat(card-economy-v2): child_card_grants_daily table + schema"
```

---

## Task 2: Daily cap in `pullCardInTx`

**Files:**
- Modify: `src/lib/db/grants.ts`
- Modify: `src/lib/errors/gacha-errors.ts`
- Test: `tests/unit/pull-card-daily-cap.test.ts` (new)

- [ ] **Step 1: Write the failing test.** Create `tests/unit/pull-card-daily-cap.test.ts`. This exercises the cap branch with a fake `tx` whose first `.select().from().where().for('update')` returns the current daily count. Mirror the chain shape used in `pullCardInTx`.

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: { transaction: vi.fn() } }));

import { pullCardInTx, DAILY_CARD_CAP } from '@/lib/db/grants';

/** Builds a fake tx whose weekly/daily counter select returns `count`. */
function fakeTxReturningDailyCount(count: number) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          for: vi.fn().mockResolvedValue([{ count }]),
        })),
      })),
    })),
    insert: vi.fn(),
    update: vi.fn(),
  } as never;
}

describe('pullCardInTx daily cap', () => {
  it('exports DAILY_CARD_CAP = 10', () => {
    expect(DAILY_CARD_CAP).toBe(10);
  });

  it('returns daily_cap_reached when the day is already at the cap', async () => {
    const tx = fakeTxReturningDailyCount(DAILY_CARD_CAP);
    const result = await pullCardInTx(tx, 'child-1', 'boss_clear', 'ref-1', '2026-06-04');
    expect(result.granted).toBe(false);
    if (!result.granted) {
      expect(result.reason).toBe('daily_cap_reached');
      expect(result.cardsToday).toBe(DAILY_CARD_CAP);
    }
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `pnpm vitest run tests/unit/pull-card-daily-cap.test.ts`
Expected: FAIL (`DAILY_CARD_CAP` undefined / `cardsToday` missing / reason mismatch).

- [ ] **Step 3: Implement.** In `src/lib/db/grants.ts`:
  1. Add import: `childCardGrantsDaily` from `@/db/schema/gacha` (keep `childCardGrantsWeekly` import — still referenced by type only; if unused after edit, remove it to satisfy lint).
  2. Add `export const DAILY_CARD_CAP = 10;` next to `WEEKLY_CARD_CAP` (leave `WEEKLY_CARD_CAP` in place, marked dead with a comment).
  3. In `CardGrantResult` and `CardGrantSkipped`, rename `cardsThisWeek` → `cardsToday`. In `CardGrantSkipped.reason`, rename `'weekly_cap_reached'` → `'daily_cap_reached'`.
  4. Change `pullCardInTx` signature param `weekStartUtc: string` → `dayUtc: string`.
  5. Replace the counter SELECT to target `childCardGrantsDaily` filtered by `eq(childCardGrantsDaily.childId, childId)` and `eq(childCardGrantsDaily.dayUtc, dayUtc)`.
  6. Cap check: `if (currentCount >= DAILY_CARD_CAP) return { granted:false, reason:'daily_cap_reached', cardsToday: currentCount };`.
  7. The `already_granted` early-return uses `cardsToday: currentCount`.
  8. Replace the counter upsert (step "6. Increment weekly counter") to insert/upsert `childCardGrantsDaily` with `{ childId, dayUtc, count: 1 }`, conflict target `[childCardGrantsDaily.childId, childCardGrantsDaily.dayUtc]`, set `count = count + 1`.
  9. Final return field `cardsThisWeek: currentCount + 1` → `cardsToday: currentCount + 1`.

- [ ] **Step 4: Update `gacha-errors.ts`.** In `WeeklyCardCapError`, rename the readonly field `cardsThisWeek` → `cardsToday` and update the message string to "daily card cap" / `cardsToday`. (Class name can stay; or rename to `DailyCardCapError` — keep the name `WeeklyCardCapError` to avoid touching unrelated callers, but if grep shows it's unused in UI, leave it.)

Run: `grep -rn "cardsThisWeek\|WeeklyCardCapError" src --include=*.ts --include=*.tsx | grep -v grants.ts` and fix any remaining references.

- [ ] **Step 5: Run the test + the existing grants test.**

Run: `pnpm vitest run tests/unit/pull-card-daily-cap.test.ts tests/unit/grants-db.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/db/grants.ts src/lib/errors/gacha-errors.ts tests/unit/pull-card-daily-cap.test.ts
git commit -m "feat(card-economy-v2): daily cap (10/day) replaces weekly cap in pullCardInTx"
```

---

## Task 3: `pullCardForChild` passes `dayUtc`

**Files:**
- Modify: `src/lib/actions/gacha.ts`
- Test: `tests/unit/pull-card-for-child.test.ts` (existing — update)

- [ ] **Step 1: Update the existing test.** Open `tests/unit/pull-card-for-child.test.ts`. Wherever it asserts the 5th positional arg to `pullCardInTx` was `mondayOfIsoWeek(...)` / a week string, change the expectation to the day string (`todayUtcIso()` = today's ISO date). If it asserts `cardsThisWeek` on the result, rename to `cardsToday`. If the test doesn't inspect that arg, add an assertion that the mocked `pullCardInTx` was called with `expect.any(String)` as the 5th arg and document it's `dayUtc`.

- [ ] **Step 2: Run it, verify it fails** (if you tightened the assertion).

Run: `pnpm vitest run tests/unit/pull-card-for-child.test.ts`
Expected: FAIL on the week→day arg (or PASS if assertion was loose — then skip to Step 3).

- [ ] **Step 3: Implement.** In `src/lib/actions/gacha.ts` `pullCardForChild`:

```ts
const dayUtc = todayUtcIso();
const result = await db.transaction((tx) =>
  pullCardInTx(tx, childId, source, refId, dayUtc, Math.random),
);
```

Remove the now-unused `mondayOfIsoWeek` import **only if** it's not used elsewhere in the file (grep first — `claimWeeklyGiftIfDue` in Task 5 will re-add a week helper, so you may keep it).

- [ ] **Step 4: Run test.**

Run: `pnpm vitest run tests/unit/pull-card-for-child.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/actions/gacha.ts tests/unit/pull-card-for-child.test.ts
git commit -m "feat(card-economy-v2): pullCardForChild uses dayUtc for daily cap"
```

---

## Task 4: `grantGiftPackInTx` — one card per active pack

**Files:**
- Modify: `src/lib/db/grants.ts`
- Test: `tests/unit/grant-gift-pack.test.ts` (new)

The gift pack picks one card **per active pack**, bypassing the daily counter, idempotent per week via `cardGrantsLog(childId, 'weekly_checkin', weekStartUtc)`. To keep it testable, factor the per-pack selection as a thin loop over the existing tested `weightedRandomPick` scoped to a single pack's items.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/grant-gift-pack.test.ts`. Use a fake `tx` that: (a) the idempotency insert succeeds (no throw); (b) returns two active packs; (c) returns each pack's catalog; (d) returns empty owned set; (e) records inserts. Assert the result lists one granted card per pack and the daily counter table was never touched.

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: { transaction: vi.fn() } }));

import { grantGiftPackInTx, WEEKLY_GIFT_SOURCE } from '@/lib/db/grants';

// Minimal chainable select stub that yields `rows` from any .from().where()/.innerJoin().where()
function selectYielding(rowsQueue: unknown[][]) {
  let i = 0;
  const make = () => ({
    from: vi.fn(() => make()),
    innerJoin: vi.fn(() => make()),
    where: vi.fn(() => Promise.resolve(rowsQueue[i++] ?? [])),
  });
  return vi.fn(() => make());
}

describe('grantGiftPackInTx', () => {
  it('grants one card per active pack and bypasses the daily counter', async () => {
    const inserts: string[] = [];
    const tx = {
      // 1) idempotency log insert (no conflict)
      // 2..) child_collections inserts, shard upserts
      insert: vi.fn((tbl: { _?: { name?: string } }) => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ shards: 1 }]) })),
        })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
      select: selectYielding([
        // active packs
        [{ id: 'p1', slug: 'zodiac' }, { id: 'p2', slug: 'flags' }],
        // p1 catalog
        [{ id: 'i1', packId: 'p1', packSlug: 'zodiac', dropWeight: 1 }],
        // owned for p1 (none)
        [],
        // p2 catalog
        [{ id: 'i2', packId: 'p2', packSlug: 'flags', dropWeight: 1 }],
        // owned for p2 (none)
        [],
      ]),
    } as never;

    const result = await grantGiftPackInTx(tx, 'child-1', '2026-06-01', () => 0.1);
    expect(result.granted).toBe(true);
    if (result.granted) {
      expect(result.cards).toHaveLength(2);
      expect(result.cards.map((c) => c.packSlug).sort()).toEqual(['flags', 'zodiac']);
    }
  });

  it('exposes the source constant', () => {
    expect(WEEKLY_GIFT_SOURCE).toBe('weekly_checkin');
  });
});
```

> Note: the exact `tx` mock shape must match your final query chain. Adjust the stub to whatever `grantGiftPackInTx` actually calls — keep the test asserting the **behavior** (one card per pack, idempotency insert attempted, daily counter never selected/inserted).

- [ ] **Step 2: Run it, verify it fails.**

Run: `pnpm vitest run tests/unit/grant-gift-pack.test.ts`
Expected: FAIL (`grantGiftPackInTx` / `WEEKLY_GIFT_SOURCE` not exported).

- [ ] **Step 3: Implement.** In `src/lib/db/grants.ts` add:

```ts
export const WEEKLY_GIFT_SOURCE = 'weekly_checkin';

export interface GiftCard {
  itemId: string;
  packId: string;
  packSlug: string;
  isDupe: boolean;
  shardsAfter: number;
}
export type GiftPackResult =
  | { granted: true; cards: GiftCard[] }
  | { granted: false; reason: 'already_granted' };

/**
 * Weekly check-in gift pack: one card per ACTIVE pack, bypassing the daily
 * cap. Idempotent per (child, weekStartUtc) via cardGrantsLog. Each pick uses
 * weightedRandomPick scoped to a single pack; a dupe pick grants 1 shard.
 */
export async function grantGiftPackInTx(
  tx: Tx,
  childId: string,
  weekStartUtc: string,
  rng: () => number = Math.random,
): Promise<GiftPackResult> {
  // 1. Idempotency guard — once per week.
  try {
    await tx.insert(cardGrantsLog).values({
      childId,
      source: WEEKLY_GIFT_SOURCE,
      refId: weekStartUtc,
    });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
      return { granted: false, reason: 'already_granted' };
    }
    throw err;
  }

  // 2. Active packs.
  const packs = await tx
    .select({ id: collectionPacks.id, slug: collectionPacks.slug })
    .from(collectionPacks)
    .where(eq(collectionPacks.isActive, true));

  // 3. Owned set (once).
  const owned = await tx
    .select({ itemId: childCollections.itemId })
    .from(childCollections)
    .where(eq(childCollections.childId, childId));
  const ownedSet = new Set(owned.map((o) => o.itemId));

  const cards: GiftCard[] = [];
  for (const pack of packs) {
    const catalog = await tx
      .select({
        id: collectibleItems.id,
        packId: collectibleItems.packId,
        packSlug: collectionPacks.slug,
        dropWeight: collectibleItems.dropWeight,
      })
      .from(collectibleItems)
      .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
      .where(eq(collectibleItems.packId, pack.id));
    if (catalog.length === 0) continue; // empty pack — skip, not fatal

    const picked = weightedRandomPick(catalog, ownedSet, rng);
    const isDupe = ownedSet.has(picked.id);

    if (isDupe) {
      await tx
        .update(childCollections)
        .set({ count: sql`${childCollections.count} + 1` })
        .where(and(eq(childCollections.childId, childId), eq(childCollections.itemId, picked.id)));
    } else {
      await tx.insert(childCollections).values({ childId, itemId: picked.id, count: 1 });
      ownedSet.add(picked.id); // so a later pack can't double-count, and biasing stays correct
    }

    let shardsAfter = 0;
    if (isDupe) {
      const [shardRow] = await tx
        .insert(shardBalances)
        .values({ childId, packId: picked.packId, shards: 1 })
        .onConflictDoUpdate({
          target: [shardBalances.childId, shardBalances.packId],
          set: { shards: sql`${shardBalances.shards} + 1` },
        })
        .returning({ shards: shardBalances.shards });
      shardsAfter = shardRow?.shards ?? 1;
    }

    cards.push({ itemId: picked.id, packId: picked.packId, packSlug: picked.packSlug, isDupe, shardsAfter });
  }

  return { granted: true, cards };
}
```

> **Important:** `grantGiftPackInTx` never reads or writes `childCardGrantsDaily` — that's what "bypasses the daily cap" means.

- [ ] **Step 4: Run test.**

Run: `pnpm vitest run tests/unit/grant-gift-pack.test.ts`
Expected: PASS. (Adjust the test's `tx` stub until the chain matches and the behavioral asserts pass.)

- [ ] **Step 5: Commit.**

```bash
git add src/lib/db/grants.ts tests/unit/grant-gift-pack.test.ts
git commit -m "feat(card-economy-v2): grantGiftPackInTx — one card per active pack, cap-bypassing"
```

---

## Task 5: `claimWeeklyGiftIfDue` action + pure check-in counter

**Files:**
- Create: `src/lib/db/checkins.ts` (pure helper)
- Modify: `src/lib/actions/gacha.ts`
- Test: `tests/unit/count-checkin-days.test.ts` (new)
- Test: `tests/unit/claim-weekly-gift.test.ts` (new)

- [ ] **Step 1: Write the pure-counter failing test.** Create `tests/unit/count-checkin-days.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { countCheckInDays, WEEKLY_CHECKIN_THRESHOLD } from '@/lib/db/checkins';
import type { ActivityDay } from '@/lib/db/activity';

function day(dateIso: string, dailyLoginBonus: boolean): ActivityDay {
  return { dateIso, played: dailyLoginBonus, dailyLoginBonus, freezeBurned: false, coinsEarned: 0 };
}

describe('countCheckInDays', () => {
  it('threshold is 5', () => {
    expect(WEEKLY_CHECKIN_THRESHOLD).toBe(5);
  });
  it('counts only days with a daily-login bonus', () => {
    const week = [
      day('2026-06-01', true),
      day('2026-06-02', true),
      day('2026-06-03', false),
      day('2026-06-04', true),
    ];
    expect(countCheckInDays(week)).toBe(3);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `pnpm vitest run tests/unit/count-checkin-days.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the pure helper.** Create `src/lib/db/checkins.ts`:

```ts
import type { ActivityDay } from './activity';

export const WEEKLY_CHECKIN_THRESHOLD = 5;

/** Distinct check-in days = days with a daily-login bonus. */
export function countCheckInDays(activity: readonly ActivityDay[]): number {
  return activity.reduce((n, d) => (d.dailyLoginBonus ? n + 1 : n), 0);
}
```

- [ ] **Step 4: Run it, verify it passes.**

Run: `pnpm vitest run tests/unit/count-checkin-days.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the action test.** Create `tests/unit/claim-weekly-gift.test.ts`. Mock `@/db` (transaction), `@/lib/db/activity` (`getActivityForRange`), `@/lib/db/grants` (`grantGiftPackInTx`), `next/cache`. Assert:
  - returns `null` when check-in days < 5 (grant never called);
  - calls `grantGiftPackInTx` inside a transaction and returns its `cards` when days ≥ 5;
  - returns `null` when grant says `already_granted`.

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActivityForRange: vi.fn(),
  grantGiftPackInTx: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/db', () => ({ db: { transaction: mocks.transaction } }));
vi.mock('@/lib/db/activity', () => ({ getActivityForRange: mocks.getActivityForRange }));
vi.mock('@/lib/db/grants', async (orig) => ({
  ...(await orig<typeof import('@/lib/db/grants')>()),
  grantGiftPackInTx: mocks.grantGiftPackInTx,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { claimWeeklyGiftIfDue } from '@/lib/actions/gacha';

function activityWith(n: number) {
  return Array.from({ length: 7 }, (_, i) => ({
    dateIso: `2026-06-0${i + 1}`,
    played: i < n,
    dailyLoginBonus: i < n,
    freezeBurned: false,
    coinsEarned: 0,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
});

describe('claimWeeklyGiftIfDue', () => {
  it('returns null below threshold', async () => {
    mocks.getActivityForRange.mockResolvedValue(activityWith(4));
    const r = await claimWeeklyGiftIfDue('child-1');
    expect(r).toBeNull();
    expect(mocks.grantGiftPackInTx).not.toHaveBeenCalled();
  });

  it('grants when >= 5 check-in days', async () => {
    mocks.getActivityForRange.mockResolvedValue(activityWith(5));
    mocks.grantGiftPackInTx.mockResolvedValue({ granted: true, cards: [{ itemId: 'i1', packId: 'p1', packSlug: 'zodiac', isDupe: false, shardsAfter: 0 }] });
    const r = await claimWeeklyGiftIfDue('child-1');
    expect(r).not.toBeNull();
    expect(r?.cards).toHaveLength(1);
  });

  it('returns null when already granted this week', async () => {
    mocks.getActivityForRange.mockResolvedValue(activityWith(6));
    mocks.grantGiftPackInTx.mockResolvedValue({ granted: false, reason: 'already_granted' });
    const r = await claimWeeklyGiftIfDue('child-1');
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 6: Run it, verify it fails.**

Run: `pnpm vitest run tests/unit/claim-weekly-gift.test.ts`
Expected: FAIL (`claimWeeklyGiftIfDue` not exported).

- [ ] **Step 7: Implement the action.** In `src/lib/actions/gacha.ts` add (ensure `grantGiftPackInTx` is imported from `@/lib/db/grants`, `getActivityForRange` from `@/lib/db/activity`, `mondayOfIsoWeek` from `@/lib/utils/iso-week`, `todayUtcIso` from `@/lib/db/streaks`, `countCheckInDays`/`WEEKLY_CHECKIN_THRESHOLD` from `@/lib/db/checkins`, `revalidatePath` already imported):

```ts
import type { GiftCard } from '@/lib/db/grants';

/**
 * Trust-caller (no requireChild) — called from finishAttemptAction which is
 * already auth-gated. Grants the weekly check-in gift pack iff the child has
 * >= WEEKLY_CHECKIN_THRESHOLD distinct check-in days this UTC week and hasn't
 * claimed yet. Bypasses the daily cap. Returns the gift cards or null.
 */
export async function claimWeeklyGiftIfDue(
  childId: string,
): Promise<{ cards: GiftCard[] } | null> {
  const today = todayUtcIso();
  const monday = mondayOfIsoWeek(today);
  const sunday = addDaysUtc(monday, 6);
  const activity = await getActivityForRange(childId, monday, sunday);
  if (countCheckInDays(activity) < WEEKLY_CHECKIN_THRESHOLD) return null;

  const result = await db.transaction((tx) => grantGiftPackInTx(tx, childId, monday, Math.random));
  if (!result.granted) return null;

  revalidatePath(`/play/${childId}`);
  for (const c of result.cards) {
    revalidatePath(`/play/${childId}/collection/${c.packSlug}`);
  }
  return { cards: result.cards };
}

function addDaysUtc(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 8: Run both tests.**

Run: `pnpm vitest run tests/unit/claim-weekly-gift.test.ts tests/unit/count-checkin-days.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit.**

```bash
git add src/lib/db/checkins.ts src/lib/actions/gacha.ts tests/unit/count-checkin-days.test.ts tests/unit/claim-weekly-gift.test.ts
git commit -m "feat(card-economy-v2): claimWeeklyGiftIfDue + countCheckInDays"
```

---

## Task 6: Trigger the gift in `finishAttemptAction`

**Files:**
- Modify: `src/lib/actions/play.ts`
- Test: `tests/unit/finish-attempt-gift.test.ts` (new) — light integration

- [ ] **Step 1: Add `giftPack` to the return type + trigger.** In `src/lib/actions/play.ts`:
  1. Import `claimWeeklyGiftIfDue` from `./gacha` and `type GiftCard` from `@/lib/db/grants`.
  2. Extend the `finishAttemptAction` return type with `giftPack: { cards: GiftCard[] } | null`.
  3. Inside the existing `if (tick.ticked)` block, after the `awardDailyLoginIfDue` branch where `daily.awarded` is true, add:

```ts
let giftPack: { cards: GiftCard[] } | null = null;
// ... existing daily/milestone bonus pushes ...
if (daily.awarded) {
  // fresh check-in today → maybe the 5-of-7 weekly gift is now due
  giftPack = await claimWeeklyGiftIfDue(child.id);
}
```

  4. Initialize `let giftPack ... = null;` BEFORE the `if (tick.ticked)` block (so it's defined when not ticked), and include `giftPack` in the final return object.

> Place the `claimWeeklyGiftIfDue` call where `daily` is in scope (it's declared inside the `tick.ticked` block today). Hoist `giftPack` above the block; assign inside.

- [ ] **Step 2: Write a light test.** Create `tests/unit/finish-attempt-gift.test.ts` that mocks the heavy deps and asserts `finishAttemptAction`'s result includes `giftPack` (null when `claimWeeklyGiftIfDue` returns null; the cards object when it returns one). Follow the mocking shape already used in the existing `finishAttemptAction` tests (search `tests/unit` for a file that imports `finishAttemptAction`; mirror its mocks and add `vi.mock('./gacha' ...)` — actually mock `@/lib/actions/gacha`'s `claimWeeklyGiftIfDue`).

> If wiring a full `finishAttemptAction` test proves too broad, instead assert at the unit boundary: export nothing new, but verify via an existing finishAttempt test file that adding the field didn't break it, and rely on Task 5's tests for the gift logic. Keep this test minimal — one "giftPack present when due" assertion.

- [ ] **Step 3: Run tests + typecheck.**

Run: `pnpm vitest run tests/unit/finish-attempt-gift.test.ts && pnpm typecheck`
Expected: PASS + clean.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/actions/play.ts tests/unit/finish-attempt-gift.test.ts
git commit -m "feat(card-economy-v2): trigger weekly gift on fresh daily check-in"
```

---

## Task 7: `GiftPackReveal` component

**Files:**
- Create: `src/components/play/GiftPackReveal.tsx`
- Test: `tests/unit/gift-pack-reveal.test.tsx` (new)

- [ ] **Step 1: Write the failing test.**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GiftPackReveal } from '@/components/play/GiftPackReveal';

describe('GiftPackReveal', () => {
  const cards = [
    { itemId: 'i1', packSlug: 'zodiac', isDupe: false, shardsAfter: 0 },
    { itemId: 'i2', packSlug: 'flags', isDupe: true, shardsAfter: 3 },
  ];

  it('renders a banner and one tile per card', () => {
    render(<GiftPackReveal cards={cards} onClose={vi.fn()} />);
    expect(screen.getByText(/大礼包/)).toBeInTheDocument();
    expect(screen.getAllByTestId('gift-card-tile')).toHaveLength(2);
  });

  it('shows a shard note for dupes', () => {
    render(<GiftPackReveal cards={cards} onClose={vi.fn()} />);
    expect(screen.getByText(/\+1 .*碎片|shard/i)).toBeInTheDocument();
  });

  it('renders nothing for empty cards', () => {
    const { container } = render(<GiftPackReveal cards={[]} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `pnpm vitest run tests/unit/gift-pack-reveal.test.tsx`
Expected: FAIL (component missing).

- [ ] **Step 3: Implement.** Create `src/components/play/GiftPackReveal.tsx` (`'use client'`). Props: `{ cards: { itemId: string; packSlug: string; isDupe: boolean; shardsAfter: number }[]; onClose: () => void }`. Render `null` when `cards.length === 0`. A fixed-overlay modal with a "🎁 大礼包 / Weekly Gift" banner, a grid of tiles (`data-testid="gift-card-tile"`) each showing the pack emoji via `getPackMeta(packSlug).themeEmoji` and a "+1 🔹 碎片 / shard" note when `isDupe`, plus a "领取 / Collect" close button. Respect `useReducedMotion()` for any entrance animation (fall back to no animation). Keep it consistent with `LevelFanfare` styling.

> Do NOT pass server-only objects in; `packSlug` is a string and `getPackMeta` is called client-side (per the PackUiMeta landmine).

- [ ] **Step 4: Run test.**

Run: `pnpm vitest run tests/unit/gift-pack-reveal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/play/GiftPackReveal.tsx tests/unit/gift-pack-reveal.test.tsx
git commit -m "feat(card-economy-v2): GiftPackReveal component"
```

---

## Task 8: Mount `GiftPackReveal` in `SceneRunner`

**Files:**
- Modify: `src/components/scenes/SceneRunner.tsx`
- Test: `tests/unit/scene-runner-gift.test.tsx` (new)

- [ ] **Step 1: Write the failing test.** Mock `finishAttemptAction` to return a result with `giftPack: { cards: [...] }`, render `SceneRunner`, drive one scene to completion, assert a `gift-card-tile` appears. Mirror the existing `tests/unit/scene-runner-pr52-card-grant.test.tsx` setup (copy its mocks; add `giftPack` to the mocked `finishAttemptAction` return).

- [ ] **Step 2: Run it, verify it fails.**

Run: `pnpm vitest run tests/unit/scene-runner-gift.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `SceneRunner.tsx`:
  1. Add `const [giftCards, setGiftCards] = useState<GiftCardView[] | null>(null);` (define `GiftCardView` = `{ itemId: string; packSlug: string; isDupe: boolean; shardsAfter: number }`).
  2. In `advance`, after `const result = await finishAttemptAction({...})`, add: `if (result.giftPack) setGiftCards(result.giftPack.cards);`.
  3. Render `{giftCards ? <GiftPackReveal cards={giftCards} onClose={() => setGiftCards(null)} /> : null}` near the `BonusToast`/`LevelFanfare` layer. Lazy-load via `dynamic(() => import('@/components/play/GiftPackReveal').then(m => m.GiftPackReveal))` to match the `LevelFanfare` pattern.

- [ ] **Step 4: Run test.**

Run: `pnpm vitest run tests/unit/scene-runner-gift.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/scenes/SceneRunner.tsx tests/unit/scene-runner-gift.test.tsx
git commit -m "feat(card-economy-v2): surface GiftPackReveal from finishAttemptAction"
```

---

## Task 9: Change A — visible swap chip in `PackPageBody`

**Files:**
- Modify: `src/components/play/PackPageBody.tsx`
- Test: `tests/unit/pack-page-swap-chip.test.tsx` (new)

- [ ] **Step 1: Write the failing test.** Render `PackPageBody` with a registered pack slug (use one that has a registry entry, e.g. `zodiac`), one owned + one unowned item, and vary `shardCount`:
  - `shardCount = 3` → unowned card shows an enabled "换卡 / Trade" control (`data-testid="swap-chip"`, not `disabled`).
  - `shardCount = 1` → chip present but disabled, text includes `需 3`.
  - owned card → no `swap-chip`.
  - header hint `用 🔹 碎片换卡片` present when there is ≥1 unowned item.

> Mock `@/lib/actions/gacha` (`swapShardsForItem`), `next/navigation` (`useRouter`). Mirror any existing `PackPageBody` test if present (`grep -rl PackPageBody tests/unit`).

- [ ] **Step 2: Run it, verify it fails.**

Run: `pnpm vitest run tests/unit/pack-page-swap-chip.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `PackPageBody.tsx`:
  1. Add a header hint line under the `<header>` (only when `items.some(i => !ownedSet.has(i.id))`): `用 🔹 碎片换卡片 / Trade shards for any card`.
  2. Replace the whole-card `onClick`/`role`/`tabIndex` swap target on unowned cards with an explicit chip rendered inside each unowned card's wrapper:

```tsx
{!isOwned && (
  <button
    type="button"
    data-testid="swap-chip"
    disabled={shardCount < 3}
    onClick={() => setSwapItem(item)}
    className={`absolute inset-x-1 bottom-1 z-10 rounded-full px-2 py-0.5 text-[11px] font-bold ${
      shardCount >= 3
        ? 'bg-sky-500 text-white'
        : 'bg-stone-300 text-stone-600'
    }`}
  >
    {shardCount >= 3 ? '🔹换卡 / Trade' : '需 3🔹'}
  </button>
)}
```

  3. Remove the now-redundant `onClick={isOwned ? undefined : () => setSwapItem(item)}` (and the `role`/`tabIndex`/`onKeyDown`) from the card wrapper `div`; the chip is the single affordance. Keep the `relative` class on the wrapper so the absolute chip anchors correctly.
  4. `SwapDialog` + `swapShardsForItem` wiring stays unchanged.

- [ ] **Step 4: Run test.**

Run: `pnpm vitest run tests/unit/pack-page-swap-chip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/play/PackPageBody.tsx tests/unit/pack-page-swap-chip.test.tsx
git commit -m "feat(card-economy-v2): visible 换卡 trade chip on unowned cards"
```

---

## Task 10: Home `N/5` gift progress hint

**Files:**
- Modify: `src/components/play/WeekStrip.tsx`
- Modify: `src/app/play/[childId]/page.tsx`
- Test: `tests/unit/week-strip-gift-hint.test.tsx` (new)

- [ ] **Step 1: Write the failing test.** Render `WeekStrip` with the new prop `checkInDays` and assert:
  - `checkInDays = 3` → renders `本周签到 3/5` (and a 🎁).
  - `checkInDays = 5` → renders a "已达成 / 大礼包" style label (goal reached).

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekStrip } from '@/components/play/WeekStrip';

const week = Array.from({ length: 7 }, (_, i) => ({
  dateIso: `2026-06-0${i + 1}`, played: false, dailyLoginBonus: false, freezeBurned: false, coinsEarned: 0,
}));

describe('WeekStrip gift hint', () => {
  it('shows N/5 progress', () => {
    render(<WeekStrip activity={week} todayIso="2026-06-04" childId="c1" checkInDays={3} />);
    expect(screen.getByText(/3\/5/)).toBeInTheDocument();
  });
  it('shows reached state at 5', () => {
    render(<WeekStrip activity={week} todayIso="2026-06-04" childId="c1" checkInDays={5} />);
    expect(screen.getByText(/大礼包|已达成|5\/5/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `pnpm vitest run tests/unit/week-strip-gift-hint.test.tsx`
Expected: FAIL (prop unknown / text missing).

- [ ] **Step 3: Implement.**
  1. In `WeekStrip.tsx`, add optional prop `checkInDays?: number`. Below the 7 pills (still inside the `<Link>` or as a sibling row — keep it inside the card), render a small caption: when `checkInDays != null`, show `🎁 本周签到 {Math.min(checkInDays,5)}/5` when `< 5`, else `🎁 大礼包已达成 / Gift unlocked`. Use `data-testid="gift-progress"`.
  2. In `src/app/play/[childId]/page.tsx`, compute `const checkInDays = weekActivity.filter(d => d.dailyLoginBonus).length;` (or import `countCheckInDays` from `@/lib/db/checkins`) and pass `checkInDays={checkInDays}` to `<WeekStrip>`.

- [ ] **Step 4: Run test + typecheck.**

Run: `pnpm vitest run tests/unit/week-strip-gift-hint.test.tsx && pnpm typecheck`
Expected: PASS + clean.

- [ ] **Step 5: Commit.**

```bash
git add src/components/play/WeekStrip.tsx "src/app/play/[childId]/page.tsx" tests/unit/week-strip-gift-hint.test.tsx
git commit -m "feat(card-economy-v2): 本周签到 N/5 gift progress hint on home strip"
```

---

## Task 11: Docs + four-green gate + PR

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md.** Add a "Current state" PR entry summarizing card-economy-v2 (daily cap 10/day; visible swap chip; weekly 5-of-7 大礼包 one-per-pack). Add landmines:
  - *Daily cap replaced weekly cap.* `child_card_grants_weekly` is now **dead but kept** (append-only); `pullCardInTx` uses `child_card_grants_daily` + `DAILY_CARD_CAP=10`. Don't re-point code at the weekly table.
  - *Weekly gift bypasses the daily cap by design.* `grantGiftPackInTx` never touches `child_card_grants_daily`; idempotent per week via `cardGrantsLog(childId,'weekly_checkin',weekStartUtc)`. It grants **one card per active pack** (derived from active packs, not a constant).
  - *Gift trigger rides the daily-login signal.* `claimWeeklyGiftIfDue` is called from `finishAttemptAction` only when `awardDailyLoginIfDue` reports a fresh check-in; counts distinct check-in days via `getActivityForRange`. Threshold `WEEKLY_CHECKIN_THRESHOLD=5` (≥, not ==).
  Update the "last refreshed" date.

- [ ] **Step 2: Run the four-green gate.**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. Fix anything red before proceeding.

- [ ] **Step 3: Commit + push + PR.**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record card-economy-v2 + landmines"
git push -u origin feat/card-economy-v2
gh pr create --title "feat(card-economy-v2): daily cap + visible swap + weekly check-in 大礼包" --base main
```

PR body should cover: daily cap 10/day (migration `child_card_grants_daily`), visible 换卡 chip, weekly 5-of-7 大礼包 (one card per active pack, cap-bypassing), `GiftPackReveal`, home `N/5` hint. **Post-merge:** migration auto-applies via the build step (PR #53). No recompile. No seed.

---

## Self-review notes (addressed)

- **Spec coverage:** A→Task 9; B→Tasks 1–3; C→Tasks 4–8 + 10. Reveal→7–8. Home hint→10. Docs→11. ✓
- **Type consistency:** `cardsThisWeek`→`cardsToday` and `weekly_cap_reached`→`daily_cap_reached` renamed in Task 2 and propagated (Task 3 test, gacha-errors). `GiftCard` shape defined in Task 4, reused in Tasks 5/6/7/8. `claimWeeklyGiftIfDue` returns `{cards} | null` consistently. ✓
- **Cap bypass:** Task 4 implementation explicitly excludes any `childCardGrantsDaily` access. ✓
- **Append-only:** Task 1 Step 3 guards against editing prior migrations; weekly table kept. ✓
