# Collection & Powerup Economy Fixes — Design Spec

**Date:** 2026-06-07
**Status:** approved (design locked via David's Q1/Q2 answers)
**Context:** David's playtest surfaced three issues to fix before the next stage. He explained what he wants for each:

1. **Pack-complete trophy never grants.** Yinuo collected all 12 zodiac cards but got no 十二生肖 trophy in the trophy hall.
2. **Shard economy redesign (card-for-card swap).** Keep the 3→1 trade ratio, but: (a) **don't** auto-convert duplicates to shards — add a manual **"convert duplicate → shard"** button; (b) make **shards a single universal currency** (one wallet, spendable on any pack's cards), not per-pack; (c) add **bilingual help text** so the kid understands the mechanic.
3. **Hint powerup.** Make hints **free + always available in practice**, and **not offered during the boss** ("练习免费，Boss战不给"). Today the 💡 is gated on a consumable token (only 1 from the starter pack → almost always greyed) and is a silent no-op during the boss.

---

## 1. Fix A — Pack-complete trophy

**Root cause:** `checkAndGrantTrophies({kind:'pack-complete', packSlug})` is only called inside the **deprecated** `pullPaid` (coin gacha, no UI since PR #52). The live grant paths never call it.

**Fix:**
- After a **granted** card in `pullCardForChild` (boss/perfect/story), call `checkAndGrantTrophies({kind:'pack-complete', packSlug: result.packSlug})`.
- After a successful `swapShardsForItem`, call it for the swapped item's pack.
- In `claimWeeklyGiftIfDue`, call it once per distinct pack among the granted gift cards.
- **Backfill:** one-off `scripts/backfill-pack-trophies.ts` — for every child, run the pack-complete check for all 5 packs (idempotent; grants any already-earned pack trophy now, including Yinuo's zodiac).

These trophy grants are **additive + guarded** (a trophy-check failure must never break a card grant): wrap each in a local try/catch and ignore the returned trophies on the trust-caller paths (or thread them through where a return slot exists). Card-grant success is the primary write; trophy grant rides after.

---

## 2. Fix B — Hint: free in practice, none in boss

**Behavior:**
- **Practice scenes:** the 💡 hint is **free and always available** (no token, no server call). Tapping it greys out one wrong choice (existing `hintRequested` → `MultipleChoiceQuiz` behavior, unchanged). It resets per scene (already keyed on level index).
- **Boss:** **no hint** — the 💡 button is hidden during the boss level (`sceneSupportsHint = false` when `sceneType === 'boss'`), and `BossScene` is left as-is (it already ignores hints).
- **Skip** powerup is unchanged (still a consumable token; still in shop + starter pack).

**Mechanics:**
- `SceneRunner`: the hint button becomes a **free local toggle** — it sets `hintActivatedAtIndex = index` directly, with **no `useHintAction` call and no token decrement**. Remove `hintCount` gating for the hint button (keep it for nothing — drop it).
- `PowerupTray`: split responsibilities — the hint button no longer takes `hintCount`/calls the server; it's a free toggle disabled only after it's been used on the current scene. The skip button is unchanged.
- **Shop + starter:** remove the **hint** item from the shop powerup tab and from the starter grant. `grantStarterPowerupsIfNeeded` grants **skip only**. The `pw-hint` shop row is deactivated (`is_active=false`) via a tiny retire step (consistent with the scene-template retirement pattern); the `'hint'` `powerup_kind` enum value and existing inventory rows stay (backwards-compat, harmless).

> Rationale for "free toggle, not a token": David wants the hint *visible and usable*, and selling a now-free helper would confuse. Skip stays paid (it's a stronger "skip the whole scene" affordance).

---

## 3. Fix C — Universal shard wallet + manual conversion

### 3.1 Data model
- New table **`child_shards (child_id uuid PK → child_profiles, shards int NOT NULL default 0)`** — one **global** wallet per child. (Migration ~0024.)
- The legacy per-pack **`shard_balances`** table becomes **dead but kept** (append-only rule). A one-off backfill sums each child's per-pack balances into `child_shards`.

### 3.2 Earning shards (manual, not automatic)
- **Card grants stop auto-granting shards on duplicate.** `pullCardInTx` and `grantGiftPackInTx` no longer touch any shard balance — a duplicate just increments `child_collections.count` (the ×N badge). `CardGrantResult.shardsAfter` / `GiftCard.shardsAfter` are dropped (or always 0) and the reveal copy changes (see 3.5).
- **New action `convertDuplicateToShard(childId, itemId)`** (`requireChild`): if the child owns `itemId` with `count ≥ 2`, decrement that row's `count` by 1 and add **+1** to `child_shards`. Returns `{ ok, count, shards }`. Rejects when `count < 2` (can't scrap your last copy) — pure error in `src/lib/errors/gacha-errors.ts` (`NoDuplicateToConvertError`). Ratio: **1 duplicate = 1 shard.**

### 3.3 Spending shards (universal, keep 3→1)
- `SHARD_SWAP_COST` stays **3**. `swapShardsInTx(tx, childId, itemId)` now reads/writes the **global** `child_shards` wallet (no `packId` scoping) and grants the chosen unowned `itemId` from **any** pack. Reasons unchanged (`insufficient_shards | already_owned | item_not_found`).

### 3.4 UI
- **Global shard pill**: the collection hub + every pack page show one universal `🔹 N` (from `child_shards`), not a per-pack count.
- **Convert button**: on each **owned** card with **count > 1** in `PackPageBody`, a `♻️ 换碎片 / To shard` chip → calls `convertDuplicateToShard`. The ×N badge decrements; the shard pill increments.
- **Swap chip**: unchanged placement on unowned cards (`🔹换卡 / Trade`, enabled at ≥3 global shards), now spends global shards.
- **Bilingual help text**: a short explainer line on the collection hub and pack page:
  > 重复的卡可以换成 🔹 碎片，3 个碎片换一张你想要的新卡。
  > Turn duplicate cards into 🔹 shards — 3 shards trade for any new card you want.

### 3.5 Reveal copy
- `CardChestReveal` duplicate note changes from "+1 碎片 / shard" to "重复卡 ×N（可换碎片）/ Duplicate (convertible to a shard)". No shard number is shown at grant time (shards are earned by manual conversion, not the grant).

---

## 4. Files

**New**
- migration ~0024 + `src/db/schema/collections.ts` `childShards` table.
- `src/lib/db/shards.ts` — `getShardWallet`, `addShards`, `convertDuplicateInTx` (or fold into grants.ts).
- `src/lib/actions/...` — `convertDuplicateToShard` action.
- `scripts/backfill-shards-wallet.ts` (sum per-pack → global) + `scripts/backfill-pack-trophies.ts`.
- `scripts/retire-hint-powerup.ts` (set `pw-hint` `is_active=false`).
- Tests for each.

**Modified**
- `src/lib/db/grants.ts` — drop dupe→shard auto-grant in `pullCardInTx` + `grantGiftPackInTx`; `swapShardsInTx` → global wallet; `convertDuplicateInTx`.
- `src/lib/actions/gacha.ts` — pack-complete trophy on grant/swap/gift; `convertDuplicateToShard`; global shard reads.
- `src/lib/db/collections.ts` / pack page server component — read global shard wallet; pass count for convert button.
- `src/components/play/PackPageBody.tsx` — global shard pill, convert chip, help text; swap uses global shards.
- `src/components/play/{ShardPill,SwapDialog}.tsx`, `AtlasHub` (hub shard pill + help text).
- `src/lib/play/reveal-card.ts` + `CardChestReveal.tsx` — drop shard note, show duplicate note.
- `src/components/scenes/SceneRunner.tsx` + `PowerupTray.tsx` — free hint toggle in practice, hide in boss.
- `src/lib/db/powerups.ts` — starter grants skip only.
- `src/components/shop/PowerupsTabBody.tsx` — hide hint listing (defensive; the retire script also deactivates it).
- `CLAUDE.md`.

---

## 5. Out of scope
- Changing the 3→1 ratio. Changing skip. Touching the daily card cap / gift-pack cadence. Re-theming the shard glyph. A dedicated "shard shop." Boss hints.

---

## 6. Testing
- **Trophy:** grant path calls pack-complete on a completing card/swap/gift; backfill grants retroactively; idempotent (no double-grant).
- **Shards:** `convertDuplicateToShard` rejects count<2, decrements count + adds 1 shard on count≥2; grants no longer auto-add shards (dupe only bumps count); `swapShardsInTx` spends global shards, grants from any pack, rejects insufficient/owned; backfill sums per-pack → global.
- **Hint:** practice hint is free (no `useHintAction` call) + greys a wrong choice; boss hides the 💡; starter grants skip only; `pw-hint` not listed.
- **Migration:** `child_shards` exists; backfill idempotent.
- Existing pack/reveal/powerup tests updated for the new copy + global pill.

---

## 7. Done criteria
- Completing any pack (incl. via boss cards or a swap) grants its trophy; Yinuo's zodiac trophy appears after backfill.
- Duplicates stay as ×N until the kid taps 换碎片; shards are one universal wallet; 3 shards trade for any new card; bilingual help explains it.
- Hints are free + visible in every practice scene and absent in the boss.
- `pnpm typecheck && lint && test && build` green; backfills + retire script run clean.
