# PR #21 — Shop hub + Avatar cosmetics (Phase 5 V1.5 entry)

**Status:** Approved design — 2026-05-18
**Roadmap slot:** PR #21 — first PR of the multi-PR "商店 expansion" roadmap inspired by Reading Eggs
**Source brainstorm:** plan-mode session 2026-05-18, plan file `~/.claude/plans/pls-work-on-chinese-playful-lemon.md`
**Predecessors:** PR #17 (boss + gacha + zodiac) — Phase 5 entry; PR #20 (hanzi sizing + zodiac SVG def mounting) — most recent
**Successors (sketched, not yet specced):** PR #22 (coin economy expansion), PR #23 (sound themes), PR #24 (consumable powerups), PR #25 (static pet companion), PR #26 (island decorations), PR #27 (achievements/trophies).

---

## 0. Why now

The core loop (PR #1 → #20) is validated. Yinuo plays daily. The economy, however, is open-loop on the spend side: scenes/boss award coins (50 / 25 / 300) and the **only** sink is the 500-coin gacha. The shop schema is already ~80% pre-scaffolded — `shop_items`, `shop_purchases`, `avatar_slots`, `avatar_items`, `child_avatar_inventory`, `child_avatar_equipped`, `powerup_inventory` all exist with zero controllers, no UI, and no seeded data. PLAN.md §2 explicitly flags this work as "Phase 5 V1.5 — shop tabs + avatar + voucher redemption queued".

David asked to enrich the shop, taking Reading Eggs as the reference. Locked decisions from the brainstorm:

- **Scope shape:** multi-PR roadmap, not a single mega-PR.
- **First PR:** shop hub + avatar cosmetics (schema-ready, highest visual ROI).
- **Pet shape (later PR):** static swappable companion — *not* hatch-and-grow or Tamagotchi.
- **Coin economy:** add new earn sources (daily login / streak / perfect-week bonuses) rather than inflate per-scene rewards.
- **Avatar style:** layered procedural SVG with the 4 slots already in schema (head/hat/top/background); default starter look for every child.
- **Shop entry point:** dedicated button in the play HUD next to the coin counter, persistent across play surfaces. Opens a full-screen shop with category tabs.

The art-direction memo's "no commissioned art until Yinuo validates loop" gate is effectively released *for procedural SVG cosmetics* (consistent with existing zodiac icons and `BossKraken.tsx`). Commissioned art remains out of scope.

---

## 1. Goals

After PR #21 ships:

1. Yinuo sees a 🛒 shop button beside her coin counter on every play surface.
2. Tapping it opens a full-screen shop with category tabs — **Avatar** enabled, **Sounds / Pet / Decor / Powerups** visible but disabled with "即将上线" placeholder.
3. She can browse ~20 pirate-themed avatar items, buy them with coins, equip them.
4. A small pirate-kid avatar renders in the play HUD, reflecting her equipped slots in real time.
5. Every child gets a default starter look the first time they open shop or play (no empty/naked state).

In scope (locked):

- Shop route, full-screen with sticky tab nav.
- Shop HUD button mounted in the play layout.
- Layered SVG `AvatarRender` with 4 slot dispatchers (`HeadSlot`, `HatSlot`, `TopSlot`, `BackgroundSlot`).
- ~20 procedural SVG avatar items across 3 rarities, seeded into `shop_items` + `avatar_items`.
- Purchase action with atomic coin deduction (reuses `awardCoinsInTx` from PR #17).
- Equip action with optimistic UI.
- Default starter look — auto-granted on first shop/play, never sold.
- Tests covering actions, DB, components.

Out of scope (intentionally deferred to later PRs in the roadmap):

- New coin earn sources → PR #22.
- Sound / FX theme swap → PR #23 (tab visible but disabled).
- Powerup purchase wiring → PR #24 (tab visible but disabled).
- Pet / decoration / arcade tabs → PRs #25–#27.
- Avatar item progression-gating (e.g., "unlock at week 5").
- Avatar item idle animations (everything is a static 1-frame SVG in PR #21).
- Voucher / promo-code redemption (mentioned in PLAN.md §2; separate work).
- Refund / un-equip back to default. Owned items can be swapped freely; you cannot "unown" something.

---

## 2. Frozen visual decisions

| Element | Decision | Notes |
|---|---|---|
| Shop button | 🛒 emoji in a `WoodSignButton`, sat to the right of the coin pill | Reuses the `WoodSignButton` already used on the gacha "抽卡 500 🪙" button |
| Avatar render | Circular badge ~72 px in HUD; ~200 px in shop preview | All 4 slots composed via `<svg><use href>` referencing a single `AvatarSvgDefs` mounted in play layout (PR #20 pattern) |
| Default starter look | `{ head: 'kid-default', hat: 'red-bandana', top: 'striped-tee', background: 'ocean-frame' }` | Always owned, shown as "已装备" not "购买"; cannot be removed |
| Slot count | 4 (matches `avatar_slots` schema) | head / hat / top / background |
| Rarity tiers | `common` / `rare` / `epic` | Mirrors `collectibleItems.rarity`; prices 80–150 / 250–400 / 600–900 coins |
| Item card | Cream radial center + gold border (matches zodiac card aesthetic from PR #17) | State chips: 未购买 (price), 已购买 (gold check), 已装备 (filled crown) |
| Purchase confirm | Modal with "买这个 — 花 X 🪙" + cost/balance/balance-after | Reuses `WoodSignButton`; disabled when balance < price |
| Equip flow | Tap-owned-item → immediate optimistic equip → light coin-shower style sparkle on the HUD avatar | No confirm dialog (keep friction off the loop) |
| Locked categories | Greyed tab + "即将上线" Chinese placeholder + tiny icon (🎵 / 🐦 / 🏝️ / 💡) | Tap shows toast "下次更新见！", no nav |

---

## 3. Tech stack & dependencies

No new dependencies. Reuses:

- `framer-motion@^12` — purchase confirm slide-up, avatar sparkle.
- Web Audio `playDing` (already exists) — purchase success cue.
- `awardCoinsInTx(tx, input)` from `src/lib/db/coins.ts` — for atomic coin deduction. New transaction reason `shop_purchase` added to the enum.
- `requireChild()` from `src/lib/auth/` — auth wrapping in actions.
- `WoodSignButton` from `src/components/ui/` — reused for shop HUD button + purchase confirm.

**Schema confirmation (small, in scope):**
- Append `shop_purchase` to `coinTransactions.reason` enum (Drizzle append-only migration).
- Confirm `shopItems.kind` enum includes `avatar`; if not, append. No destructive changes.
- Confirm `avatar_slots` rows for `head / hat / top / background` are seeded; if not, add a seed step.

**No new tables.** All shop/avatar tables already exist from prior scaffold work.

---

## 4. Critical files

**New code**

- `src/app/play/[childId]/shop/page.tsx` — shop route, reads child via Clerk session, hydrates initial catalog + inventory + balance.
- `src/app/play/[childId]/shop/ShopBody.tsx` — client component with tab state and item grid.
- `src/components/play/ShopHudButton.tsx` — persistent HUD button, mounted in play layout.
- `src/components/play/AvatarRender.tsx` — composes the 4 slots into a single SVG; accepts size + equipped map.
- `src/components/play/AvatarSvgDefs.tsx` — single mount of `<symbol>` defs for all avatar SVGs (PR #20 pattern). Mounted in `src/app/play/[childId]/layout.tsx`.
- `src/components/play/avatar-slots/HeadSlot.tsx`, `HatSlot.tsx`, `TopSlot.tsx`, `BackgroundSlot.tsx` — per-slot dispatchers, switch on equipped `itemId`.
- `src/components/shop/ShopCategoryTabs.tsx` — tabs nav (Avatar enabled, others disabled).
- `src/components/shop/ShopGrid.tsx` — grid of `ShopItemCard`s.
- `src/components/shop/ShopItemCard.tsx` — single item card with all 4 states.
- `src/components/shop/PurchaseConfirmDialog.tsx` — modal confirmation.
- `src/lib/db/shop.ts` — `listShopItems()`, `listChildOwnedShopItems()`, `purchaseShopItem(tx)`, `getEquippedAvatar()`, `equipAvatarItem()`. **Never imported from client bundles** (postgres pulls in `fs`/`net`/`tls`).
- `src/lib/actions/shop.ts` — `'use server'` async-only exports: `purchaseShopItemAction(childId, itemId)`, `equipAvatarItemAction(childId, itemId)`. Per CLAUDE.md, no sync exports here.
- `src/lib/errors/shop.ts` — pure error classes (`InsufficientCoinsError`, `AlreadyOwnedError`, `ItemNotPurchasableError`). Client-safe.
- `src/lib/avatar/defaultLook.ts` — exports `DEFAULT_AVATAR` constant.
- `src/lib/avatar/itemCatalog.ts` — single source of truth mapping `itemId → { slot, svgComponent, label, rarity, priceCoins, unlockVia }`.
- `scripts/seed-shop-avatar-items.ts` — idempotent seed of ~20 avatar items into `shop_items` and `avatar_items` (uses `loadEnv()` + dynamic `@/db` import per CLAUDE.md landmine).
- `drizzle/NNNN_shop_purchase_reason.sql` — generated migration appending `shop_purchase` to `coinTransactions.reason` enum.

**Existing files modified**

- `src/app/play/[childId]/layout.tsx` — mount `ShopHudButton` and `AvatarSvgDefs` alongside the existing `ZodiacIconDefs`.
- `src/app/play/[childId]/page.tsx` (island map) — render small `AvatarRender` in the header beside the coin pill.
- `src/db/schema/coins.ts` (or wherever `coinTransactions` lives) — append `shop_purchase` to reason enum.
- `src/db/schema/shop.ts` — confirm `shopItems.kind` covers `avatar`; if not, append.

**Tests** (Vitest + RTL, jsdom, all mocking `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`)

- `tests/unit/lib/actions/shop.test.ts` — purchase success / insufficient coins / already owned / equip flow / equip not-owned rejection.
- `tests/unit/lib/db/shop.test.ts` — purchase transaction atomicity (mocked tx).
- `tests/unit/components/shop/ShopGrid.test.tsx` — renders categories, owned/equipped chips correctly.
- `tests/unit/components/shop/PurchaseConfirmDialog.test.tsx` — disables confirm when balance < price.
- `tests/unit/components/play/AvatarRender.test.tsx` — composes all 4 slots, falls back to default for missing slot.

---

## 5. Avatar slot + item catalog

**4 slots** (matching `avatar_slots`):

| Slot | Launch items | Notes |
|---|---|---|
| `head` | 2 (warm, cool skin tone — both kid-shaped) | Free starter. Determines the base face shape; later items snap onto it. |
| `hat` | 8 | bandana / tricorn / captain's hat / parrot perch / crown / sunhat / pirate beanie / treasure-keeper visor |
| `top` | 6 | striped sailor tee / pirate coat / vest / life-jacket / treasure-keeper apron / golden epaulette top |
| `background` | 4 | circular frame: ocean / sunset / palm-island / treasure-cave |

**Rarity → price band:**

- `common` 80–150 coins — most hats, basic tops, plain frames.
- `rare` 250–400 coins — signature: parrot perch, captain coat, sunset frame.
- `epic` 600–900 coins — limited / themed: golden crown, treasure-cave frame.

Default starter is `{ head: 'kid-default-warm', hat: 'red-bandana', top: 'striped-tee', background: 'ocean-frame' }`. Always owned, shown as "已装备", not for sale.

No items locked behind progression at launch. (Progression-gated items can be added later via the existing `unlock_via` enum.)

---

## 6. Shop UX flow

1. Tap 🛒 in HUD → push `/play/[childId]/shop`.
2. Shop page header: current coin balance + back button. Category tabs sticky beneath.
3. Avatar tab selected by default. Other tabs render a disabled state with "即将上线" + a category icon.
4. Grid of `ShopItemCard`s; each shows: SVG preview, label, price chip with coin icon, state badge (购买 / 已购买 / 已装备 / 金币不够).
5. Tap an unowned item → `PurchaseConfirmDialog`. Confirm → calls `purchaseShopItemAction`. Loading state. On success: toast "已购买" + `playDing` + coin-down animation from existing `useCoinHud`. Card flips to "已购买".
6. Tap an owned-not-equipped item → immediately `equipAvatarItemAction` (optimistic). Avatar in HUD updates without reload. Light sparkle reuses coin-shower style at half-opacity.
7. Inadequate funds → confirm button disabled, helper line "再赚 X 个金币就能买啦". No upsell, no nag screens.

---

## 7. Verification (before opening the PR)

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green (the four-green gate from CLAUDE.md §"Hard rules").
2. `pnpm dev`, sign in, open `/play/<childId>` — avatar renders with default look beside the coin pill.
3. Tap 🛒 — shop opens, Avatar tab populated with ~20 cards. State chips render correctly (some "购买", default starter "已装备").
4. Buy a `common` item — confirm dialog → coin balance decrements by the exact price → card flips to "已购买".
5. Tap the just-owned item → equips → avatar in HUD updates without a reload.
6. Try to buy when balance < price → confirm button disabled, helper copy renders.
7. Switch tabs to Sounds / Pet / Decor / Powerups → each shows "即将上线" placeholder, no crash.
8. Refresh the page → equipped items persist; coin balance persists.
9. Open the shop on a child whose parent is on a *shared pack* week → shop still works (per PR #18 landmine — though shop is week-agnostic so this should pass trivially).
10. Toggle `prefers-reduced-motion` in DevTools → coin-down + sparkle animations degrade gracefully (CLAUDE.md landmine).
11. `pnpm drizzle-kit generate` produces the expected new migration file only; no edits to existing `drizzle/*.sql`.

---

## 8. Future PR sketches (informational; each gets its own spec)

### PR #22 — Coin economy expansion
Append `daily_login` / `streak_bonus` / `perfect_week` to `coinTransactions.reason`. Implement award logic: first scene of the UTC day → +20, each 7-day streak milestone → +100, week cleared 100% perfect → +200. Hook into existing `streaks` table. HUD micro-toast for each bonus. Idempotency tests.

### PR #23 — Sound / FX themes
Add `soundThemeId` to `child_settings` (or `child_profiles`). Refactor `src/lib/audio/play.ts` from fixed handlers into a theme registry; existing procedural sounds become the `default` theme. Seed 4 new themes as `shop_items.kind = sound_theme`: `music-box`, `retro-arcade`, `nautical`, `fanfare-plus`. Shop card plays a 1-second preview on tap.

### PR #24 — Consumable powerups
Add `powerup` to `shop_items.kind`. Seed 3: `hint` (peek answer), `skip_scene` (auto-clear current scene), `streak_freeze` (save a missed day). Purchase increments `powerup_inventory.count`. In-scene tray bottom-right with tap-to-consume. Streak-freeze auto-consumes when a day is missed and balance > 0.

### PR #25 — Static pet companion
New tables `pets` + `child_pet_inventory` + `child_pet_equipped` (one active at a time). Pet sprite ~60–80 px sits right of the avatar in the HUD. Tap pet → tiny animation + ding. Seed 8 pets: parrot / monkey / crab / sea turtle / ship cat / dolphin / bat / glow-jellyfish — covering common/rare/epic at 300–1200 coins. No feeding, no stages — deliberate scope cap.

### PR #26 — Island / ship decorations
New `child_island_decor` table mapping `(childId, decorItemId, position?)`. `IslandMap` accepts a `decorations` prop and renders SVG overlays at fixed anchor positions. Positions are part of the item definition for V1 — no drag-to-place UI. Seed ~10 decor items.

### PR #27 *(optional)* — Achievements / trophies
New `trophies` + `child_trophies`. Auto-grant on milestones (first boss / first perfect week / 7-day streak / all-12-zodiac / 10 avatar items owned). Trophy room as a tab on `/play/[childId]/collection`. No coin reward — status / pride only.

---

## 9. Open questions for follow-up PRs

Not blocking PR #21:

1. **Avatar item art sourcing.** PR #21 builds everything as hand-rolled procedural SVG (consistent with zodiac icons / kraken). If commissioned art is brought in later, the `itemCatalog.ts` indirection makes per-item swap trivial — but the procedural-only constraint is reaffirmed for PR #21.
2. **Catalog refresh strategy.** Catalog is a TS constant + DB seed. If monthly themed drops are desired later, an admin panel will be needed — out of scope for now.
3. **Animated avatars.** Should a *bought* item have an idle-animation hint (e.g., parrot blinking)? Defer until Yinuo plays with the static version and we see if it's missing.
4. **Sticker / trading.** Reading Eggs has a sticker book; the zodiac collection is close enough. No separate sticker system planned.

---

## 10. Post-ship memory updates

After PR #21 merges:

- Write `~/.claude/projects/-Users-jiangwei-Claude-Chinese/memory/project_shop_v1.md` — captures shipped shop architecture + which categories are live vs. queued.
- Update CLAUDE.md "Current state" with PR #21 summary.
- Add a Landmines entry if avatar slot mounting or `shop_items.kind` enum bites us (mirroring the PR #20 Zodiac defs entry).
