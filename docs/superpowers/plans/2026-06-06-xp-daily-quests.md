# XP Foundation + Daily Quests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an additive XP currency + cosmetic player Level/title and 3 daily quests (with an all-3 coin chest) that fill from normal play — a daily "why open the app" hook, with zero changes to existing loops.

**Architecture:** New tables (`child_xp`, `xp_events`, `daily_quests`, `daily_quest_chests`). Pure `levelForXp`/`titleForLevel`. `awardXp` + quest DB helpers. Existing actions gain fire-and-forget XP/quest ticks after their primary writes. Island map gains a quest row + level badge; SceneRunner shows XP/level toasts.

**Tech Stack:** Next.js 16, Drizzle (append-only migration), React 19, Tailwind, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-06-xp-daily-quests-design.md`
**Branch:** `feat/xp-daily-quests` (spec committed).

---

## Verified integration points

- `finishAttemptAction` (`src/lib/actions/play.ts`) — schema has `weekLevelId`; it already calls `const levelRow = await getLevelById(parsed.weekLevelId)` (~:224) exposing `levelRow.sceneType`. Segment mapping: `sceneType==='flashcard'` → Review; `sceneType` in the practice set (audio_pick/visual_pick/image_pick/image_word/lianliankan/translate_pick/sentence_cloze/pinyin_pick/word_match) → Practice; `'boss'` → boss. It also computes `perfect` (score 100) and calls `awardStreakMilestoneIfDue(child.id, tick.currentStreak, ...)` inside the `tick.ticked` block.
- `finishLevelAction` — computes `bossCleared`, `cardGrants: RevealCard[]`, and a perfect-week branch.
- `claimWeeklyGiftIfDue` (`src/lib/actions/gacha.ts`) — returns `{ cards }` (the 大礼包).
- `purchaseShopItemInTx` (`src/lib/db/shop.ts:163`) returns `{ coinsSpent, ... }`; the shop action wraps it.
- `awardStreakMilestoneIfDue` (`src/lib/db/coins.ts:148`) — milestone site (returns `{awarded, milestone}`).
- Home page `src/app/play/[childId]/page.tsx` renders avatar header → coin → `MapHeaderPill` → `WeekStrip` → `LatestChapterPill` → voyage/island. Quest row goes after `WeekStrip`; level badge near the avatar header.
- `awardCoins` (`src/lib/db/coins.ts`) takes a `reason` from an enum — add `'daily_chest'` to the `coin_reason` enum (migration) since the chest awards coins.

---

## Task 1: Migration + schema

**Files:** Create `src/db/schema/xp.ts`, `src/db/schema/quests.ts`; Modify `src/db/schema/index.ts` (barrel) + `src/db/schema/coins.ts` (add `daily_chest` to coin_reason enum); generated `drizzle/00XX_*.sql`.

- [ ] **Step 1: Schema — XP.** Create `src/db/schema/xp.ts`:

```ts
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const childXp = pgTable('child_xp', {
  childId: uuid('child_id').primaryKey().references(() => childProfiles.id, { onDelete: 'cascade' }),
  totalXp: integer('total_xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const xpEvents = pgTable('xp_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  source: text('source').notNull(),
  refId: text('ref_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Schema — quests.** Create `src/db/schema/quests.ts`:

```ts
import { boolean, integer, pgTable, primaryKey, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const dailyQuests = pgTable('daily_quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),       // UTC YYYY-MM-DD
  questId: text('quest_id').notNull(),
  progress: integer('progress').notNull().default(0),
  target: integer('target').notNull(),
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('daily_quests_child_date_quest_uq').on(t.childId, t.date, t.questId)]);

export const dailyQuestChests = pgTable('daily_quest_chests', {
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  coins: integer('coins').notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.childId, t.date] })]);
```

- [ ] **Step 3: Barrel + enum.** Export both from `src/db/schema/index.ts` (follow the existing re-export pattern). In `src/db/schema/coins.ts`, add `'daily_chest'` to the `coinReason` pgEnum values array (append — additive).

- [ ] **Step 4: Generate the migration.** `pnpm drizzle-kit generate`. Expected: a new `drizzle/00XX_*.sql` creating the 4 tables + `ALTER TYPE coin_reason ADD VALUE 'daily_chest'`. Run `git diff --stat drizzle/` — confirm only new files + journal (no edits to prior migrations). `pnpm typecheck` → clean.

- [ ] **Step 5: Commit.**

```bash
git add src/db/schema drizzle/
git commit -m "feat(xp-quests): schema — child_xp, xp_events, daily_quests, daily_quest_chests + daily_chest coin reason"
```

---

## Task 2: Pure level curve + titles

**Files:** Create `src/lib/xp/levels.ts`; Test `tests/unit/xp-levels.test.ts`.

- [ ] **Step 1: Failing test.**

```ts
import { describe, expect, it } from 'vitest';
import { levelForXp, titleForLevel, xpForLevel } from '@/lib/xp/levels';

describe('xp levels', () => {
  it('xpForLevel follows the curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(50);
    expect(xpForLevel(3)).toBe(150);
    expect(xpForLevel(4)).toBe(300);
    expect(xpForLevel(5)).toBe(500);
  });
  it('levelForXp inverts the curve (highest level whose threshold ≤ xp)', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(49)).toBe(1);
    expect(levelForXp(50)).toBe(2);
    expect(levelForXp(149)).toBe(2);
    expect(levelForXp(300)).toBe(4);
    expect(levelForXp(10_000)).toBeGreaterThanOrEqual(15);
  });
  it('titleForLevel maps bands bilingually', () => {
    expect(titleForLevel(1).zh).toBe('见习水手');
    expect(titleForLevel(6).en).toBe('First Mate');
    expect(titleForLevel(20).zh).toBe('海洋大师');
  });
});
```

- [ ] **Step 2: Run red.** `pnpm vitest run tests/unit/xp-levels.test.ts` → FAIL.

- [ ] **Step 3: Implement.** `src/lib/xp/levels.ts`:

```ts
/** Cumulative XP needed to REACH level L. cumXp(L) = 50(L-1) + 25(L-1)(L-2). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, level);
  return 50 * (n - 1) + 25 * (n - 1) * (n - 2);
}

/** Highest level whose threshold is ≤ totalXp (level ≥ 1). */
export function levelForLevelXp(_: never): never { throw new Error('unused'); }
export function levelForXp(totalXp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

export interface LevelTitle { zh: string; en: string; }
export function titleForLevel(level: number): LevelTitle {
  if (level <= 2) return { zh: '见习水手', en: 'Cabin Boy' };
  if (level <= 4) return { zh: '水手', en: 'Sailor' };
  if (level <= 7) return { zh: '副船长', en: 'First Mate' };
  if (level <= 11) return { zh: '船长', en: 'Captain' };
  if (level <= 15) return { zh: '航海家', en: 'Navigator' };
  return { zh: '海洋大师', en: 'Sea Master' };
}
```
(Remove the stray `levelForLevelXp` placeholder — it's not needed; do NOT include it.)

- [ ] **Step 4: Run green + commit.** `pnpm vitest run tests/unit/xp-levels.test.ts` → PASS. `pnpm typecheck` → clean.

```bash
git add src/lib/xp/levels.ts tests/unit/xp-levels.test.ts
git commit -m "feat(xp-quests): pure level curve + bilingual titles"
```

---

## Task 3: `awardXp`

**Files:** Create `src/lib/db/xp.ts`; Test `tests/unit/award-xp.test.ts`.

- [ ] **Step 1: Failing test.** Mock `@/db` with a fake that records the insert + upsert and returns the updated row. Assert `awardXp` returns `{ totalXp, level, leveledUp }` and that crossing a threshold sets `leveledUp:true`. Model it on the existing `tests/unit/streaks*.test.ts` / `coins` db-mock style (chainable `insert().values()`, `select().from().where()`, `update().set().where()` / `onConflictDoUpdate`).

```ts
import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ insertEvent: vi.fn(), upsert: vi.fn() }));
vi.mock('@/db', () => ({ db: {
  insert: vi.fn(() => ({ values: mocks.insertEvent.mockReturnValue(Promise.resolve()) })),
  // upsert child_xp returning the new total
  // (shape this to match the implementation you write)
} }));
import { awardXp } from '@/lib/db/xp';
// ... assert returns shape + leveledUp boundary. Adjust the @/db mock to the exact
// call chain your implementation uses; keep the behavioral asserts.
```

> The exact `@/db` mock must mirror your `awardXp` call chain. Keep the asserts behavioral: an event row is inserted; `child_xp` total increments; `level = levelForXp(newTotal)`; `leveledUp = newLevel > oldLevel`.

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.** `src/lib/db/xp.ts` (NEVER imported in client bundles):

```ts
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childXp, xpEvents } from '@/db/schema';
import { levelForXp } from '@/lib/xp/levels';

export type XpSource =
  | 'scene_complete' | 'scene_perfect' | 'boss_clear'
  | 'daily_quest' | 'daily_chest' | 'streak_milestone';

export interface AwardXpResult { totalXp: number; level: number; leveledUp: boolean; }

export async function awardXp(
  childId: string, amount: number, source: XpSource, refId?: string,
): Promise<AwardXpResult> {
  if (amount <= 0) {
    const [row] = await db.select().from(childXp).where(eq(childXp.childId, childId));
    const totalXp = row?.totalXp ?? 0;
    return { totalXp, level: levelForXp(totalXp), leveledUp: false };
  }
  await db.insert(xpEvents).values({ childId, amount, source, refId: refId ?? null });
  const [before] = await db.select({ level: childXp.level }).from(childXp).where(eq(childXp.childId, childId));
  const oldLevel = before?.level ?? 1;
  const [after] = await db
    .insert(childXp)
    .values({ childId, totalXp: amount, level: levelForXp(amount), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: childXp.childId,
      set: { totalXp: sql`${childXp.totalXp} + ${amount}`, updatedAt: new Date() },
    })
    .returning({ totalXp: childXp.totalXp });
  const totalXp = after?.totalXp ?? amount;
  const level = levelForXp(totalXp);
  if (level !== oldLevel) {
    await db.update(childXp).set({ level }).where(eq(childXp.childId, childId));
  }
  return { totalXp, level, leveledUp: level > oldLevel };
}

export async function getChildXp(childId: string): Promise<{ totalXp: number; level: number }> {
  const [row] = await db.select({ totalXp: childXp.totalXp, level: childXp.level }).from(childXp).where(eq(childXp.childId, childId));
  return { totalXp: row?.totalXp ?? 0, level: row?.level ?? 1 };
}
```

- [ ] **Step 4: Run green + commit.**

```bash
git add src/lib/db/xp.ts tests/unit/award-xp.test.ts
git commit -m "feat(xp-quests): awardXp ledger + level recompute"
```

---

## Task 4: Quest definitions (pure)

**Files:** Create `src/lib/quests/definitions.ts`; Test `tests/unit/quest-definitions.test.ts`.

- [ ] **Step 1: Failing test.** Assert 8 templates, each with `key/labelZh/labelEn/emoji/target/xp/feasible`; `boss_clear.feasible({ bossUnlocked:false })===false`; `complete_scenes.feasible(anything)===true`; keys unique.

- [ ] **Step 2/3: Implement.** `src/lib/quests/definitions.ts` (pure, client-safe):

```ts
export interface QuestContext { bossUnlocked: boolean; }
export interface QuestDef {
  key: string; labelZh: string; labelEn: string; emoji: string;
  target: number; xp: number; feasible: (ctx: QuestContext) => boolean;
}
const always = () => true;
export const QUEST_DEFS: QuestDef[] = [
  { key: 'complete_scenes',  labelZh: '小小探险家', labelEn: 'Explorer',   emoji: '🧭', target: 3, xp: 20, feasible: always },
  { key: 'perfect_scores',   labelZh: '完美之星',   labelEn: 'Perfectionist', emoji: '⭐', target: 2, xp: 20, feasible: always },
  { key: 'spend_coins',      labelZh: '购物达人',   labelEn: 'Shopper',    emoji: '🛒', target: 50, xp: 20, feasible: always },
  { key: 'earn_card',        labelZh: '收藏家',     labelEn: 'Collector',  emoji: '🎴', target: 1, xp: 20, feasible: always },
  { key: 'boss_clear',       labelZh: 'Boss 猎人',  labelEn: 'Boss Hunter', emoji: '🐙', target: 1, xp: 20, feasible: (c) => c.bossUnlocked },
  { key: 'practice_scenes',  labelZh: '练习生',     labelEn: 'Trainee',    emoji: '✍️', target: 2, xp: 20, feasible: always },
  { key: 'review_flashcards',labelZh: '复习时间',   labelEn: 'Reviewer',   emoji: '🔁', target: 3, xp: 15, feasible: always },
  { key: 'full_level',       labelZh: '大冒险家',   labelEn: 'Adventurer', emoji: '🏝️', target: 1, xp: 30, feasible: always },
];
export const QUEST_BY_KEY = new Map(QUEST_DEFS.map((q) => [q.key, q]));
export function getQuestDef(key: string): QuestDef | undefined { return QUEST_BY_KEY.get(key); }
```

- [ ] **Step 4: Run green + commit** (`feat(xp-quests): 8 daily-quest definitions`).

---

## Task 5: `generateDailyQuests` + `getTodayQuests`

**Files:** Create `src/lib/db/quests.ts`; Test `tests/unit/generate-daily-quests.test.ts`.

- [ ] **Step 1: Failing test.** Mock `@/db`. Assert: when no rows exist for today, it inserts 3 distinct feasible quests excluding yesterday's keys; when rows exist, it inserts nothing (idempotent); `getTodayQuests` returns today's rows joined with their defs.

- [ ] **Step 2/3: Implement.** `src/lib/db/quests.ts`:
  - `todayUtc()` / `yesterdayUtc()` (reuse `todayUtcIso` from `@/lib/db/streaks` for today; derive yesterday).
  - `generateDailyQuests(childId, ctx: QuestContext)`: `SELECT` today's rows; if ≥1 → return them (already generated). Else `SELECT` yesterday's quest keys; pick 3 from `QUEST_DEFS.filter(feasible).filter(not in yesterday)` via a shuffle; `INSERT ... onConflictDoNothing` (UNIQUE guard makes concurrent mounts safe); return the rows.
  - `getTodayQuests(childId)`: `SELECT` today's `daily_quests` rows; map each with `getQuestDef(quest_id)` for labels/emoji/xp.
  - Build the `QuestContext` (bossUnlocked) from the child's current playable week — a small read; if unavailable, default `bossUnlocked:false` (worst case a feasible quest is skipped).

- [ ] **Step 4: Run green + commit** (`feat(xp-quests): generateDailyQuests + getTodayQuests`).

---

## Task 6: `tickQuestProgress`

**Files:** Modify `src/lib/db/quests.ts`; Test `tests/unit/tick-quest-progress.test.ts`.

- [ ] **Step 1: Failing test.** Mock `@/db` + `awardXp`. Assert: increments progress for a held, incomplete quest; caps at target; on reaching target sets `completed=true` and calls `awardXp(childId, def.xp, 'daily_quest', rowId)` exactly once; no-op (no update, no awardXp) when the child doesn't hold that quest today or it's already completed.

- [ ] **Step 2/3: Implement.** `tickQuestProgress(childId, questKey, amount)`:
  - `SELECT` today's row for `(childId, today, questKey)` where `completed=false`. If none → return `{ ticked:false }`.
  - Compute `newProgress = min(progress+amount, target)`, `done = newProgress >= target`. `UPDATE` set progress + (if done) completed=true.
  - If `done` → `await awardXp(childId, def.xp, 'daily_quest', row.id)`.
  - Return `{ ticked:true, completed: done, def }` (for an optional toast). Errors must be swallowable by callers (callers wrap fire-and-forget).

- [ ] **Step 4: Run green + commit** (`feat(xp-quests): tickQuestProgress + auto quest-XP`).

---

## Task 7: `claimDailyChest` action

**Files:** Create `src/lib/actions/quests.ts`; Test `tests/unit/claim-daily-chest.test.ts`.

- [ ] **Step 1: Failing test.** Mock `@/db`, `requireChild`, `awardCoins`, `awardXp`, `next/cache`. Assert: rejects/returns null when fewer than 3 today's quests are completed; on success inserts `daily_quest_chests` (random coins 50–100), awards coins (`reason:'daily_chest'`) + `awardXp(30,'daily_chest')`, returns `{ coins }`; idempotent — a second call returns the already-claimed result without double-awarding (PK collision).

- [ ] **Step 2/3: Implement.** `src/lib/actions/quests.ts` (`'use server'`, async exports only):
  - `claimDailyChest(childId)`: `requireChild`; `SELECT` today's quests; if completed count < 3 → return `{ ok:false, reason:'not_ready' }`. Compute `coins = 50 + Math.floor(Math.random()*51)`. `INSERT daily_quest_chests (childId, today, coins) onConflictDoNothing returning`; if no row returned (already claimed) → return the existing `{ ok:true, coins:existing.coins, alreadyClaimed:true }`. On fresh insert → `awardCoins({childId, delta:coins, reason:'daily_chest', ...})` + `awardXp(childId, 30, 'daily_chest')`; `revalidatePath('/play/${childId}')`; return `{ ok:true, coins }`.
  - Also export `generateAndGetTodayQuestsAction(childId)` (or a thin action) the page can call to ensure-generate + fetch (or do generation server-side in the page — see Task 10).

- [ ] **Step 4: Run green + commit** (`feat(xp-quests): claimDailyChest action`).

---

## Task 8: Integration ticks in `play.ts`

**Files:** Modify `src/lib/actions/play.ts`; Test `tests/unit/play-xp-quest-ticks.test.ts` (+ keep existing `finish-*` tests green).

- [ ] **Step 1: Update/extend tests.** In a new test (or extend `finish-level-boss` / `finish-attempt-gift`), mock `awardXp` + `tickQuestProgress` and assert they're called with the right args on a scene clear / perfect / boss / full-level. Existing tests: add the new mocks so they don't blow up (the new calls are fire-and-forget; mock them to resolve).

- [ ] **Step 2/3: Implement (fire-and-forget, after primary writes).** In `finishAttemptAction`, after the existing coin/bonus/trophy work, add a helper `void tickPlayQuests(...)` OR inline `await`s wrapped so failure can't break the response (use a `try/catch` around a `Promise.allSettled`):
  - Always: `awardXp(child.id, 10, 'scene_complete', attempt.id)` + `tickQuestProgress(child.id, 'complete_scenes', 1)`.
  - `levelRow.sceneType === 'flashcard'` → `tickQuestProgress('review_flashcards', 1)`; else if it's a practice scene type (not flashcard/boss) → `tickQuestProgress('practice_scenes', 1)`.
  - `perfect` → `awardXp(child.id, 5, 'scene_perfect', attempt.id)` + `tickQuestProgress('perfect_scores', 1)`.
  - In the existing `awardStreakMilestoneIfDue` success branch → `awardXp(child.id, 100, 'streak_milestone', ...)`.
  - Return the XP outcome so SceneRunner can toast: extend the return with `xp?: { gained: number; level: number; leveledUp: boolean }` (sum the awards; leveledUp from the last awardXp). Keep existing fields.

  In `finishLevelAction`: on `bossCleared` → `awardXp(child.id, 50, 'boss_clear', sessionId)` + `tickQuestProgress('boss_clear', 1)`; on a full-level completion → `tickQuestProgress('full_level', 1)`; on the `cardGrants` (boss + perfect) → `tickQuestProgress('earn_card', cardGrants.length)`. Add the same `xp` field to the return.

  **All these go through a guarded helper** so a quest/XP failure logs and continues (mirror the `safePullRevealCard` pattern from card-reveal-polish — wrap in try/catch, never throw into the action).

- [ ] **Step 4: Run green + commit** (`feat(xp-quests): XP + quest ticks in finishAttempt/finishLevel`). Verify `pnpm typecheck` + the existing finish-* tests pass (update their mocks).

---

## Task 9: Integration ticks — shop + weekly gift

**Files:** Modify `src/lib/actions/shop.ts` (spend_coins), `src/lib/actions/gacha.ts` (`claimWeeklyGiftIfDue` earn_card); Tests: extend the relevant ones.

- [ ] **Step 1: Tests.** Assert the shop purchase action ticks `spend_coins` by `coinsSpent`; `claimWeeklyGiftIfDue` ticks `earn_card` by `cards.length`. Mock `tickQuestProgress`.

- [ ] **Step 2/3: Implement (guarded, fire-and-forget).** In the shop purchase action (the one wrapping `purchaseShopItemInTx`), after success: `void safeTick(child.id, 'spend_coins', result.coinsSpent)`. In `claimWeeklyGiftIfDue`, after a successful grant: `void safeTick(childId, 'earn_card', result.cards.length)`. Use a shared guarded `safeTick` (try/catch) — define once in `src/lib/db/quests.ts` as `tickQuestProgressSafe` or wrap at call sites.

- [ ] **Step 4: Run green + commit** (`feat(xp-quests): spend_coins + earn_card quest ticks`).

---

## Task 10: UI — LevelBadge + DailyQuestCard + DailyQuestRow

**Files:** Create `src/components/play/LevelBadge.tsx`, `DailyQuestCard.tsx`, `DailyQuestRow.tsx`; Tests for each.

- [ ] **Step 1: Failing tests.**
  - `LevelBadge` (`{ level, title }` props): renders `Lv N` + `title.zh`.
  - `DailyQuestCard` (`{ emoji, labelZh, progress, target, completed }`): renders emoji + label + `progress/target`; shows ✓ when completed; "in-progress" style otherwise.
  - `DailyQuestRow` (`{ quests: {...}[], allDone, chestClaimed, onClaimChest }`): renders 3 cards; when `allDone && !chestClaimed` shows a claimable chest button calling `onClaimChest`; when `chestClaimed` shows "🎁 明日再来".

- [ ] **Step 2/3: Implement.** Plain client components (Tailwind), following the existing `WeekStrip`/`BonusToast` visual register. `DailyQuestCard` = emoji + short 中文 label + a progress bar (`width: ${Math.min(progress/target,1)*100}%`) + ✓/state. `DailyQuestRow` = `flex` of 3 cards + a chest affordance. `LevelBadge` = a small pill `⚓ Lv {level} · {title.zh}`.

- [ ] **Step 4: Run green + commit** (`feat(xp-quests): LevelBadge + DailyQuest row/card components`).

---

## Task 11: XP toasts in SceneRunner

**Files:** Create `src/components/play/XpGainToast.tsx`; Modify `src/components/scenes/SceneRunner.tsx`; Test.

- [ ] **Step 1: Failing test.** `XpGainToast` ({ gained, leveledUp, level }) renders `+{gained} XP` and, when `leveledUp`, a `升级！Lv {level}` line; calls `onDone`. SceneRunner: when `finishAttemptAction`/`finishLevelAction` return `xp`, the toast shows.

- [ ] **Step 2/3: Implement.** `XpGainToast` mirrors `BonusToast` (auto-dismiss timer, reduced-motion safe). In `SceneRunner`, capture `result.xp` / `levelResult.xp` into state and render `<XpGainToast>` alongside `<BonusToast>`/`<TrophyToast>`.

- [ ] **Step 4: Run green + commit** (`feat(xp-quests): XP gain + level-up toast in SceneRunner`).

---

## Task 12: Home page wiring (generate + mount)

**Files:** Modify `src/app/play/[childId]/page.tsx`; Test (thin) `tests/unit/play-page-quests.test.tsx` or rely on typecheck + component tests.

- [ ] **Step 1: Implement.** In the home page server component:
  - Compute `ctx.bossUnlocked` (from the current week's boss-unlock state already available, or a small read).
  - `const quests = await generateDailyQuests(child.id, ctx);` then `const today = await getTodayQuests(child.id);` (or have `generateDailyQuests` return the rows). Compute `allDone`, `chestClaimed` (query `daily_quest_chests` for today).
  - `const { level } = await getChildXp(child.id); const title = titleForLevel(level);`
  - Render `<LevelBadge level={level} title={title} />` in the avatar header area, and `<DailyQuestRow ... />` after `<WeekStrip>` / before the voyage board. Pass a client `onClaimChest` via a small `'use client'` wrapper that calls `claimDailyChest` (server action) and shows the coin chest reveal (reuse a simple chest celebration — coins variant).
  - **Generation idempotency:** safe to call `generateDailyQuests` on every render (it no-ops when today's rows exist).

- [ ] **Step 2: Verify.** `pnpm typecheck && pnpm lint && pnpm build` → green; existing home/`IslandMap`/`VoyageBoard` tests still pass.

- [ ] **Step 3: Commit** (`feat(xp-quests): mount daily quests + level badge on island map`).

---

## Task 13: Docs + four-green gate + PR

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: CLAUDE.md.** "Current state" entry (XP + Daily Quests: additive XP currency + cosmetic Level/title, 3 daily quests filled from play, all-3 coin chest; Season Pass deferred). Landmines:
  - *XP/quest ticks are additive + fire-and-forget* — wired into `finishAttempt/finishLevel/shop/gift/streak` after primary writes, guarded so a failure never breaks the action (mirrors `safePullRevealCard`). XP is a SEPARATE currency from coins (no conversion).
  - *Daily quests generate on home-page render* (`generateDailyQuests` is idempotent per `(childId, UTC date)` via a UNIQUE index). `earn_card` replaced the obsolete coin-gacha quest. `daily_quest_chests` PK gives once-per-day chest idempotency.
  - *Player level is cosmetic only* in this PR (no functional unlocks); `levelForXp` curve in `src/lib/xp/levels.ts` is tunable. Season Pass (tiers/rewards/season_xp) is a separate later PR (draft at `docs/superpowers/specs/2026-05-25-...`).
  Update the "last refreshed" date.

- [ ] **Step 2: Four-green gate.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → green.

- [ ] **Step 3: Commit, push, PR.**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record XP + Daily Quests + landmines"
git push -u origin feat/xp-daily-quests
gh pr create --title "feat(xp-quests): XP foundation + daily quests (retention Phase 1)" --base main
```

PR body: additive XP currency + cosmetic Level/title + 3 daily quests (fill from play) + all-3 coin chest; ticks wired fire-and-forget into existing actions; migration 00XX (4 tables + daily_chest reason); Season Pass deferred. Post-merge: migration auto-applies on Vercel build.

---

## Self-review notes (addressed)

- **Spec coverage:** schema → T1; levels → T2; awardXp → T3; quest defs → T4; generate/getToday → T5; tick → T6; chest → T7; play ticks → T8; shop/gift ticks → T9; UI → T10–12; docs → T13. ✓
- **Type consistency:** `levelForXp`/`titleForLevel` (T2) used by `awardXp` (T3) + UI (T10/12); `QuestDef`/`getQuestDef` (T4) used in T5/T6; `tickQuestProgress` (T6) used in T8/T9; `claimDailyChest` (T7) used in T12. Removed the stray `levelForLevelXp` placeholder in T2. ✓
- **Additive / no-regression:** all ticks are after primary writes, guarded; existing tests get the new fns mocked (their primary assertions unchanged). ✓
- **Append-only migration:** T1 generates one new migration (4 tables + enum value); guarded by the `git diff` check. ✓
- **`'use server'`:** `actions/quests.ts` exports only async fns; pure logic in `lib/xp` + `lib/quests/definitions` + `lib/db/*`. ✓
