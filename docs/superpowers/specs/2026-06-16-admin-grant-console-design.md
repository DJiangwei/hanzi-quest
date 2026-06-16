# Admin Grant Console — Design

**Date:** 2026-06-16
**Status:** Approved direction (pending spec review)
**Branch:** `feat/admin-grant-console`

## Context

The product is distributed to friends & family (separate accounts, one parent login per family). David wants a designated **admin / test account** that, beyond normal parent/play functions, can reach into *any* account and grant a child anything obtainable in-game — to seed test data and to send motivational gifts (e.g. a 登录礼包 / welcome gift to Yinuo's new account).

Today there are 2 login accounts: **Ban Ban** (`banbanhu4ever@gmail.com`, owns child **小板**) and **Jiangwei Dai** (owns child **Yinuo**), both `parent` role. David's instruction: make **小板's login (Ban Ban)** the admin/test account.

This is a *deliberate, role-gated cross-account write capability* — the sanctioned opposite of the accidental holes closed in PR #112. It must be tightly gated by a new `assertAdmin` and invisible/uncallable for non-admins.

## Goal

An admin-only console where the admin:
1. picks any child across all accounts,
2. composes a **custom gift bundle** of anything a kid can get (coins, XP, shards, powerups, specific collectible cards, a random gift-pack, and shop/home ownership: avatar / pet / sound / decor / furniture / surfaces — including per-category "unlock all"),
3. sends it in one transaction,
4. and can **undo** any past gift (logged in an `admin_grants` table).

## Non-Goals (v1)

- Granting trophies (earned by play, not gifted).
- Saved/named reusable presets (the editable welcome-gift default covers the common case).
- Multi-child bulk send / scheduling.
- Any change to how non-admin parents/kids experience the app.

## Decisions (locked with David)

- **Admin account:** `banbanhu4ever@gmail.com` (Ban Ban) → `users.role='admin'`. Keeps all normal functions.
- **Powers:** everything a kid can obtain — coins, XP, shards, powerups, cards (specific + random gift-pack), and shop/home ownership.
- **Grant UX:** flexible console with a pre-filled, editable **welcome-gift default** (admin customizes before sending).
- **Shop grants:** categorized multi-select **+ per-category "unlock all" toggle**.
- **Safety:** an `admin_grants` log **with undo**.

## Architecture

### Auth — `assertAdmin`

New guard in `src/lib/auth/guards.ts`:
```ts
export async function assertAdmin(): Promise<UserRow> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  const user = await getUserById(userId);
  if (!user) throw new UnauthorizedError(...);
  if (user.role !== 'admin') throw new ForbiddenError('Admin role required');
  return user;
}
```
All admin grant actions call `assertAdmin` and **deliberately do NOT call `requireChild`** (they must reach children in other accounts) — this is the one sanctioned cross-account write path, documented as such. `user_role` enum already includes `'admin'`, so promoting Ban Ban is a one-row update (a one-off script `scripts/set-admin-role.ts`, idempotent, targets by email; reversible).

### Surface — `/admin`

- `src/app/admin/layout.tsx` — `await assertAdmin()` → `notFound()` on failure (mirrors the play-layout guard). Every `/admin/*` page sits under it.
- `src/app/admin/page.tsx` — the console (server component): child picker + (on selection) current-state panel + compose-gift form.
- Entry point: a link on the parent dashboard rendered **only when `parent.role === 'admin'`** (read in the existing `assertParent` result). No link for non-admins.

### Data — `admin_grants` table (migration 0031)

```
admin_grants
  id           uuid pk default gen_random_uuid()
  admin_user_id text  not null            -- who granted (users.id)
  child_id     uuid  not null             -- target (child_profiles.id)
  bundle       jsonb not null             -- the composed request (what admin asked for)
  result       jsonb not null             -- what was CONCRETELY granted (for precise undo)
  created_at   timestamptz not null default now()
  undone_at    timestamptz                -- set when undone (null = active)
  index (child_id, created_at)
```
`result` records the **newly-granted** concrete ids (resolved gift-pack card ids, newly-added shop item ids — NOT items the child already owned) plus the numeric deltas. Undo reverses exactly `result`, so it never strips what the child earned themselves.

**No other migration** — `coin_reason` already has `'admin_adjust'` (reused for admin coin grants); `xp_events.source` is `text` (just add `'admin_grant'` to the `XpSource` TS union in `src/lib/db/xp.ts`, no schema change); shards / powerups / collections / shop_purchases tables all already exist.

### Grant + inverse primitives (`src/lib/db/admin-grants.ts`)

Each grant type gets an in-tx grant helper and an inverse (for undo). All clamp at 0 and are best-effort for consumables (a kid may have already spent granted coins/powerups — undo reverses the ledger intent, not the kid's live spending):

| Type | Grant | Inverse (undo) |
|---|---|---|
| Coins | `awardCoins(child, +n, 'admin_adjust')` | `awardCoins(child, −n, 'admin_adjust')` (floor balance at 0) |
| XP | `awardXp(child, +n, 'admin_grant')` | `awardXp(child, −n, 'admin_grant')` |
| Shards | `grantShardsInTx(+n)` | `grantShardsInTx(−n)` clamp ≥0 |
| Powerups | `grantPowerupInTx(kind,+n)` | `grantPowerupInTx(kind,−n)` clamp ≥0 |
| Specific card | `grantSpecificCardInTx(itemId)` → record if newly owned | `removeCardInTx(itemId)` only if it was newly granted |
| Gift pack | reuse `grantGiftPackInTx` (admin variant, non-idempotent) → record resolved card ids | remove those exact cards |
| Shop/home item | `grantShopItemInTx(itemId)` = `purchaseShopItemInTx` side-effects **minus the coin debit** → record if newly owned | `revokeShopItemInTx(itemId)` (delete shop_purchases + avatar-inventory row; unequip if equipped) only if newly granted |

`grantShopItemInTx` is implemented by refactoring `purchaseShopItemInTx` so the side-effect dispatch (the `switch (kind)` that, e.g., inserts an avatar inventory row) is shared, and the admin path skips the coin debit + the "already owned" rejection (idempotent: already-owned → no-op, not recorded in `result`).

### Actions (`src/lib/actions/admin.ts`, `'use server'`)

- `listAllChildrenForAdminAction()` → `assertAdmin`; returns every child (id, name, gender, parent email) for the picker.
- `getChildAdminSummaryAction(childId)` → `assertAdmin`; coins/XP/shards/#owned for the selected-child panel.
- `sendAdminGiftAction(childId, bundle)` → `assertAdmin`; one transaction: apply every grant in `bundle`, expand "unlock all" categories to concrete item ids, write an `admin_grants` row with the concrete `result`; return a summary.
- `undoAdminGiftAction(grantId)` → `assertAdmin`; guard `undone_at IS NULL`; reverse `result` in one transaction; set `undone_at`.

`bundle` shape (zod-validated):
```ts
{ coins?: number; xp?: number; shards?: number;
  powerups?: { hint?: number; skip?: number; streak_freeze?: number };
  giftPack?: boolean;
  cardItemIds?: string[];
  shopItemIds?: string[];
  shopUnlockAll?: ('avatar'|'pet'|'sound_theme'|'decor'|'home')[] }
```

### UI components (`src/components/admin/`)

- `AdminChildPicker` — list/select a child (name + parent email + gender).
- `ChildStatePanel` — read-only coins/XP/shards/#owned.
- `ComposeGiftForm` (client) — numeric inputs (coins/XP/shards/powerups), gift-pack toggle, card multi-select (from the collectible catalog), shop multi-select grouped by category with a per-category "unlock all" checkbox; pre-filled with `WELCOME_GIFT_DEFAULT` (e.g. `{coins:500, xp:100, giftPack:true}`), editable; **confirm dialog** before send; result toast.
- `GrantHistoryList` — recent `admin_grants` for the selected child, each with an **撤销 / Undo** button (disabled if `undone_at`).

Admin UI is David-facing → exempt from the bilingual-chrome rule, but I'll keep it bilingual where cheap for consistency.

## Safety / isolation notes

- Every admin action gates on `assertAdmin`; the `/admin` route layout guards rendering. Non-admins get `ForbiddenError` / `notFound`.
- The PR #112 regression guard (`distribution-isolation-guard.test.ts`) checks specific function names — the new admin actions are a *named, role-gated* exception and won't trip it. Add a test asserting the admin actions reject a non-admin caller.
- Grants to consumables are inherently best-effort on undo (kid may have spent them) — documented; undo clamps at 0 and only removes newly-granted ownership/cards.

## Testing

Vitest + RTL + jsdom; mock `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`. Cover: `assertAdmin` (admin passes / parent rejected); `sendAdminGiftAction` applies each grant type + writes `admin_grants` with concrete `result`; "unlock all" expands to all category items, skipping already-owned; `undoAdminGiftAction` reverses each type, clamps at 0, and is idempotent (second undo rejected); non-admin caller rejected. Four-green gate at PR open.

## Migration & ops

- Migration 0031: `admin_grants` table.
- `scripts/set-admin-role.ts banbanhu4ever@gmail.com` (post-merge, idempotent) — promote Ban Ban to admin.

## Open questions

None — scope, admin account, powers, UX, shop-grant thoroughness, and the log+undo safety model are all resolved.
