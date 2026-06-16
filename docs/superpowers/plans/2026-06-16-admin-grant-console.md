# Admin Grant Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-only `/admin` console where a designated admin account grants any child (across accounts) anything obtainable in-game — coins, XP, shards, powerups, specific cards, a random gift-pack, and shop/home ownership (with per-category "unlock all") — composed as a custom bundle, logged to `admin_grants`, and **undoable**.

**Architecture:** A new `assertAdmin` guard (role `'admin'`, already in the `user_role` enum) gates every admin action + the `/admin` route. Admin grant actions deliberately bypass `requireChild` (they reach other accounts) — the one sanctioned cross-account write path. Grants reuse existing primitives where possible (`awardCoins` reason `'admin_adjust'`, `awardXp` source `'admin_grant'`, `grantGiftPackInTx`) plus new in-tx grant/inverse helpers. Every gift records its **concrete** result for precise undo.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle (Neon Postgres), Clerk, Vitest + RTL + jsdom, Tailwind. Four-green gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

**Spec:** `docs/superpowers/specs/2026-06-16-admin-grant-console-design.md`

---

## File Structure

**New:**
- `src/db/schema/admin.ts` — `admin_grants` table.
- `src/lib/db/admin-grants.ts` — grant + inverse in-tx primitives + the send/undo transaction orchestration helpers + admin read queries.
- `src/lib/actions/admin.ts` — `'use server'` actions (`listAllChildrenForAdminAction`, `getChildAdminSummaryAction`, `sendAdminGiftAction`, `undoAdminGiftAction`).
- `src/lib/admin/bundle.ts` — pure `GiftBundle` zod schema + `WELCOME_GIFT_DEFAULT` (client-safe, no DB).
- `src/app/admin/layout.tsx`, `src/app/admin/page.tsx` — guarded route + console.
- `src/components/admin/{AdminChildPicker,ChildStatePanel,ComposeGiftForm,GrantHistoryList}.tsx`.
- `scripts/set-admin-role.ts` — promote an account to admin by email.
- Tests under `tests/unit/`.

**Modified:**
- `src/lib/auth/guards.ts` — add `assertAdmin`.
- `src/lib/db/xp.ts` — add `'admin_grant'` to `XpSource`.
- `src/lib/db/shop.ts` — refactor `purchaseShopItemInTx` so its kind-dispatch side-effects are reusable by a free admin grant.
- `src/db/schema/index.ts` (or the schema barrel) — export the new table.
- `src/app/parent/(secured)/page.tsx` — admin-only link to `/admin`.

---

## Task 1: `assertAdmin` guard + promote-admin script

**Files:**
- Modify: `src/lib/auth/guards.ts`
- Create: `scripts/set-admin-role.ts`
- Test: `tests/unit/assert-admin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/assert-admin.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { authMock, getUserByIdMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUserByIdMock: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('@/lib/db/users', () => ({ getUserById: getUserByIdMock }));

import { assertAdmin } from '@/lib/auth/guards';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/guards';

beforeEach(() => vi.clearAllMocks());

describe('assertAdmin', () => {
  it('returns the user when role is admin', async () => {
    authMock.mockResolvedValue({ userId: 'u1' });
    getUserByIdMock.mockResolvedValue({ id: 'u1', role: 'admin' });
    await expect(assertAdmin()).resolves.toMatchObject({ id: 'u1', role: 'admin' });
  });
  it('throws ForbiddenError for a parent', async () => {
    authMock.mockResolvedValue({ userId: 'u2' });
    getUserByIdMock.mockResolvedValue({ id: 'u2', role: 'parent' });
    await expect(assertAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });
  it('throws UnauthorizedError when not signed in', async () => {
    authMock.mockResolvedValue({ userId: null });
    await expect(assertAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`assertAdmin` not exported).
Run: `pnpm test tests/unit/assert-admin.test.ts`

- [ ] **Step 3: Implement `assertAdmin`** in `src/lib/auth/guards.ts` (after `assertParent`):
```ts
/**
 * Asserts the caller is signed in AND has the 'admin' role. Used to gate the
 * cross-account admin grant console — the ONE sanctioned cross-account write
 * path (admin actions deliberately skip requireChild to reach other accounts).
 */
export async function assertAdmin(): Promise<UserRow> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  const user = await getUserById(userId);
  if (!user) {
    throw new UnauthorizedError(`Clerk user ${userId} has no mirrored row`);
  }
  if (user.role !== 'admin') throw new ForbiddenError('Admin role required');
  return user;
}
```

- [ ] **Step 4: Run the test — expect PASS.**

- [ ] **Step 5: Create `scripts/set-admin-role.ts`** (idempotent, email-targeted, loadEnv pattern):
```ts
/**
 * Promote a login account to the 'admin' role by email. Idempotent.
 *   pnpm tsx scripts/set-admin-role.ts banbanhu4ever@gmail.com
 * Pass a second arg 'parent' to demote.
 */
import { config } from 'dotenv';

async function main() {
  config({ path: '.env.local' });
  const email = process.argv[2];
  const role = (process.argv[3] ?? 'admin') as 'admin' | 'parent';
  if (!email) throw new Error('Usage: set-admin-role.ts <email> [admin|parent]');
  const { db } = await import('@/db');
  const { users } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const [row] = await db.update(users).set({ role }).where(eq(users.email, email)).returning({ id: users.id, role: users.role });
  if (!row) throw new Error(`No user with email ${email}`);
  console.log(`Set ${email} → role=${row.role}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Verify gate + commit.**
Run: `pnpm typecheck && pnpm lint && pnpm test tests/unit/assert-admin.test.ts`
```bash
git add src/lib/auth/guards.ts scripts/set-admin-role.ts tests/unit/assert-admin.test.ts
git commit -m "feat(admin): assertAdmin guard + set-admin-role script

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `admin_grants` table + migration + XpSource

**Files:**
- Create: `src/db/schema/admin.ts`
- Modify: schema barrel (`src/db/schema/index.ts`), `src/lib/db/xp.ts`
- Generate: `drizzle/0031_*.sql`

- [ ] **Step 1: Add the schema** `src/db/schema/admin.ts`:
```ts
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';

export const adminGrants = pgTable(
  'admin_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: text('admin_user_id').notNull(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    bundle: jsonb('bundle').notNull(),
    result: jsonb('result').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    undoneAt: timestamp('undone_at', { withTimezone: true }),
  },
  (t) => [index('admin_grants_child_created_idx').on(t.childId, t.createdAt)],
);
```
(Confirm `childProfiles` is exported from `./auth`; if it lives elsewhere, import from the right module. Match the existing table-definition style in `src/db/schema/*`.)

- [ ] **Step 2: Export it** from the schema barrel (add `export * from './admin';` where the other schema files are re-exported).

- [ ] **Step 3: Add `'admin_grant'` to `XpSource`** in `src/lib/db/xp.ts`:
```ts
export type XpSource =
  | 'scene_complete'
  | 'scene_perfect'
  | 'boss_clear'
  | 'daily_quest'
  | 'daily_chest'
  | 'streak_milestone'
  | 'homework'
  | 'admin_grant';
```
(`xp_events.source` is `text` — no migration for this.)

- [ ] **Step 4: Generate the migration.**
Run: `pnpm db:generate`
Expected: a new `drizzle/0031_*.sql` creating `admin_grants` (and NOTHING else — `coin_reason` already has `admin_adjust`). Inspect the file; confirm it only adds the table + index. Do NOT hand-edit it.

- [ ] **Step 5: Verify typecheck + commit.**
Run: `pnpm typecheck`
```bash
git add src/db/schema/admin.ts src/db/schema/index.ts src/lib/db/xp.ts drizzle/0031_*.sql drizzle/meta
git commit -m "feat(admin): admin_grants table (migration 0031) + admin_grant XpSource

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
> Note: do NOT run `pnpm db:migrate`/`pnpm build` here — that applies to prod. The final task runs the gate; migration auto-applies on deploy.

---

## Task 3: Grant + inverse DB primitives

**Files:**
- Create: `src/lib/db/admin-grants.ts`
- Modify: `src/lib/db/shop.ts` (extract reusable kind-dispatch)
- Test: `tests/unit/admin-grants-db.test.ts`

Context: each grant type needs a forward (grant) and inverse (undo) in-tx helper. Symmetric numeric grants (coins/xp/shards/powerups) undo by applying the negated delta, clamped at 0. Cards are count-based (+1 / −1, delete at 0). Shop/home ownership is boolean — grant inserts a free `shop_purchases` row + side-effects and reports `newlyOwned`; undo revokes only newly-owned items.

- [ ] **Step 1: Refactor `purchaseShopItemInTx` to expose a free-grant path.** In `src/lib/db/shop.ts`, extract the per-`kind` side-effect dispatch (the part that, e.g., inserts a `child_avatar_inventory` row for `kind==='avatar'`, and always inserts the `shop_purchases` row) into a helper `applyShopItemOwnershipInTx(tx, childId, item)` that does NOT debit coins and is idempotent (already-owned → returns `{ newlyOwned: false }` without inserting). Have the existing `purchaseShopItemInTx` keep doing the coin debit + already-owned rejection, then call `applyShopItemOwnershipInTx`. Export `applyShopItemOwnershipInTx`. (Read the current `purchaseShopItemInTx` to preserve every kind's side effects exactly — avatar inventory insert, etc. The existing `shop-db.test.ts` must still pass.)

- [ ] **Step 2: Write the failing tests** `tests/unit/admin-grants-db.test.ts` covering the pure clamp logic and that each helper issues the expected writes against a mock tx. Use the repo's established mock-tx pattern (see `tests/unit/grants-db.test.ts`). Cover at minimum:
  - `grantShardsInTx(tx, 'c', 5)` upserts +5; `grantShardsInTx(tx, 'c', -100)` clamps the stored balance at 0 (never negative).
  - `grantPowerupInTx(tx, 'c', 'hint', 3)` upserts +3; negative clamps at 0.
  - `grantSpecificCardInTx` inserts a `child_collections` row at count 1 when absent; increments when present; `removeCardInTx` decrements and deletes at 0.
  - `applyShopItemOwnershipInTx` returns `{ newlyOwned: false }` for an already-owned item (no insert).

(Write concrete assertions against the mock `tx.insert/update/delete` spies, mirroring `grants-db.test.ts`. Full code per that file's style.)

- [ ] **Step 2b: Run — expect FAIL.**

- [ ] **Step 3: Implement `src/lib/db/admin-grants.ts`** with the in-tx primitives:
```ts
import { and, eq, sql } from 'drizzle-orm';
import { childShards, powerupInventory, childCollections, collectibleItems, shopPurchases } from '@/db/schema';
import { applyShopItemOwnershipInTx } from '@/lib/db/shop';

type Tx = Parameters<Parameters<typeof import('@/db').db.transaction>[0]>[0];

export async function grantShardsInTx(tx: Tx, childId: string, delta: number): Promise<void> {
  await tx
    .insert(childShards)
    .values({ childId, shards: Math.max(0, delta) })
    .onConflictDoUpdate({
      target: childShards.childId,
      // GREATEST(0, current + delta) — never negative
      set: { shards: sql`GREATEST(0, ${childShards.shards} + ${delta})` },
    });
}

export async function grantPowerupInTx(
  tx: Tx, childId: string, kind: 'hint' | 'skip' | 'streak_freeze', delta: number,
): Promise<void> {
  await tx
    .insert(powerupInventory)
    .values({ childId, kind, count: Math.max(0, delta) })
    .onConflictDoUpdate({
      target: [powerupInventory.childId, powerupInventory.kind],
      set: { count: sql`GREATEST(0, ${powerupInventory.count} + ${delta})` },
    });
}

/** Add one copy of a card (insert at 1, else +1). */
export async function grantSpecificCardInTx(tx: Tx, childId: string, itemId: string): Promise<void> {
  await tx
    .insert(childCollections)
    .values({ childId, itemId, count: 1 })
    .onConflictDoUpdate({
      target: [childCollections.childId, childCollections.itemId],
      set: { count: sql`${childCollections.count} + 1` },
    });
}

/** Remove one copy (−1; delete the row at 0). Best-effort. */
export async function removeCardInTx(tx: Tx, childId: string, itemId: string): Promise<void> {
  await tx
    .update(childCollections)
    .set({ count: sql`${childCollections.count} - 1` })
    .where(and(eq(childCollections.childId, childId), eq(childCollections.itemId, itemId)));
  await tx
    .delete(childCollections)
    .where(and(eq(childCollections.childId, childId), eq(childCollections.itemId, itemId), sql`${childCollections.count} <= 0`));
}

export { applyShopItemOwnershipInTx };
```
> Confirm the exact column names against `src/db/schema/*` (`childShards.shards`, `powerupInventory.kind/count`, `childCollections.count/itemId`) and adjust if they differ. Reuse existing helpers where they already exist (e.g. if `grants.ts` already has a shard upsert, call it instead of duplicating).

- [ ] **Step 4: Run the tests — expect PASS.** Also run `pnpm test tests/unit/shop-db.test.ts` to confirm the `purchaseShopItemInTx` refactor preserved behavior.

- [ ] **Step 5: Commit.**
```bash
git add src/lib/db/admin-grants.ts src/lib/db/shop.ts tests/unit/admin-grants-db.test.ts
git commit -m "feat(admin): grant/inverse in-tx primitives + free shop-ownership path

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Bundle schema + admin actions (send + undo + reads)

**Files:**
- Create: `src/lib/admin/bundle.ts`, `src/lib/actions/admin.ts`
- Test: `tests/unit/admin-actions.test.ts`

- [ ] **Step 1: `src/lib/admin/bundle.ts`** (pure, client-safe — NO db import):
```ts
import { z } from 'zod';

export const GiftBundleSchema = z.object({
  coins: z.number().int().optional(),
  xp: z.number().int().min(0).optional(),
  shards: z.number().int().min(0).optional(),
  powerups: z.object({
    hint: z.number().int().min(0).optional(),
    skip: z.number().int().min(0).optional(),
    streak_freeze: z.number().int().min(0).optional(),
  }).optional(),
  giftPack: z.boolean().optional(),
  cardItemIds: z.array(z.string()).optional(),
  shopItemIds: z.array(z.string()).optional(),
  shopUnlockAll: z.array(z.enum(['avatar', 'pet', 'sound_theme', 'decor', 'home'])).optional(),
});
export type GiftBundle = z.infer<typeof GiftBundleSchema>;

export const WELCOME_GIFT_DEFAULT: GiftBundle = { coins: 500, xp: 100, giftPack: true };
```

- [ ] **Step 2: Write failing tests** `tests/unit/admin-actions.test.ts` (mock `@/lib/auth/guards` `assertAdmin`, `@/db` transaction, the grant primitives, `next/cache`). Cover:
  - `sendAdminGiftAction` rejects when `assertAdmin` throws (non-admin).
  - A bundle `{coins:500, xp:100, shards:2, giftPack:true}` calls `awardCoins(..., 'admin_adjust')`, `awardXp(..., 'admin_grant')`, `grantShardsInTx`, the gift-pack helper, and writes ONE `admin_grants` row whose `result` records the concrete grants.
  - `shopUnlockAll: ['decor']` expands to every decor `shop_items` id and grants each (skipping already-owned), recording only the newly-owned ids in `result`.
  - `undoAdminGiftAction` reverses a recorded `result` (negated coins/xp/shards, removed cards, revoked newly-owned shop items), sets `undone_at`, and rejects a second undo (`undone_at` already set).

(Write full mock-based assertions in the repo's action-test style — see `tests/unit/gacha-actions.test.ts` / `pull-card-for-child.test.ts`.)

- [ ] **Step 3: Implement `src/lib/actions/admin.ts`** (`'use server'`). Read helpers:
```ts
'use server';
import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/auth/guards';
import { GiftBundleSchema, type GiftBundle } from '@/lib/admin/bundle';
// + db imports
```
- `listAllChildrenForAdminAction()` → `await assertAdmin()`; returns every child joined to its parent's email (id, displayName, gender, parentEmail).
- `getChildAdminSummaryAction(childId)` → `assertAdmin`; returns `{ coins, xp, shards, ownedCount }` via existing reads (`getCoinBalance`, `getChildXp`, `getGlobalShards`, a collection count).
- `sendAdminGiftAction(childId: string, bundleRaw: unknown)`:
  - `const admin = await assertAdmin();`
  - `const bundle = GiftBundleSchema.parse(bundleRaw);`
  - One `db.transaction`: apply coins (`awardCoins` reason `'admin_adjust'` — but call its in-tx form if it has one; else call after), xp (`awardXp` source `'admin_grant'`), shards, powerups, gift-pack (reuse `grantGiftPackInTx` admin/non-idempotent path → collect resolved card ids), specific cards (`grantSpecificCardInTx`), and shop items (`shopItemIds` + expand `shopUnlockAll` to ids from `shop_items` by kind → `applyShopItemOwnershipInTx`, record newly-owned). Build a `result` object recording concrete deltas + resolved/newly-owned ids. Insert ONE `admin_grants` row `{ adminUserId: admin.id, childId, bundle, result }`.
  - `revalidatePath('/admin')` + `revalidatePath('/play/${childId}')`.
  - Return `{ ok: true, result }`.
- `undoAdminGiftAction(grantId: string)`:
  - `await assertAdmin();` load the grant; if missing or `undoneAt != null` → return `{ ok: false, reason: 'not_undoable' }`.
  - One transaction: reverse `result` (negate coins/xp/shards via the same helpers with negative deltas; `removeCardInTx` for each granted/resolved card; `revokeShopItemInTx` for each newly-owned shop item; decrement powerups). Set `undoneAt = now()`.
  - revalidate; return `{ ok: true }`.

> `awardCoins`/`awardXp` may not have in-tx variants — if they open their own transaction, call them outside the gift transaction (sequentially, still inside the action) and record results; the `admin_grants` row write can stay in its own statement. Keep it correct over clever: the idempotency that matters is undo (guarded by `undoneAt`), not partial-failure atomicity of a hand-composed gift.

- [ ] **Step 4: Run tests — expect PASS. Commit.**
```bash
git add src/lib/admin/bundle.ts src/lib/actions/admin.ts tests/unit/admin-actions.test.ts
git commit -m "feat(admin): gift bundle schema + send/undo/read admin actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `/admin` route + dashboard link

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`
- Modify: `src/app/parent/(secured)/page.tsx`
- Test: `tests/unit/admin-route-guard.test.tsx` (optional — see Task 7 regression)

- [ ] **Step 1: `src/app/admin/layout.tsx`** — guard like the play layout:
```tsx
import { notFound } from 'next/navigation';
import { assertAdmin } from '@/lib/auth/guards';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await assertAdmin();
  } catch {
    notFound();
  }
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">{children}</main>;
}
```

- [ ] **Step 2: `src/app/admin/page.tsx`** — server component: fetch `listAllChildrenForAdminAction()`, render `<AdminChildPicker>` (Task 6). When a child is selected (via `?child=<id>` searchParam), also fetch `getChildAdminSummaryAction` + recent grants and render `<ChildStatePanel>`, `<ComposeGiftForm>`, `<GrantHistoryList>`. (Use a searchParam for selection so it's a simple server-driven flow; the form posts the bundle via the action.)

- [ ] **Step 3: Admin link on the parent dashboard.** In `src/app/parent/(secured)/page.tsx`, `assertParent()` already returns the user; render an `/admin` link **only when `parent.role === 'admin'`**:
```tsx
{parent.role === 'admin' && (
  <Link href="/admin" className="...">🛠️ Admin console / 管理后台 →</Link>
)}
```

- [ ] **Step 4: Verify gate + commit.**
```bash
git add src/app/admin src/app/parent/\(secured\)/page.tsx
git commit -m "feat(admin): /admin route (assertAdmin-guarded) + dashboard link

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Console UI components

**Files:**
- Create: `src/components/admin/{AdminChildPicker,ChildStatePanel,ComposeGiftForm,GrantHistoryList}.tsx`
- Test: `tests/unit/compose-gift-form.test.tsx`

- [ ] **Step 1: `AdminChildPicker`** (server-rendered list; each child is a `<Link href="/admin?child=<id>">` showing name + parentEmail + gender). Highlights the selected child.

- [ ] **Step 2: `ChildStatePanel`** — read-only `🪙 coins · ⭐ xp · 🔹 shards · 🎴 owned` for the selected child (props from `getChildAdminSummaryAction`).

- [ ] **Step 3: `ComposeGiftForm`** (`'use client'`) — controlled form seeded from `WELCOME_GIFT_DEFAULT`:
  - number inputs: coins (allow negative), xp, shards
  - powerup counts: hint / skip / streak_freeze
  - gift-pack checkbox
  - card multi-select (props: catalog list of `{itemId, label}`) 
  - shop multi-select grouped by category, each category with an "unlock all" checkbox that, when checked, disables the per-item picks and sends the category in `shopUnlockAll`
  - a **confirm dialog** before submit; on confirm call `sendAdminGiftAction(childId, bundle)`; show a result summary toast.
  - Write the test first: `tests/unit/compose-gift-form.test.tsx` asserts the form renders pre-filled with the welcome default (coins 500, xp 100, gift-pack checked) and that toggling a category "unlock all" includes that category in the submitted bundle (mock the action).

- [ ] **Step 4: `GrantHistoryList`** — recent `admin_grants` for the selected child; each row shows a summary + an **撤销 / Undo** button (calls `undoAdminGiftAction(grantId)`); disabled + greyed when `undoneAt` is set.

- [ ] **Step 5: Run the form test — expect PASS. Commit.**
```bash
git add src/components/admin tests/unit/compose-gift-form.test.tsx
git commit -m "feat(admin): console UI (child picker, state panel, compose-gift form, history+undo)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Regression + final gate + PR

**Files:**
- Test: extend `tests/unit/distribution-isolation-guard.test.ts` (or a new `tests/unit/admin-access-guard.test.ts`)

- [ ] **Step 1: Add an access-guard test** asserting `sendAdminGiftAction` and `undoAdminGiftAction` reject a non-admin caller (mock `assertAdmin` to throw `ForbiddenError`; expect rejection). This locks in that the cross-account path is admin-only.

- [ ] **Step 2: Full four-green gate.**
Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. (`pnpm build` runs `scripts/migrate.ts` against prod first — migration 0031 will apply; it's additive (a new table), harmless before deploy per the established build-applies-migrations behavior.)

- [ ] **Step 3: Open the PR** (SSH push). Body summarizes: assertAdmin, /admin console, grant/undo, the `admin_grants` table (migration 0031), and the post-merge op.

- [ ] **Step 4: Post-merge op** (document in the PR): `pnpm tsx scripts/set-admin-role.ts banbanhu4ever@gmail.com` to promote Ban Ban.

---

## Self-Review Notes
- **Spec coverage:** assertAdmin (T1), table+migration (T2), grant/inverse primitives (T3), bundle+send+undo+reads (T4), route+link (T5), UI (T6), regression+gate (T7). ✅
- **Migration count:** 1 (`admin_grants`); `coin_reason` reuses `admin_adjust`, `xp_events.source` is text. ✅
- **Cross-account safety:** every admin action gates on `assertAdmin`; `/admin` layout guards rendering; T7 locks in non-admin rejection. The PR #112 guard test checks specific names and won't false-positive on the new admin file. ✅
- **Undo precision:** `result` records concrete deltas + newly-owned/resolved ids; undo reverses exactly those, clamped at 0 — never strips earned items. ✅
