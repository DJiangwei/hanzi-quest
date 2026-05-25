# PR #37 — Consumable powerups (Hint / Skip / Streak-Freeze)

**Date:** 2026-05-25
**Author:** Claude + David (brainstorm)
**Status:** Spec — pending implementation plan

---

## 1. Goal

Add 3 consumable powerups + an in-scene tray UI + a streak-freeze auto-burn hook + the final Shop tab. Completes the original PR #21 roadmap by making the Shop **5 of 5 tabs live** (Avatar / Sounds / Pet / Decor / Powerup).

After this PR ships:
- A persistent bottom-right floating tray shows 💡 Hint + ⏭️ Skip with count badges on every scene.
- Yinuo gets a one-time starter pack on first play (1 hint + 1 skip) so she discovers the tray immediately.
- Powerup tab in Shop lists 3 cards: Hint (30c), Skip (100c), Streak-Freeze (200c). Single-purchase = 1 count; stackable.
- **Hint** grays out one wrong MC choice without penalty. Correct pick → full coin reward.
- **Skip** advances past the current scene without scoring (doesn't count toward boss-unlock).
- **Streak-Freeze** silently auto-burns when she misses a day; preserves her current streak; shows a `BonusToast` "🧊 Streak saved!" on her next session.

## 2. Locked decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Tray location | **Bottom-right floating tray**, always visible. Hint hidden on flashcard + word_match (no MC choices to gray out). Tap → confirm dialog → use. |
| Hint mechanic | **Gray out 1 random wrong choice.** Correct pick still earns full coins (no penalty). |
| Skip mechanic | **Advance without scoring.** Scene_attempts row with `score=0`. Doesn't count toward boss-unlock (which counts `score >= 100`). Scene can be replayed later. |
| Streak-Freeze mechanic | **Auto-burn in `tickStreak`** when gap > 1 day AND freeze count > 0. Preserves `currentStreak`, decrements freeze. Emits a BonusToast on next play. **One-day-gap only** for V1. |
| Pricing | Hint **30c**, Skip **100c**, Streak-Freeze **200c**. Single purchase = 1 count. |
| Starter pack | **1 hint + 1 skip** auto-granted when `powerup_inventory` for the child is empty. Idempotent. Triggered at section-runner page mount. |
| Inventory schema | Reuse existing `powerup_inventory(childId, kind, count)` table — no new tables. Add `'skip'` value to `powerupKind` enum (migration 0013). |
| Shop tab | Flip the `'powerup'` tab `disabled: false` in `ShopCategoryTabs`. New `PowerupsTabBody.tsx` mirrors `DecorTabBody` pattern. |
| Trophies | **None for V1.** Existing trophies cover broader milestones. Can add powerup-specific ones later. |

## 3. Architecture

### 3.1 Data model

**Migration 0013** — single enum ADD VALUE:

```sql
ALTER TYPE "public"."powerup_kind" ADD VALUE 'skip';
```

`powerupInventory` schema unchanged. New enum value flows from `src/db/schema/avatar.ts`:

```ts
export const powerupKind = pgEnum('powerup_kind', [
  'revive',          // unused, never seeded; ignore
  'hint',
  'streak_freeze',
  'skip',            // NEW
]);
```

### 3.2 Shop purchase wiring

`purchaseShopItemInTx` (PR #34's switch dispatch) gains a new branch:

```ts
case 'powerup':
  return purchasePowerupInTx(tx, childId, shopItem);
```

`purchasePowerupInTx` (new):
- Reads `shopItem.metadata.powerupKind` (one of `'hint' | 'skip' | 'streak_freeze'`); throws `ItemNotPurchasableError` if missing/invalid.
- Skips the avatar inventory side-effect entirely.
- **No AlreadyOwnedError check** — powerups are stackable.
- Calls `debitAndRecordInTx` (existing PR #34 helper) to debit coins + insert `shop_purchases`.
- UPSERTs `powerup_inventory`:
  ```sql
  INSERT INTO powerup_inventory (child_id, kind, count) VALUES ($1, $2, 1)
  ON CONFLICT (child_id, kind) DO UPDATE SET count = powerup_inventory.count + 1
  ```
- Returns `{ shopItemId, coinsAfter, avatarItemId: null }` (PurchaseResult shape unchanged).

### 3.3 Powerup actions

New `src/lib/db/powerups.ts`:

```ts
export type PowerupKind = 'hint' | 'skip' | 'streak_freeze';

export interface PowerupCounts {
  hint: number;
  skip: number;
  streak_freeze: number;
}

export async function getPowerupCounts(childId: string): Promise<PowerupCounts>;

/** Atomic decrement. Returns true if decremented, false if count was 0. */
export async function consumePowerupAtomic(
  childId: string,
  kind: PowerupKind,
): Promise<boolean>;

/** UPSERT increment by 1. */
export async function grantPowerup(
  tx: Tx,
  childId: string,
  kind: PowerupKind,
): Promise<void>;

/** If powerup_inventory is empty for this child, grant 1 hint + 1 skip. Idempotent.
 *  Returns true if the starter pack was granted (so UI can toast). */
export async function grantStarterPowerupsIfNeeded(
  childId: string,
): Promise<boolean>;
```

`consumePowerupAtomic` uses:
```sql
UPDATE powerup_inventory SET count = count - 1
  WHERE child_id = $1 AND kind = $2 AND count > 0
  RETURNING count
```
Returns `true` if the UPDATE affected 1 row.

New `src/lib/actions/powerups.ts` (`'use server'`):

```ts
export async function useHintAction(
  childId: string,
): Promise<{ ok: boolean; remaining: number }>;

export async function useSkipAction(
  childId: string,
  weekLevelId: string,
  sessionId: string,
): Promise<{ ok: boolean; remaining: number }>;
```

- `useHintAction`: calls `consumePowerupAtomic(childId, 'hint')`. Returns `{ ok, remaining }`.
- `useSkipAction`: in a transaction — calls `consumePowerupAtomic(childId, 'skip')`, then inserts a `scene_attempts` row with `score=0, correctCount=0, totalCount=1, completedAt=NOW`. Returns `{ ok, remaining }`. If decrement fails, the transaction rolls back the (non-existent) attempt insert.

Auth: both actions call `requireChild(childId)` to verify ownership.

### 3.4 Streak-freeze auto-burn

`src/lib/db/streaks.ts` — extend `tickStreak`:

Today's logic (simplified):
```ts
if (gap === 0) noop;
else if (gap === 1) currentStreak += 1;
else currentStreak = 1;   // reset
```

After change:
```ts
if (gap === 0) noop;
else if (gap === 1) currentStreak += 1;
else if (gap > 1) {
  const consumed = await consumePowerupAtomic(tx, childId, 'streak_freeze');
  if (consumed) {
    // streak survives — treat as a 1-day gap (today extends streak by +1)
    currentStreak += 1;
    bonuses.push({ kind: 'streak_freeze', label: '🧊 Streak saved! / 连胜保住了!' });
  } else {
    currentStreak = 1;   // normal reset
  }
}
```

Where `bonuses` is the existing `EconomyBonus[]` returned by `tickStreak` and piped into `BonusToast` (per PR #28).

**Existing field `streaks.freezeTokens`**: unused legacy field. Don't delete; ignore. Powerup_inventory is the source of truth.

### 3.5 In-scene UI

**`src/components/play/PowerupTray.tsx`** (new client component):

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useHintAction, useSkipAction } from '@/lib/actions/powerups';

interface Props {
  childId: string;
  hintCount: number;
  skipCount: number;
  sceneSupportsHint: boolean;      // false for flashcard / word_match
  weekLevelId: string;
  sessionId: string;
  onHintActivated: () => void;
  onSkipped: () => void;
}

export function PowerupTray({...}: Props) {
  // - bottom-right fixed; 2 round buttons; count badges; confirm modal
  // - 0-count → grayed; tap → toast "去商店买道具 / Get more in Shop" + Link
  // - tap → setShowConfirm(kind) → confirm dialog → call action
  // - on success: locally decrement count (optimistic) + onHintActivated/onSkipped
}
```

**`MultipleChoiceQuiz` extension**: add `hintRequested?: boolean` prop. When `true`:
- Pick one random `isCorrect: false` choice
- Set it `disabled + opacity-30`
- Add a faint "✕" overlay

The selected wrong choice is memoized so it doesn't re-randomize across re-renders within the same level.

**`SceneRunner` integration**:
- Receives `initialPowerupCounts: PowerupCounts` as a new prop (server-fetched at section page mount).
- Holds local state for current `hintCount`, `skipCount`, `hintRequested` (resets on level advance).
- Mounts `<PowerupTray>` as a sibling of the active scene.
- Tracks `sceneSupportsHint` per level: `level.sceneType !== 'flashcard' && level.sceneType !== 'word_match'`.
- Skip flow: calls `useSkipAction(...)` → on success, advances index by 1 without going through the normal `advance(correct)` path (no coin reward, no trophy check).

### 3.6 Starter pack trigger

Called at section page mount, before SceneRunner renders:

```ts
// src/app/play/[childId]/level/[weekId]/[section]/page.tsx
import { grantStarterPowerupsIfNeeded } from '@/lib/db/powerups';
// ...
await requireChild(childId);
const grantedStarter = await grantStarterPowerupsIfNeeded(child.id);
const initialCounts = await getPowerupCounts(child.id);
// pass initialCounts + grantedStarter to SceneRunner
```

If `grantedStarter === true`, SceneRunner shows a one-shot toast: "🎁 礼物!/ Starter pack! 💡 + ⏭️ in your tray". Toast auto-dismisses; not persisted.

### 3.7 Shop tab

- `src/components/shop/ShopCategoryTabs.tsx` — change `powerup` tab `disabled: true` → `false`.
- `src/components/shop/PowerupsTabBody.tsx` (new, parallel to `DecorTabBody`):
  - Lists 3 cards: 💡 Hint, ⏭️ Skip, 🧊 Streak-Freeze.
  - Each card: emoji + bilingual name + bilingual description + "拥有: N / Own: N" count chip + "购买 / Buy 🪙 X" button.
  - Click → `purchaseShopItemAction(shopItemId)` → optimistic `count += 1` + `router.refresh()`.
- `ShopBody.tsx` routes `activeTab === 'powerup'` → `<PowerupsTabBody>`.
- Shop page extends Promise.all to fetch `listPowerupShopListings()` + `getPowerupCounts(childId)`.

### 3.8 Shop catalog

3 `shop_items` rows seeded by `scripts/seed-powerups.ts`:

| slug | kind | name | description | priceCoins | metadata |
|---|---|---|---|---|---|
| `pw-hint` | powerup | 💡 提示 / Hint | 在多选题中划掉一个错答案 / Cross out one wrong answer in multiple-choice scenes | 30 | `{powerupKind: 'hint'}` |
| `pw-skip` | powerup | ⏭️ 跳过 / Skip | 跳过当前关卡（不计分）/ Skip the current scene (no score) | 100 | `{powerupKind: 'skip'}` |
| `pw-freeze` | powerup | 🧊 连胜冰冻 / Streak Freeze | 缺一天时自动保住连胜 / Auto-saves your streak when you miss one day | 200 | `{powerupKind: 'streak_freeze'}` |

## 4. Tests

(Vitest + RTL, mocking `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`.)

1. **`tests/unit/purchase-powerup.test.ts`** — buying `kind='powerup'` increments inventory; stackable (no AlreadyOwnedError). Invalid `metadata.powerupKind` → `ItemNotPurchasableError`.

2. **`tests/unit/consume-powerup-atomic.test.ts`** — decrements when count > 0; returns false when count = 0; race-safe (UPDATE WHERE count > 0).

3. **`tests/unit/use-hint-action.test.ts`** — happy path; rejects unowned child (requireChild throws); rejects count=0 → returns `{ok: false}`.

4. **`tests/unit/use-skip-action.test.ts`** — happy path inserts scene_attempts(score=0); rejects count=0; tx rolls back if decrement fails.

5. **`tests/unit/streak-freeze-auto-burn.test.ts`** — gap > 1 day + freeze available → preserves streak, decrements freeze, emits bonus. Gap > 1 day + no freeze → normal reset. Gap = 1 → +1 (unchanged). Gap = 0 → noop.

6. **`tests/unit/grant-starter-powerups.test.ts`** — empty inventory → grants 1 hint + 1 skip; returns true. Non-empty inventory → no-op; returns false.

7. **`tests/unit/powerup-tray.test.tsx`** — renders 2 buttons with counts; disabled at 0; click → confirm modal → action called.

8. **`tests/unit/powerups-tab-body.test.tsx`** — renders 3 cards with current counts; Buy button calls `purchaseShopItemAction`.

9. **`tests/unit/multiple-choice-quiz-hint.test.tsx`** — `hintRequested={true}` disables exactly 1 wrong choice; correct choice remains enabled.

## 5. Scripts

- **`scripts/seed-powerups.ts`** — idempotent skip-by-slug, seeds 3 `shop_items` rows with metadata. Pattern matches `seed-pets.ts`. Run once after merge.

## 6. Out of scope

- **Powerup trophies** ("first hint used", "frugal week"). Existing trophies cover broader milestones.
- **Bundle pricing** (5 hints for 100). Single purchase = 1 count for V1.
- **Hint variants** (pinyin reveal, meaning hint). One mechanic: gray-out-a-wrong-choice.
- **Skip "undo"** — once consumed, the use is final.
- **Boss-specific powerup restrictions** — powerups work in boss too. (David can request a guard later.)
- **`revive` powerup** — enum value exists but no UI / no seed. Future PR.
- **Multi-day freeze** — burns 1 freeze per save; gap > 2 days still resets after the freeze saves day 1. PR #38 territory if Yinuo asks.
- **Powerup count display in week hub** — counts only render in the in-scene tray + the shop tab. The hub stays focused on section progress.

## 7. Verification (pre-PR-open)

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — 4-green.
2. `pnpm tsx scripts/migrate.ts` applied — confirms migration 0013.
3. `pnpm tsx scripts/seed-powerups.ts` ran — 3 shop_items inserted.
4. `pnpm dev`:
   - First-play (new child or one with empty inventory): open `/play/<childId>/level/<weekId>/practice` → tray shows 💡1 + ⏭️1 + starter toast.
   - Tap 💡 → confirm → one wrong choice grays out → pick correct → full coin reward + tray count drops to 0 → tray button grays.
   - Tap ⏭️ → confirm → next scene; the skipped scene shows as not-cleared on the hub (no ✨).
   - Open Shop → Powerup tab is live → 3 cards visible → buy 3 hints (90 coins) → tray shows 💡3.
   - Buy 1 streak-freeze (200 coins) → `powerup_inventory.streak_freeze = 1`.
5. Manual streak test: psql update `streaks.last_played_date` to 3 days ago + grant 1 freeze → next scene play → confirm `currentStreak` preserved + `BonusToast` fires.
6. Shop has 5 of 5 tabs live (Avatar / Sounds / Pet / Decor / Powerup).
7. Boss-unlock unaffected by skipped scenes: skip 7 practice → boss still locked; clear 7 properly → boss unlocks.

## 8. CLAUDE.md updates after merge

Under "Current state":
> PR #37 (shipped YYYY-MM-DD) — Consumable powerups. 3 in-scene powerups: 💡 Hint (gray out 1 wrong choice, no penalty), ⏭️ Skip (advance without scoring), 🧊 Streak-Freeze (auto-burn on missed day). Bottom-right floating tray; 1 hint + 1 skip starter pack on first play. Shop is now **5 of 5 tabs live** (Avatar / Sounds / Pet / Decor / Powerup). New `'skip'` value in `powerup_kind` enum (migration 0013). `tickStreak` extended to consume `streak_freeze` from `powerup_inventory` instead of resetting on day-gap.

Under "Landmines":
> **`streaks.freezeTokens` column is dead.** PR #37 uses `powerup_inventory(child_id, kind='streak_freeze', count)` as the source of truth for freeze tokens. The legacy `streaks.freezeTokens` column is untouched but unused. Don't add new code that reads/writes it; use `getPowerupCounts(childId).streak_freeze`.

> **Skipped scenes don't count toward boss-unlock.** `useSkipAction` writes a `scene_attempts` row with `score=0`. Boss-unlock counts `score >= 100`, so skipped scenes leave the practice slot uncleared. Yinuo needs to replay + clear properly to count toward the 7/14 threshold. This is intentional; don't change it without re-reading the PR #35 + #37 specs.

## 9. Implementation order (preview for plan stage)

1. **Migration 0013** — enum ADD VALUE `'skip'`.
2. **DB layer**: `src/lib/db/powerups.ts` with `getPowerupCounts`, `consumePowerupAtomic`, `grantPowerup`, `grantStarterPowerupsIfNeeded`. Tests.
3. **Shop purchase**: extend `purchaseShopItemInTx` with `case 'powerup'` → `purchasePowerupInTx`. Tests.
4. **Server actions**: `useHintAction` + `useSkipAction` in `src/lib/actions/powerups.ts`. Tests.
5. **Streak-freeze auto-burn**: extend `tickStreak` in `src/lib/db/streaks.ts`. Tests.
6. **MultipleChoiceQuiz**: add `hintRequested?: boolean` prop + gray-out logic. Tests.
7. **PowerupTray** component + SceneRunner integration (mount + state + skip-flow wiring). Tests.
8. **Starter pack call site**: section runner page wires `grantStarterPowerupsIfNeeded` + passes initial counts to SceneRunner.
9. **Shop tab UI**: `PowerupsTabBody.tsx` + flip `ShopCategoryTabs` + wire `ShopBody` + extend shop page Promise.all. Tests.
10. **Seed script**: `scripts/seed-powerups.ts` + smoke-run + recompile not required (no compile changes).
11. **4-green + manual smoke + PR + merge + prod ops + CLAUDE.md doc commit**.

## 10. Risk & rollback

- **Migration**: enum ADD VALUE is irreversible but inert if unused. Trivial rollback.
- **Purchase dispatch extension**: incremental — adds new branch, doesn't change avatar/decor/pet/sound paths.
- **`tickStreak` change**: affects every play session's streak update. Mitigated by tests covering all 4 cases (gap 0/1/2+, with/without freeze). Rollback = revert the freeze branch.
- **Starter pack**: idempotent; if it fires twice somehow, second call no-ops because inventory is no longer empty.
- **Shop tab live**: cosmetic; if buggy, flip `disabled: true` back.
- **`hintRequested` on MultipleChoiceQuiz**: optional prop; defaults to undefined; existing callers unaffected.
