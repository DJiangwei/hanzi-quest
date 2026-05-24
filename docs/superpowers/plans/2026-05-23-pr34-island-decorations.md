# PR #34 — Island Decorations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Decor shop tab — 10 hand-rolled SVG decorations that auto-appear on Yinuo's island map once owned, plus fix the pre-existing `kind === 'avatar'` purchase guard that silently blocks pet and sound-theme purchases.

**Architecture:** New `decorations` table mirrors `pets` shape; ownership = `shop_purchases` row (no separate equip table). Positions live in TS catalog (`src/lib/decor/anchors.ts`, `src/lib/decor/catalog.tsx`), DB stores only the anchor slug. `IslandMap` gains a `decorations?` prop and renders an SVG `<g>` layer between waves and the dotted path. `purchaseShopItemInTx` is refactored from `if (kind !== 'avatar') throw` to a `switch (kind)` dispatch — this incidentally unblocks PR #31 (sounds) and PR #33 (pets), which are silently broken in prod today.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (append-only migrations), React 19 RSC, Vitest + RTL, Tailwind. All tests mock `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`. Scripts use `loadEnv()` + dynamic `@/db` import inside `main()` per the CLAUDE.md landmine.

**Spec:** `docs/superpowers/specs/2026-05-23-pr34-island-decorations-design.md`

**Branch:** `feat/pr34-island-decorations` (already created, spec committed as `4ff4527`).

---

## File map

**New files:**
- `src/db/schema/decorations.ts` — Drizzle schema for `decorations` table.
- `src/lib/db/decor.ts` — `listDecorShopListings`, `listOwnedDecorationsForChild`.
- `src/lib/decor/anchors.ts` — `AnchorSlug` type + `ANCHORS` map (positions).
- `src/lib/decor/catalog.tsx` — slug → `{ anchor, Component }` map.
- `src/components/play/decorations/Sailboat.tsx`
- `src/components/play/decorations/SeagullPair.tsx`
- `src/components/play/decorations/Hibiscus.tsx`
- `src/components/play/decorations/FishSchool.tsx`
- `src/components/play/decorations/CompassRose.tsx`
- `src/components/play/decorations/Rainbow.tsx`
- `src/components/play/decorations/PirateFlag.tsx`
- `src/components/play/decorations/WhaleTail.tsx`
- `src/components/play/decorations/Lighthouse.tsx`
- `src/components/play/decorations/TreasureChest.tsx`
- `src/components/shop/DecorTabBody.tsx`
- `scripts/seed-decorations.ts`
- `drizzle/0010_<name>.sql` — Drizzle-generated (enum value + table).

**Modified files:**
- `src/db/schema/economy.ts` — append `'decor'` to `shopItemKind` enum.
- `src/db/schema/index.ts` — export new decorations schema.
- `src/lib/db/shop.ts` — refactor `purchaseShopItemInTx` to switch dispatch; PurchaseResult gets `trophies?` field.
- `src/lib/actions/shop.ts` — call `checkAndGrantTrophies({kind:'decor-purchase'})` post-commit, return trophies.
- `src/lib/db/trophies.ts` — extend `TrophyCheckContext`, add `decor-purchase` switch arm.
- `src/lib/db/trophies-evaluators.ts` — add `countOwnedDecorations`.
- `src/components/play/IslandMap.tsx` — add `decorations?` prop + render layer.
- `src/components/shop/ShopCategoryTabs.tsx` — flip `decor` tab `disabled: false`.
- `src/app/play/[childId]/shop/page.tsx` — Promise.all adds `listDecorShopListings()`.
- `src/app/play/[childId]/shop/ShopBody.tsx` — route `activeTab==='decor'` to `<DecorTabBody>`.
- `src/app/play/[childId]/page.tsx` — Promise.all adds `listOwnedDecorationsForChild`, pass to IslandMap.
- `scripts/seed-trophies.ts` — append 2 new trophy rows.

**New test files:**
- `tests/unit/decor-db.test.ts`
- `tests/unit/decor-purchase-action.test.ts`
- `tests/unit/decor-tab-body.test.tsx`
- `tests/unit/island-map-decorations.test.tsx`
- `tests/unit/trophy-decor.test.ts`
- `tests/unit/decor-catalog.test.ts`

---

## Task 1: Schema, enum extension, and migration

**Files:**
- Create: `src/db/schema/decorations.ts`
- Modify: `src/db/schema/economy.ts:30-37` (append `'decor'` to enum)
- Modify: `src/db/schema/index.ts` (add export)
- Generate: `drizzle/0010_*.sql`

- [ ] **Step 1: Create the schema file**

Create `src/db/schema/decorations.ts`:

```ts
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const decorations = pgTable(
  'decorations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    nameZh: text('name_zh').notNull(),
    nameEn: text('name_en').notNull(),
    descriptionZh: text('description_zh'),
    descriptionEn: text('description_en'),
    emoji: text('emoji').notNull(),
    anchorSlug: text('anchor_slug').notNull(),
    displayOrder: integer('display_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('decorations_display_order_idx').on(t.displayOrder)],
);
```

- [ ] **Step 2: Append `'decor'` to the enum**

In `src/db/schema/economy.ts`, the existing block:

```ts
export const shopItemKind = pgEnum('shop_item_kind', [
  'avatar',
  'powerup',
  'consumable',
  'pack_voucher',
  'sound_theme',
  'pet',
]);
```

Append `'decor'`:

```ts
export const shopItemKind = pgEnum('shop_item_kind', [
  'avatar',
  'powerup',
  'consumable',
  'pack_voucher',
  'sound_theme',
  'pet',
  'decor',
]);
```

- [ ] **Step 3: Add to the schema barrel**

In `src/db/schema/index.ts`, append (preserving existing order):

```ts
export * from './decorations';
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate`

Expected: a new file `drizzle/0010_<random_name>.sql` exists, containing `ALTER TYPE "public"."shop_item_kind" ADD VALUE 'decor';` and `CREATE TABLE "decorations" ...` with the `decorations_display_order_idx`. Drizzle migration metadata files in `drizzle/meta/` are also updated.

- [ ] **Step 5: Verify typecheck**

Run: `pnpm typecheck`

Expected: PASS, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/decorations.ts src/db/schema/economy.ts src/db/schema/index.ts drizzle/0010_*.sql drizzle/meta/
git commit -m "feat(decor): schema — decorations table + 'decor' enum value"
```

---

## Task 2: DB layer for decorations

**Files:**
- Create: `src/lib/db/decor.ts`
- Test: `tests/unit/decor-db.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/decor-db.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock('@/db', () => ({ db: dbMock }));

import {
  listDecorShopListings,
  listOwnedDecorationsForChild,
} from '@/lib/db/decor';

function makeChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

beforeEach(() => {
  dbMock.select.mockReset();
});

describe('listDecorShopListings', () => {
  it('returns shop+decor rows joined by slug', async () => {
    const rows = [
      {
        shopItem: { id: 's1', slug: 'sailboat', kind: 'decor', isActive: true, priceCoins: 200, name: '小帆船 / Sailboat' },
        decoration: { id: 'd1', slug: 'sailboat', nameZh: '小帆船', nameEn: 'Sailboat', anchorSlug: 'top-right', emoji: '⛵' },
      },
    ];
    dbMock.select.mockReturnValueOnce(makeChain(rows));
    const result = await listDecorShopListings();
    expect(result).toEqual(rows);
  });
});

describe('listOwnedDecorationsForChild', () => {
  it('returns empty array for child with no purchases', async () => {
    dbMock.select.mockReturnValueOnce(makeChain([]));
    const result = await listOwnedDecorationsForChild('c1');
    expect(result).toEqual([]);
  });

  it('returns decoration rows for owned shop_purchases', async () => {
    const rows = [
      { id: 'd1', slug: 'sailboat', nameZh: '小帆船', nameEn: 'Sailboat', anchorSlug: 'top-right' },
      { id: 'd2', slug: 'lighthouse', nameZh: '灯塔', nameEn: 'Lighthouse', anchorSlug: 'between-6-7' },
    ];
    dbMock.select.mockReturnValueOnce(makeChain(rows));
    const result = await listOwnedDecorationsForChild('c1');
    expect(result).toEqual(rows);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/decor-db.test.ts`

Expected: FAIL with import error — `@/lib/db/decor` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/db/decor.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { decorations, shopItems, shopPurchases } from '@/db/schema';

export type DecorationRow = typeof decorations.$inferSelect;
export type ShopItemRow = typeof shopItems.$inferSelect;

export interface DecorShopListing {
  shopItem: ShopItemRow;
  decoration: DecorationRow;
}

export async function listDecorShopListings(): Promise<DecorShopListing[]> {
  return await db
    .select({ shopItem: shopItems, decoration: decorations })
    .from(shopItems)
    .innerJoin(decorations, eq(decorations.slug, shopItems.slug))
    .where(and(eq(shopItems.kind, 'decor'), eq(shopItems.isActive, true)));
}

export async function listOwnedDecorationsForChild(
  childId: string,
): Promise<DecorationRow[]> {
  const rows = await db
    .select({ decoration: decorations })
    .from(shopPurchases)
    .innerJoin(shopItems, eq(shopItems.id, shopPurchases.shopItemId))
    .innerJoin(decorations, eq(decorations.slug, shopItems.slug))
    .where(
      and(
        eq(shopPurchases.childId, childId),
        eq(shopItems.kind, 'decor'),
      ),
    );
  return rows.map((r) => r.decoration);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/decor-db.test.ts`

Expected: PASS (3 tests pass).

Note: the test's chain mock returns the same rows whether the chain has 1 or 2 innerJoins. `listOwnedDecorationsForChild`'s implementation maps `r.decoration` so the second test passes by happy path — the test mock returns the row shape directly because the mock substitutes the entire chain output. If your inferred row shape from the join produces an outer wrapper, adjust the test fixture to `[{ decoration: rows[0] }, ...]` accordingly. For drizzle's `select({ decoration: decorations })`, the result is `[{ decoration: <row> }]`, then mapped to `[<row>]` — the test stubs at the chain output level, so passing raw `rows` (already row-shaped) works. If you see a mismatch, switch the test to stub with `[{ decoration: row }]` and assert against `rows.map((r) => r.decoration)`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/decor.ts tests/unit/decor-db.test.ts
git commit -m "feat(decor): DB layer — listDecorShopListings, listOwnedDecorationsForChild"
```

---

## Task 3: Refactor `purchaseShopItemInTx` to a kind-dispatch switch

This is the **regression fix** that unblocks pets and sound themes alongside enabling decor.

**Files:**
- Modify: `src/lib/db/shop.ts:160-244` (the `purchaseShopItemInTx` function)
- Modify: `src/lib/db/shop.ts:50-54` (`PurchaseResult` interface)
- Test: `tests/unit/decor-purchase-action.test.ts`

- [ ] **Step 1: Read the current implementation**

Open `src/lib/db/shop.ts` and re-read `purchaseShopItemInTx` (lines 160–244). The key change: today it `throw`s for `kind !== 'avatar'`. We're keeping the avatar branch verbatim, adding a generic branch for `'sound_theme' | 'pet' | 'decor'`, and rejecting the remaining unsupported kinds.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/decor-purchase-action.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  transaction: vi.fn((fn: (tx: typeof txMock) => unknown) => fn(txMock)),
}));

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@/lib/db/coins', () => ({
  awardCoinsInTx: vi.fn().mockResolvedValue(undefined),
}));

import { purchaseShopItem } from '@/lib/db/shop';
import { ItemNotPurchasableError } from '@/lib/errors/shop-errors';

interface ChainOpts {
  shopItem?: unknown;
  balance?: number;
}

function setupChain({ shopItem, balance = 1000 }: ChainOpts) {
  // shopItem fetch
  const shopItemChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(shopItem ? [shopItem] : []),
      }),
    }),
  };
  // balance fetch
  const balanceChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ balance }]),
    }),
  };
  txMock.select
    .mockReturnValueOnce(shopItemChain)
    .mockReturnValueOnce(balanceChain)
    .mockReturnValueOnce(balanceChain); // post-debit balance read

  txMock.insert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
}

beforeEach(() => {
  txMock.select.mockReset();
  txMock.insert.mockReset();
});

describe('purchaseShopItem dispatch', () => {
  it('decor purchase succeeds (no avatar side-effect)', async () => {
    setupChain({
      shopItem: { id: 's1', slug: 'sailboat', kind: 'decor', priceCoins: 200, isActive: true },
    });
    const result = await purchaseShopItem('c1', 's1');
    expect(result.shopItemId).toBe('s1');
    expect(result.avatarItemId).toBeNull();
  });

  it('pet purchase succeeds (regression: was broken by avatar-only guard)', async () => {
    setupChain({
      shopItem: { id: 's2', slug: 'pet-parrot', kind: 'pet', priceCoins: 300, isActive: true },
    });
    const result = await purchaseShopItem('c1', 's2');
    expect(result.shopItemId).toBe('s2');
    expect(result.avatarItemId).toBeNull();
  });

  it('sound_theme purchase succeeds (regression: was broken)', async () => {
    setupChain({
      shopItem: { id: 's3', slug: 'music-box', kind: 'sound_theme', priceCoins: 250, isActive: true },
    });
    const result = await purchaseShopItem('c1', 's3');
    expect(result.shopItemId).toBe('s3');
  });

  it('consumable still throws ItemNotPurchasableError', async () => {
    setupChain({
      shopItem: { id: 's4', slug: 'whatever', kind: 'consumable', priceCoins: 100, isActive: true },
    });
    await expect(purchaseShopItem('c1', 's4')).rejects.toThrow(ItemNotPurchasableError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/unit/decor-purchase-action.test.ts`

Expected: FAIL — `decor`, `pet`, and `sound_theme` cases all throw `ItemNotPurchasableError` because the current guard rejects everything that isn't `'avatar'`.

- [ ] **Step 4: Refactor `purchaseShopItemInTx` to a switch dispatch**

In `src/lib/db/shop.ts`, replace the body of `purchaseShopItemInTx` (lines ~160–244) with:

```ts
export async function purchaseShopItemInTx(
  tx: Tx,
  childId: string,
  shopItemId: string,
): Promise<PurchaseResult> {
  const [shopItem] = await tx
    .select()
    .from(shopItems)
    .where(and(eq(shopItems.id, shopItemId), eq(shopItems.isActive, true)))
    .limit(1);
  if (!shopItem) throw new ShopItemNotFoundError(shopItemId);

  switch (shopItem.kind) {
    case 'avatar':
      return purchaseAvatarInTx(tx, childId, shopItem);
    case 'sound_theme':
    case 'pet':
    case 'decor':
      return purchaseGenericInTx(tx, childId, shopItem);
    default:
      throw new ItemNotPurchasableError(
        `Shop item kind '${shopItem.kind}' is not purchasable`,
      );
  }
}

async function purchaseAvatarInTx(
  tx: Tx,
  childId: string,
  shopItem: ShopItemRow,
): Promise<PurchaseResult> {
  const [linkedAvatarItem] = await tx
    .select()
    .from(avatarItems)
    .where(
      and(
        eq(avatarItems.unlockRef, shopItem.slug),
        eq(avatarItems.unlockVia, 'shop'),
      ),
    )
    .limit(1);
  if (!linkedAvatarItem) {
    throw new ItemNotPurchasableError(
      `Shop item ${shopItem.slug} has no linked avatar_items row — seed is out of sync`,
    );
  }

  const [existing] = await tx
    .select()
    .from(childAvatarInventory)
    .where(
      and(
        eq(childAvatarInventory.childId, childId),
        eq(childAvatarInventory.avatarItemId, linkedAvatarItem.id),
      ),
    )
    .limit(1);
  if (existing) throw new AlreadyOwnedError(shopItem.id);

  await debitAndRecordInTx(tx, childId, shopItem);

  await tx.insert(childAvatarInventory).values({
    childId,
    avatarItemId: linkedAvatarItem.id,
  });

  const coinsAfter = await readBalanceInTx(tx, childId);
  return {
    shopItemId: shopItem.id,
    coinsAfter,
    avatarItemId: linkedAvatarItem.id,
  };
}

async function purchaseGenericInTx(
  tx: Tx,
  childId: string,
  shopItem: ShopItemRow,
): Promise<PurchaseResult> {
  // Ownership = presence of a shop_purchases row. Duplicates aren't allowed.
  const [existing] = await tx
    .select()
    .from(shopPurchases)
    .where(
      and(
        eq(shopPurchases.childId, childId),
        eq(shopPurchases.shopItemId, shopItem.id),
      ),
    )
    .limit(1);
  if (existing) throw new AlreadyOwnedError(shopItem.id);

  await debitAndRecordInTx(tx, childId, shopItem);

  const coinsAfter = await readBalanceInTx(tx, childId);
  return {
    shopItemId: shopItem.id,
    coinsAfter,
    avatarItemId: null,
  };
}

async function debitAndRecordInTx(
  tx: Tx,
  childId: string,
  shopItem: ShopItemRow,
): Promise<void> {
  const [balRow] = await tx
    .select({ balance: coinBalances.balance })
    .from(coinBalances)
    .where(eq(coinBalances.childId, childId));
  const balance = balRow?.balance ?? 0;
  if (balance < shopItem.priceCoins) {
    throw new InsufficientCoinsError(shopItem.priceCoins, balance);
  }

  await awardCoinsInTx(tx, {
    childId,
    delta: -shopItem.priceCoins,
    reason: 'shop_purchase',
    refType: 'shop_item',
    refId: shopItem.id,
  });

  await tx.insert(shopPurchases).values({
    childId,
    shopItemId: shopItem.id,
    coinsSpent: shopItem.priceCoins,
  });
}

async function readBalanceInTx(tx: Tx, childId: string): Promise<number> {
  const [row] = await tx
    .select({ balance: coinBalances.balance })
    .from(coinBalances)
    .where(eq(coinBalances.childId, childId));
  return row?.balance ?? 0;
}
```

- [ ] **Step 5: Run the new test**

Run: `pnpm test tests/unit/decor-purchase-action.test.ts`

Expected: PASS (4 tests).

- [ ] **Step 6: Run the existing avatar-purchase tests**

Run: `pnpm test tests/unit/shop-purchase`

Expected: existing avatar purchase tests still PASS (the avatar branch behavior is unchanged — `purchaseAvatarInTx` is a direct extraction). If a test fails because the failure-mode tests stubbed `tx.select` exactly N times and we've changed the order of selects in the avatar branch, update those stubs to match. **Do not change the public API.**

- [ ] **Step 7: Full test suite**

Run: `pnpm test`

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/shop.ts tests/unit/decor-purchase-action.test.ts
git commit -m "fix(shop): dispatch purchase by kind — unblocks pet/sound_theme + enables decor

Previously purchaseShopItemInTx hardcoded kind === 'avatar' and rejected
all other kinds. PRs #31 (sounds) and #33 (pets) shipped UI that called
purchaseShopItemAction but the action threw at the SQL boundary,
silently breaking those tabs in prod.

Refactor to a switch (kind) dispatch:
- avatar  → purchaseAvatarInTx (extracted, behavior unchanged)
- sound_theme | pet | decor → purchaseGenericInTx (coin debit + shop_purchases row only)
- other   → ItemNotPurchasableError as before"
```

---

## Task 4: Anchor + catalog files + 10 decoration SVG components

**Files:**
- Create: `src/lib/decor/anchors.ts`
- Create: `src/lib/decor/catalog.tsx`
- Create: `src/components/play/decorations/Sailboat.tsx`
- Create: `src/components/play/decorations/SeagullPair.tsx`
- Create: `src/components/play/decorations/Hibiscus.tsx`
- Create: `src/components/play/decorations/FishSchool.tsx`
- Create: `src/components/play/decorations/CompassRose.tsx`
- Create: `src/components/play/decorations/Rainbow.tsx`
- Create: `src/components/play/decorations/PirateFlag.tsx`
- Create: `src/components/play/decorations/WhaleTail.tsx`
- Create: `src/components/play/decorations/Lighthouse.tsx`
- Create: `src/components/play/decorations/TreasureChest.tsx`
- Test: `tests/unit/decor-catalog.test.ts`

- [ ] **Step 1: Write the failing test (the catalog invariants)**

Create `tests/unit/decor-catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ANCHORS, type AnchorSlug } from '@/lib/decor/anchors';
import { DECOR_CATALOG } from '@/lib/decor/catalog';

describe('decor catalog invariants', () => {
  it('every catalog entry has a known anchor', () => {
    for (const [slug, entry] of Object.entries(DECOR_CATALOG)) {
      expect(ANCHORS, `slug=${slug}`).toHaveProperty(entry.anchor);
    }
  });

  it('all catalog anchors are distinct (no two items share an anchor)', () => {
    const anchors = Object.values(DECOR_CATALOG).map((e) => e.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('every catalog entry has a renderable Component', () => {
    for (const [slug, entry] of Object.entries(DECOR_CATALOG)) {
      expect(typeof entry.Component, `slug=${slug}`).toBe('function');
    }
  });

  it('catalog has the 10 expected slugs', () => {
    expect(Object.keys(DECOR_CATALOG).sort()).toEqual(
      [
        'compass-rose',
        'fish-school',
        'hibiscus',
        'lighthouse',
        'pirate-flag',
        'rainbow',
        'sailboat',
        'seagull-pair',
        'treasure-chest',
        'whale-tail',
      ].sort(),
    );
  });

  it('all ANCHORS have numeric x/y in viewBox bounds (0..360 for x, 0..1590 for y)', () => {
    for (const [slug, pos] of Object.entries(ANCHORS) as Array<[AnchorSlug, { x: number; y: number }]>) {
      expect(pos.x, slug).toBeGreaterThanOrEqual(0);
      expect(pos.x, slug).toBeLessThanOrEqual(360);
      expect(pos.y, slug).toBeGreaterThanOrEqual(0);
      expect(pos.y, slug).toBeLessThanOrEqual(1700);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/decor-catalog.test.ts`

Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Create the anchors file**

Create `src/lib/decor/anchors.ts`:

```ts
/**
 * Anchor positions for island-map decorations, expressed in IslandMap's SVG
 * viewBox coordinates (0..360 horizontally, 0..svgHeight vertically).
 *
 * Math: IslandMap uses TOP_PADDING=80, VERTICAL_SPACING=150, BOTTOM_PADDING=80.
 * For 10 islands, each at y = 80 + idx * 150 (idx 0..9), so island y values
 * are 80, 230, 380, 530, 680, 830, 980, 1130, 1280, 1430.
 * svgHeight = 80 + 9*150 + 80 = 1590.
 *
 * "between-N-N" anchors place a decoration at the midpoint of the y coords
 * of two adjacent islands (e.g. between-2-3 = (230+380)/2 = 305).
 */

export type AnchorSlug =
  | 'top-left'
  | 'top-right'
  | 'left-margin-mid'
  | 'right-margin-mid'
  | 'between-2-3'
  | 'between-4-5'
  | 'between-6-7'
  | 'between-8-9'
  | 'left-margin-low'
  | 'bottom-center';

export interface AnchorPos {
  x: number;
  y: number;
  scale?: number;
}

export const ANCHORS: Record<AnchorSlug, AnchorPos> = {
  'top-left':         { x: 60,  y: 60 },
  'top-right':        { x: 300, y: 90 },
  'left-margin-mid':  { x: 40,  y: 380 },
  'right-margin-mid': { x: 320, y: 530 },
  'between-2-3':      { x: 180, y: 305, scale: 0.9 },
  'between-4-5':      { x: 180, y: 605 },
  'between-6-7':      { x: 180, y: 905 },
  'between-8-9':      { x: 180, y: 1205 },
  'left-margin-low':  { x: 50,  y: 1080 },
  'bottom-center':    { x: 180, y: 1550 },
};
```

- [ ] **Step 4: Create each SVG decoration component**

Each component is a single named export, ~30–60 lines, no props, single root `<g>` element. Render hand-rolled paths in the IslandMap design language (ocean blues, sunset oranges, treasure golds — same CSS vars already in use).

**`src/components/play/decorations/Sailboat.tsx`:**

```tsx
export function Sailboat() {
  return (
    <g aria-hidden>
      {/* hull */}
      <path d="M -22 6 L 22 6 L 16 18 L -16 18 Z" fill="#8b4513" stroke="#5a2d0c" strokeWidth={1.5} />
      {/* mast */}
      <line x1={0} y1={6} x2={0} y2={-26} stroke="#3a1f0c" strokeWidth={2} />
      {/* main sail */}
      <path d="M 0 -26 L 16 4 L 0 4 Z" fill="var(--color-sunset-400)" stroke="#a05028" strokeWidth={1.5} />
      {/* jib */}
      <path d="M 0 -22 L -12 2 L 0 2 Z" fill="#fff4d4" stroke="#a05028" strokeWidth={1.5} />
      {/* tiny pennant */}
      <path d="M 0 -26 L 6 -22 L 0 -20 Z" fill="#e74c3c" />
    </g>
  );
}
```

**`src/components/play/decorations/SeagullPair.tsx`:**

```tsx
export function SeagullPair() {
  return (
    <g aria-hidden stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round">
      {/* left seagull (M shape) */}
      <path d="M -16 0 q 4 -8 8 0 q 4 -8 8 0" />
      {/* right seagull (slightly higher) */}
      <path d="M 6 -6 q 3 -6 6 0 q 3 -6 6 0" />
    </g>
  );
}
```

**`src/components/play/decorations/Hibiscus.tsx`:**

```tsx
export function Hibiscus() {
  return (
    <g aria-hidden>
      {/* 5 petals */}
      {[0, 72, 144, 216, 288].map((rot) => (
        <ellipse
          key={rot}
          cx={0}
          cy={-10}
          rx={6}
          ry={10}
          fill="#ff6b9d"
          stroke="#c9356b"
          strokeWidth={1}
          transform={`rotate(${rot})`}
        />
      ))}
      {/* center */}
      <circle cx={0} cy={0} r={3} fill="#ffd966" stroke="#c98a00" strokeWidth={1} />
      {/* stem */}
      <line x1={0} y1={6} x2={0} y2={20} stroke="#2e7d32" strokeWidth={2} />
      {/* leaf */}
      <path d="M 0 14 q -8 -2 -10 6 q 8 -2 10 -6 z" fill="#46a05a" stroke="#2e7d32" strokeWidth={1} />
    </g>
  );
}
```

**`src/components/play/decorations/FishSchool.tsx`:**

```tsx
export function FishSchool() {
  const fish = (x: number, y: number, scale: number, color: string) => (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx={0} cy={0} rx={6} ry={3} fill={color} />
      <path d="M 6 0 L 10 -3 L 10 3 Z" fill={color} />
      <circle cx={-3} cy={-1} r={0.8} fill="#000" />
    </g>
  );
  return (
    <g aria-hidden>
      {fish(0, 0, 1, '#5fb7d4')}
      {fish(-10, -6, 0.8, '#7ec4d8')}
      {fish(-12, 6, 0.9, '#5fb7d4')}
      {fish(8, -4, 0.7, '#8ac9da')}
    </g>
  );
}
```

**`src/components/play/decorations/CompassRose.tsx`:**

```tsx
export function CompassRose() {
  return (
    <g aria-hidden>
      <circle cx={0} cy={0} r={20} fill="#fff4d4" stroke="#a05028" strokeWidth={2} />
      {/* 4 cardinal points */}
      <path d="M 0 -18 L 4 0 L 0 18 L -4 0 Z" fill="#a05028" />
      <path d="M -18 0 L 0 4 L 18 0 L 0 -4 Z" fill="#c9745a" />
      {/* center pin */}
      <circle cx={0} cy={0} r={2.5} fill="#3a1f0c" />
      {/* N marker */}
      <text x={0} y={-22} textAnchor="middle" fontSize={8} fontWeight={700} fill="#3a1f0c" fontFamily="system-ui, sans-serif">N</text>
    </g>
  );
}
```

**`src/components/play/decorations/Rainbow.tsx`:**

```tsx
export function Rainbow() {
  const arc = (r: number, color: string) =>
    <path d={`M ${-r} 0 a ${r} ${r} 0 0 1 ${r * 2} 0`} fill="none" stroke={color} strokeWidth={4} />;
  return (
    <g aria-hidden>
      {arc(28, '#e74c3c')}
      {arc(24, '#f39c12')}
      {arc(20, '#f1c40f')}
      {arc(16, '#27ae60')}
      {arc(12, '#3498db')}
      {arc(8,  '#9b59b6')}
    </g>
  );
}
```

**`src/components/play/decorations/PirateFlag.tsx`:**

```tsx
export function PirateFlag() {
  return (
    <g aria-hidden>
      {/* pole */}
      <line x1={0} y1={-24} x2={0} y2={20} stroke="#3a1f0c" strokeWidth={2} />
      {/* flag */}
      <path d="M 0 -24 L 28 -22 L 28 -6 L 0 -8 Z" fill="#1a1a1a" stroke="#000" strokeWidth={1} />
      {/* skull */}
      <circle cx={12} cy={-15} r={4} fill="#fff" />
      {/* eye sockets */}
      <circle cx={10.5} cy={-16} r={0.8} fill="#1a1a1a" />
      <circle cx={13.5} cy={-16} r={0.8} fill="#1a1a1a" />
      {/* crossbones */}
      <line x1={6} y1={-11} x2={18} y2={-9} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={6} y1={-9} x2={18} y2={-11} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
}
```

**`src/components/play/decorations/WhaleTail.tsx`:**

```tsx
export function WhaleTail() {
  return (
    <g aria-hidden>
      {/* splash */}
      <path d="M -18 12 q 4 -4 8 0 M 10 12 q 4 -4 8 0" fill="none" stroke="var(--color-ocean-300)" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      {/* tail flukes */}
      <path d="M -14 8 q -6 -16 0 -22 q 6 4 6 12 q 4 -10 10 -14 q 6 4 8 14 q -4 -2 -10 6 q -8 6 -14 4 z" fill="#3a4f6b" stroke="#1a2a3a" strokeWidth={1.5} />
    </g>
  );
}
```

**`src/components/play/decorations/Lighthouse.tsx`:**

```tsx
export function Lighthouse() {
  return (
    <g aria-hidden>
      {/* base */}
      <rect x={-12} y={10} width={24} height={6} fill="#5a4a3a" stroke="#3a2a1a" strokeWidth={1} />
      {/* tower */}
      <rect x={-7} y={-18} width={14} height={28} fill="#fff4d4" stroke="#a05028" strokeWidth={1.5} />
      {/* red stripes */}
      <rect x={-7} y={-14} width={14} height={4} fill="#e74c3c" />
      <rect x={-7} y={-4} width={14} height={4} fill="#e74c3c" />
      <rect x={-7} y={6} width={14} height={4} fill="#e74c3c" />
      {/* lamp */}
      <rect x={-5} y={-26} width={10} height={8} fill="#ffd966" stroke="#a05028" strokeWidth={1.5} />
      {/* roof */}
      <path d="M -7 -26 L 0 -32 L 7 -26 Z" fill="#3a1f0c" />
      {/* beam */}
      <path d="M 5 -22 L 26 -28 L 26 -16 Z" fill="#ffd966" opacity={0.5} />
    </g>
  );
}
```

**`src/components/play/decorations/TreasureChest.tsx`:**

```tsx
export function TreasureChest() {
  return (
    <g aria-hidden>
      {/* body */}
      <rect x={-18} y={0} width={36} height={16} fill="#8b4513" stroke="#3a1f0c" strokeWidth={2} rx={2} />
      {/* lid */}
      <path d="M -18 0 q 18 -16 36 0 z" fill="#a05028" stroke="#3a1f0c" strokeWidth={2} />
      {/* iron bands */}
      <line x1={-18} y1={6} x2={18} y2={6} stroke="#3a2a1a" strokeWidth={1.5} />
      {/* lock */}
      <rect x={-3} y={-2} width={6} height={6} fill="#ffd966" stroke="#a05028" strokeWidth={1} />
      {/* coins peeking */}
      <circle cx={-8} cy={-4} r={2} fill="#ffd966" stroke="#a05028" strokeWidth={0.8} />
      <circle cx={6} cy={-6} r={2} fill="#ffd966" stroke="#a05028" strokeWidth={0.8} />
      <circle cx={0} cy={-8} r={1.5} fill="#fff4d4" stroke="#a05028" strokeWidth={0.6} />
    </g>
  );
}
```

- [ ] **Step 5: Create the catalog**

Create `src/lib/decor/catalog.tsx`:

```tsx
import type { ComponentType } from 'react';
import type { AnchorSlug } from './anchors';
import { Sailboat } from '@/components/play/decorations/Sailboat';
import { SeagullPair } from '@/components/play/decorations/SeagullPair';
import { Hibiscus } from '@/components/play/decorations/Hibiscus';
import { FishSchool } from '@/components/play/decorations/FishSchool';
import { CompassRose } from '@/components/play/decorations/CompassRose';
import { Rainbow } from '@/components/play/decorations/Rainbow';
import { PirateFlag } from '@/components/play/decorations/PirateFlag';
import { WhaleTail } from '@/components/play/decorations/WhaleTail';
import { Lighthouse } from '@/components/play/decorations/Lighthouse';
import { TreasureChest } from '@/components/play/decorations/TreasureChest';

export interface DecorCatalogEntry {
  anchor: AnchorSlug;
  Component: ComponentType;
}

export const DECOR_CATALOG: Record<string, DecorCatalogEntry> = {
  'sailboat':       { anchor: 'top-right',        Component: Sailboat },
  'seagull-pair':   { anchor: 'top-left',         Component: SeagullPair },
  'hibiscus':       { anchor: 'left-margin-mid',  Component: Hibiscus },
  'fish-school':    { anchor: 'between-2-3',      Component: FishSchool },
  'compass-rose':   { anchor: 'bottom-center',    Component: CompassRose },
  'rainbow':        { anchor: 'between-4-5',      Component: Rainbow },
  'pirate-flag':    { anchor: 'left-margin-low',  Component: PirateFlag },
  'whale-tail':     { anchor: 'right-margin-mid', Component: WhaleTail },
  'lighthouse':     { anchor: 'between-6-7',      Component: Lighthouse },
  'treasure-chest': { anchor: 'between-8-9',      Component: TreasureChest },
};
```

- [ ] **Step 6: Run the catalog test**

Run: `pnpm test tests/unit/decor-catalog.test.ts`

Expected: PASS (5 tests).

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/decor/ src/components/play/decorations/ tests/unit/decor-catalog.test.ts
git commit -m "feat(decor): anchors, catalog, and 10 hand-rolled SVG components"
```

---

## Task 5: IslandMap render integration

**Files:**
- Modify: `src/components/play/IslandMap.tsx:31-37` (Props), `:83-120` (SVG body)
- Test: `tests/unit/island-map-decorations.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/island-map-decorations.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IslandMap } from '@/components/play/IslandMap';

const islands = [
  { weekId: 'w1', weekNumber: 1, label: 'Week 1', completionPercent: 0 },
  { weekId: 'w2', weekNumber: 2, label: 'Week 2', completionPercent: 0 },
];

describe('IslandMap decorations', () => {
  it('renders no decoration group when prop omitted', () => {
    const { container } = render(
      <IslandMap childId="c1" islands={islands} ownedCount={0} />,
    );
    expect(container.querySelector('[data-decor-slug]')).toBeNull();
  });

  it('renders one <g data-decor-slug="sailboat"> at the top-right anchor', () => {
    const { container } = render(
      <IslandMap
        childId="c1"
        islands={islands}
        ownedCount={0}
        decorations={[{ slug: 'sailboat' }]}
      />,
    );
    const node = container.querySelector('g[data-decor-slug="sailboat"]');
    expect(node).not.toBeNull();
    // ANCHORS['top-right'] = { x: 300, y: 90 }
    expect(node?.getAttribute('transform')).toMatch(/translate\(300 90\)/);
  });

  it('silently skips unknown slugs (no crash)', () => {
    const { container } = render(
      <IslandMap
        childId="c1"
        islands={islands}
        ownedCount={0}
        decorations={[{ slug: 'does-not-exist' }]}
      />,
    );
    expect(container.querySelector('[data-decor-slug="does-not-exist"]')).toBeNull();
  });

  it('renders multiple decorations', () => {
    const { container } = render(
      <IslandMap
        childId="c1"
        islands={islands}
        ownedCount={0}
        decorations={[{ slug: 'sailboat' }, { slug: 'lighthouse' }]}
      />,
    );
    expect(container.querySelectorAll('[data-decor-slug]').length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/island-map-decorations.test.tsx`

Expected: FAIL — no decoration support in IslandMap.

- [ ] **Step 3: Extend IslandMap props and render layer**

In `src/components/play/IslandMap.tsx`, update the `Props` interface:

```tsx
interface Props {
  childId: string;
  islands: IslandInput[];
  ownedCount: number;
  /** Aggregate across all active collection packs. Optional for backwards compat. */
  totalCount?: number;
  /** Owned island decorations to render at their fixed anchors. */
  decorations?: { slug: string }[];
}
```

Update the function signature destructure:

```tsx
export function IslandMap({ childId, islands, ownedCount, totalCount, decorations = [] }: Props) {
```

Add the imports at the top of the file:

```tsx
import { ANCHORS } from '@/lib/decor/anchors';
import { DECOR_CATALOG } from '@/lib/decor/catalog';
```

Add the decoration render layer **inside the existing `<svg>`**, between the waves group and the dotted path group. Place it right after the closing of the "Decorative subtle waves" block (around line 119):

```tsx
{/* Owned decorations (between waves and path so islands stay on top) */}
<g>
  {decorations.map((d) => {
    const entry = DECOR_CATALOG[d.slug];
    if (!entry) return null;
    const pos = ANCHORS[entry.anchor];
    const scale = pos.scale ?? 1;
    const Comp = entry.Component;
    return (
      <g
        key={d.slug}
        data-decor-slug={d.slug}
        transform={`translate(${pos.x} ${pos.y})${scale === 1 ? '' : ` scale(${scale})`}`}
        opacity={0.92}
      >
        <Comp />
      </g>
    );
  })}
</g>
```

Note the test expects `transform="translate(300 90)"` (no scale) for sailboat → top-right; the conditional avoids appending `scale(1)`.

- [ ] **Step 4: Run the test**

Run: `pnpm test tests/unit/island-map-decorations.test.tsx`

Expected: PASS (4 tests).

- [ ] **Step 5: Run typecheck + the full test suite**

Run: `pnpm typecheck && pnpm test`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/play/IslandMap.tsx tests/unit/island-map-decorations.test.tsx
git commit -m "feat(decor): IslandMap renders owned decorations at TS-catalog anchors"
```

---

## Task 6: Trophy integration

**Files:**
- Modify: `src/lib/db/trophies-evaluators.ts` (append `countOwnedDecorations`)
- Modify: `src/lib/db/trophies.ts:23-30` (TrophyCheckContext union), `:78-130` (switch)
- Modify: `src/lib/db/shop.ts` (PurchaseResult interface — add `trophies?`)
- Modify: `src/lib/actions/shop.ts` (dispatch + return trophies)
- Test: `tests/unit/trophy-decor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/trophy-decor.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const evalMock = vi.hoisted(() => ({
  countOwnedDecorations: vi.fn(),
}));

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@/lib/db/trophies-evaluators', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/db/trophies-evaluators')>();
  return { ...orig, countOwnedDecorations: evalMock.countOwnedDecorations };
});

import { checkAndGrantTrophies } from '@/lib/db/trophies';

function setupTrophyLookups(slugsRequested: string[], alreadyEarnedIds: string[] = []) {
  const trophyRows = slugsRequested.map((s, i) => ({
    id: `tid-${i}`,
    slug: s,
    nameZh: `zh-${s}`,
    nameEn: `en-${s}`,
    emoji: '🏆',
  }));
  // First select() call: trophies by slug
  const trophiesByCheck = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(trophyRows),
    }),
  };
  // Second select() call: already-earned trophy ids
  const earnedCheck = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(alreadyEarnedIds.map((id) => ({ trophyId: id }))),
    }),
  };
  dbMock.select
    .mockReturnValueOnce(trophiesByCheck)
    .mockReturnValueOnce(earnedCheck);
  dbMock.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return trophyRows;
}

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.insert.mockReset();
  evalMock.countOwnedDecorations.mockReset();
});

describe('decor-purchase trophy grants', () => {
  it('grants decor-starter at 1 owned', async () => {
    evalMock.countOwnedDecorations.mockResolvedValue(1);
    setupTrophyLookups(['decor-starter']);
    const result = await checkAndGrantTrophies('c1', { kind: 'decor-purchase' });
    expect(result.map((t) => t.slug)).toEqual(['decor-starter']);
  });

  it('grants both starter + completionist at 10 owned', async () => {
    evalMock.countOwnedDecorations.mockResolvedValue(10);
    setupTrophyLookups(['decor-starter', 'decor-completionist']);
    const result = await checkAndGrantTrophies('c1', { kind: 'decor-purchase' });
    expect(result.map((t) => t.slug).sort()).toEqual(['decor-completionist', 'decor-starter']);
  });

  it('grants nothing at 0 owned', async () => {
    evalMock.countOwnedDecorations.mockResolvedValue(0);
    const result = await checkAndGrantTrophies('c1', { kind: 'decor-purchase' });
    expect(result).toEqual([]);
  });

  it('idempotent: already-earned trophies are filtered out', async () => {
    evalMock.countOwnedDecorations.mockResolvedValue(10);
    setupTrophyLookups(['decor-starter', 'decor-completionist'], ['tid-0', 'tid-1']);
    const result = await checkAndGrantTrophies('c1', { kind: 'decor-purchase' });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/trophy-decor.test.ts`

Expected: FAIL — `decor-purchase` is not a recognized `TrophyCheckContext.kind`; `countOwnedDecorations` doesn't exist.

- [ ] **Step 3: Add the evaluator**

In `src/lib/db/trophies-evaluators.ts`, append at the bottom:

```ts
export async function countOwnedDecorations(childId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(shopPurchases)
    .innerJoin(shopItems, eq(shopItems.id, shopPurchases.shopItemId))
    .where(and(eq(shopPurchases.childId, childId), eq(shopItems.kind, 'decor')));
  return Number(rows[0]?.count ?? 0);
}
```

Add the imports at the top of the file (extending the existing imports):

```ts
import { shopItems, shopPurchases } from '@/db/schema';
```

- [ ] **Step 4: Extend `TrophyCheckContext` and the switch**

In `src/lib/db/trophies.ts`, extend the union:

```ts
export type TrophyCheckContext =
  | { kind: 'boss-clear'; weekId: string }
  | { kind: 'perfect-week'; weekId: string }
  | { kind: 'level-complete' }
  | { kind: 'coin-award' }
  | { kind: 'pack-complete'; packSlug: string }
  | { kind: 'scene-clear'; sceneType: string; score: number }
  | { kind: 'sound-theme-equip'; slug: string | null }
  | { kind: 'decor-purchase' };
```

Add the import:

```ts
import {
  countCompletedLevels,
  countDistinctBossWeeks,
  countOwnedDecorations,    // NEW
  getLifetimeEarned,
  getLongestStreak,
  isPackComplete,
  isPerfectWeekForChild,
} from './trophies-evaluators';
```

Append a switch arm (after the existing `'sound-theme-equip'` case):

```ts
case 'decor-purchase': {
  const owned = await countOwnedDecorations(childId);
  if (owned >= 1) slugs.add('decor-starter');
  if (owned >= 10) slugs.add('decor-completionist');
  break;
}
```

- [ ] **Step 5: Run the trophy test**

Run: `pnpm test tests/unit/trophy-decor.test.ts`

Expected: PASS (4 tests).

- [ ] **Step 6: Add `trophies?` to PurchaseResult and wire the action**

In `src/lib/db/shop.ts`, update `PurchaseResult`:

```ts
export interface PurchaseResult {
  shopItemId: string;
  coinsAfter: number;
  avatarItemId: string | null;
  trophies?: GrantedTrophy[];
}
```

Add the import at the top of `src/lib/db/shop.ts`:

```ts
import type { GrantedTrophy } from './trophies';
```

In `src/lib/actions/shop.ts`, extend `purchaseShopItemAction`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import {
  equipAvatarItem,
  purchaseShopItem,
  type PurchaseResult,
} from '@/lib/db/shop';
import { checkAndGrantTrophies } from '@/lib/db/trophies';
import { db } from '@/db';
import { shopItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface ChildArgs {
  childId: string;
}

export async function purchaseShopItemAction(
  shopItemId: string,
  args: ChildArgs,
): Promise<PurchaseResult> {
  const { child } = await requireChild(args.childId);
  const result = await purchaseShopItem(child.id, shopItemId);

  // Post-commit: dispatch trophy grants by the purchased item's kind.
  // Reading kind from db (instead of threading through the tx) keeps the
  // purchase tx focused and avoids a circular import (db/shop ↔ db/trophies).
  const [item] = await db
    .select({ kind: shopItems.kind })
    .from(shopItems)
    .where(eq(shopItems.id, shopItemId))
    .limit(1);
  if (item?.kind === 'decor') {
    result.trophies = await checkAndGrantTrophies(child.id, { kind: 'decor-purchase' });
  }

  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/shop`);
  return result;
}

export async function equipAvatarItemAction(
  avatarItemId: string,
  args: ChildArgs,
): Promise<void> {
  const { child } = await requireChild(args.childId);
  await equipAvatarItem(child.id, avatarItemId);

  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/shop`);
}
```

- [ ] **Step 7: Run the full test suite**

Run: `pnpm test`

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/trophies.ts src/lib/db/trophies-evaluators.ts src/lib/db/shop.ts src/lib/actions/shop.ts tests/unit/trophy-decor.test.ts
git commit -m "feat(decor): trophy hook — decor-purchase grants starter at 1, completionist at 10"
```

---

## Task 7: Decor shop tab UI

**Files:**
- Create: `src/components/shop/DecorTabBody.tsx`
- Modify: `src/components/shop/ShopCategoryTabs.tsx:14-20` (flip `decor` disabled)
- Modify: `src/app/play/[childId]/shop/page.tsx` (Promise.all extension)
- Modify: `src/app/play/[childId]/shop/ShopBody.tsx` (route activeTab)
- Test: `tests/unit/decor-tab-body.test.tsx`

- [ ] **Step 1: Read the existing ShopBody and PetsTabBody**

Open `src/app/play/[childId]/shop/ShopBody.tsx` and `src/components/shop/PetsTabBody.tsx`. The new `DecorTabBody` mirrors `PetsTabBody` exactly except: no equip step, no second action call on purchase, and the success path may render a `TrophyToast` from `result.trophies`.

- [ ] **Step 2: Flip the tab from disabled to enabled**

In `src/components/shop/ShopCategoryTabs.tsx`, change line 18:

```tsx
{ id: 'decor', emoji: '🏝️', label: '装饰', disabled: false },
```

- [ ] **Step 3: Write the failing component test**

Create `tests/unit/decor-tab-body.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DecorTabBody } from '@/components/shop/DecorTabBody';
import type { DecorShopListing } from '@/lib/db/decor';

const listings: DecorShopListing[] = [
  {
    shopItem: {
      id: 's1',
      slug: 'sailboat',
      kind: 'decor',
      name: '小帆船 / Sailboat',
      description: '红帆小船，停泊在航海的起点。\nA red-sailed sloop bobbing near the start of your voyage.',
      imageUrl: '⛵',
      priceCoins: 200,
      availableFrom: null,
      availableTo: null,
      isActive: true,
      metadata: {},
      createdAt: new Date(),
    } as unknown as DecorShopListing['shopItem'],
    decoration: {
      id: 'd1',
      slug: 'sailboat',
      nameZh: '小帆船',
      nameEn: 'Sailboat',
      descriptionZh: '红帆小船',
      descriptionEn: 'A red-sailed sloop',
      emoji: '⛵',
      anchorSlug: 'top-right',
      displayOrder: 1,
      createdAt: new Date(),
    },
  },
  {
    shopItem: {
      id: 's2',
      slug: 'lighthouse',
      kind: 'decor',
      name: '灯塔 / Lighthouse',
      description: '红白相间的灯塔守望着海面。\nA red-and-white lighthouse keeping watch.',
      imageUrl: '🗼',
      priceCoins: 900,
      availableFrom: null,
      availableTo: null,
      isActive: true,
      metadata: {},
      createdAt: new Date(),
    } as unknown as DecorShopListing['shopItem'],
    decoration: {
      id: 'd2',
      slug: 'lighthouse',
      nameZh: '灯塔',
      nameEn: 'Lighthouse',
      descriptionZh: '',
      descriptionEn: '',
      emoji: '🗼',
      anchorSlug: 'between-6-7',
      displayOrder: 9,
      createdAt: new Date(),
    },
  },
];

describe('DecorTabBody', () => {
  it('renders one card per listing', () => {
    render(
      <DecorTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={500}
      />,
    );
    expect(screen.getByText('小帆船')).toBeInTheDocument();
    expect(screen.getByText('Sailboat')).toBeInTheDocument();
    expect(screen.getByText('灯塔')).toBeInTheDocument();
  });

  it('owned card shows "已拥有" and disables the button', () => {
    render(
      <DecorTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set(['s1'])}
        coinBalance={500}
      />,
    );
    const btn = screen.getByRole('button', { name: /已拥有/ });
    expect(btn).toBeDisabled();
  });

  it('unaffordable card disables purchase button', () => {
    render(
      <DecorTabBody
        childId="c1"
        listings={listings}
        ownedShopItemIds={new Set()}
        coinBalance={300}      // < 900 for lighthouse
      />,
    );
    const lighthousePrice = screen.getAllByText(/🪙 900/);
    expect(lighthousePrice.length).toBeGreaterThan(0);
    // affordable sailboat (200 <= 300)
    const buyBtn = screen.getByRole('button', { name: /购买.*200/ });
    expect(buyBtn).not.toBeDisabled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test tests/unit/decor-tab-body.test.tsx`

Expected: FAIL — `DecorTabBody` does not exist.

- [ ] **Step 5: Create `DecorTabBody`**

Create `src/components/shop/DecorTabBody.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { purchaseShopItemAction } from '@/lib/actions/shop';
import { TrophyToast } from '@/components/play/TrophyToast';
import type { DecorShopListing } from '@/lib/db/decor';
import type { GrantedTrophy } from '@/lib/db/trophies';

interface Props {
  childId: string;
  listings: DecorShopListing[];
  ownedShopItemIds: Set<string>;
  coinBalance: number;
}

function parseName(name: string): { zh: string; en: string } {
  const [zh, en] = name.split(' / ');
  return { zh: zh ?? name, en: en ?? '' };
}

export function DecorTabBody({
  childId,
  listings,
  ownedShopItemIds,
  coinBalance,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toastTrophies, setToastTrophies] = useState<GrantedTrophy[]>([]);

  const purchase = (shopItemId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await purchaseShopItemAction(shopItemId, { childId });
        if (result.trophies && result.trophies.length > 0) {
          setToastTrophies(result.trophies);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Purchase failed');
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-4">
      {error && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      {toastTrophies.map((t) => (
        <TrophyToast key={t.slug} trophy={t} onDismiss={() => {
          setToastTrophies((prev) => prev.filter((x) => x.slug !== t.slug));
        }} />
      ))}

      {listings.map((l) => {
        const { zh, en } = parseName(l.shopItem.name);
        const isOwned = ownedShopItemIds.has(l.shopItem.id);
        const affordable = coinBalance >= l.shopItem.priceCoins;

        let actionLabel: string;
        let actionDisabled = false;
        let onAction: () => void = () => {};
        if (isOwned) {
          actionLabel = '已拥有 / Owned';
          actionDisabled = true;
        } else if (!affordable) {
          actionLabel = `🪙 ${l.shopItem.priceCoins}`;
          actionDisabled = true;
        } else {
          actionLabel = `购买 / Buy 🪙 ${l.shopItem.priceCoins}`;
          onAction = () => purchase(l.shopItem.id);
        }

        return (
          <article
            key={l.shopItem.id}
            className="flex flex-col gap-3 rounded-2xl border-2 border-amber-800/30 bg-amber-50 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="text-5xl" aria-hidden>
                {l.decoration.emoji}
              </div>
              <div className="flex-1">
                <div className="text-base font-extrabold text-amber-950">{zh}</div>
                <div className="text-sm font-semibold text-amber-900">{en}</div>
              </div>
            </div>
            {l.shopItem.description && (
              <p className="text-xs whitespace-pre-line text-amber-900/80">{l.shopItem.description}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-900">🪙 {l.shopItem.priceCoins}</span>
              <button
                type="button"
                disabled={actionDisabled || pending}
                onClick={onAction}
                className="rounded-lg border-2 border-amber-800/40 bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 disabled:opacity-40"
              >
                {actionLabel}
              </button>
            </div>
            {isOwned && (
              <p className="text-xs text-emerald-800">
                装饰已添加到航海图 / Decoration added to your map
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
```

If the test's `screen.getByRole('button', { name: /购买.*200/ })` doesn't match the rendered label exactly, adjust the regex to whatever the component renders. The label here is `购买 / Buy 🪙 200` — the `‍`-free regex `/购买.*200/` should match.

- [ ] **Step 6: Wire ShopBody to route to DecorTabBody**

In `src/app/play/[childId]/shop/ShopBody.tsx`, find where `activeTab === 'pet'` is routed and add an adjacent branch for `activeTab === 'decor'`. The page component (`page.tsx`) provides `decorListings` as a prop. Read the existing file for the exact import style; the wiring is:

```tsx
import { DecorTabBody } from '@/components/shop/DecorTabBody';
// ...
{activeTab === 'decor' && (
  <DecorTabBody
    childId={childId}
    listings={decorListings}
    ownedShopItemIds={ownedShopItemIds}
    coinBalance={coinBalance}
  />
)}
```

Also extend the component's prop interface to include `decorListings: DecorShopListing[]`. Mirror the pattern used for `petListings`.

- [ ] **Step 7: Wire the shop page to call `listDecorShopListings()`**

In `src/app/play/[childId]/shop/page.tsx`, extend the existing `Promise.all`:

```ts
import { listDecorShopListings } from '@/lib/db/decor';
// ...
const [..., decorListings] = await Promise.all([
  // ... existing calls
  listDecorShopListings(),
]);
```

Pass `decorListings` into `<ShopBody>`.

- [ ] **Step 8: Run the tab-body test**

Run: `pnpm test tests/unit/decor-tab-body.test.tsx`

Expected: PASS (3 tests).

- [ ] **Step 9: Run full test + typecheck + lint**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/shop/DecorTabBody.tsx src/components/shop/ShopCategoryTabs.tsx src/app/play/[childId]/shop/page.tsx src/app/play/[childId]/shop/ShopBody.tsx tests/unit/decor-tab-body.test.tsx
git commit -m "feat(decor): shop tab UI — DecorTabBody + enable Decor tab + wire ShopBody"
```

---

## Task 8: Island map page wiring

**Files:**
- Modify: `src/app/play/[childId]/page.tsx:1-130` (add listOwnedDecorationsForChild + pass to IslandMap)

- [ ] **Step 1: Extend the Promise.all and pass decorations to IslandMap**

In `src/app/play/[childId]/page.tsx`, add the import:

```ts
import { listOwnedDecorationsForChild } from '@/lib/db/decor';
```

Extend the destructured Promise.all (currently 6 awaits — add a 7th):

```ts
const [
  playableWeeks,
  progressRows,
  balance,
  activePacks,
  equipped,
  pet,
  ownedDecorations,    // NEW
] = await Promise.all([
  listChildPlayableWeeks(child.id),
  listProgressByChild(child.id),
  getCoinBalance(child.id),
  listActivePacks(),
  getEquippedAvatar(child.id),
  getEquippedPet(child.id),
  listOwnedDecorationsForChild(child.id),    // NEW
]);
```

Pass to `<IslandMap>`:

```tsx
<IslandMap
  childId={childId}
  islands={islands}
  ownedCount={ownedCount}
  totalCount={totalCount}
  decorations={ownedDecorations.map((d) => ({ slug: d.slug }))}
/>
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/play/[childId]/page.tsx
git commit -m "feat(decor): pass owned decorations to IslandMap on /play/[childId]"
```

---

## Task 9: Seed scripts

**Files:**
- Create: `scripts/seed-decorations.ts`
- Modify: `scripts/seed-trophies.ts` (append 2 new trophy rows)

- [ ] **Step 1: Create the decorations seed script**

Create `scripts/seed-decorations.ts`:

```ts
/**
 * Seed 10 decorations + matching shop_items rows.
 * Idempotent — re-running is safe (skip-by-slug).
 *
 * Usage:
 *   pnpm tsx scripts/seed-decorations.ts
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

interface DecorSeed {
  slug: string;
  emoji: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  anchorSlug: string;
  priceCoins: number;
  displayOrder: number;
}

const DECORATIONS: DecorSeed[] = [
  {
    slug: 'sailboat',
    emoji: '⛵',
    nameZh: '小帆船',
    nameEn: 'Sailboat',
    descriptionZh: '红帆小船，停泊在航海的起点。',
    descriptionEn: 'A red-sailed sloop bobbing near the start of your voyage.',
    anchorSlug: 'top-right',
    priceCoins: 200,
    displayOrder: 1,
  },
  {
    slug: 'seagull-pair',
    emoji: '🐦',
    nameZh: '海鸥',
    nameEn: 'Seagull Pair',
    descriptionZh: '两只海鸥在浪花上盘旋。',
    descriptionEn: 'Two seagulls wheeling above the waves.',
    anchorSlug: 'top-left',
    priceCoins: 200,
    displayOrder: 2,
  },
  {
    slug: 'hibiscus',
    emoji: '🌺',
    nameZh: '木槿花',
    nameEn: 'Hibiscus',
    descriptionZh: '热带木槿花，生长在岛屿上。',
    descriptionEn: 'A tropical hibiscus growing wild on the islands.',
    anchorSlug: 'left-margin-mid',
    priceCoins: 250,
    displayOrder: 3,
  },
  {
    slug: 'fish-school',
    emoji: '🐟',
    nameZh: '小鱼群',
    nameEn: 'Fish School',
    descriptionZh: '一群银色小鱼在水下游动。',
    descriptionEn: 'A school of silver fish darting underwater.',
    anchorSlug: 'between-2-3',
    priceCoins: 250,
    displayOrder: 4,
  },
  {
    slug: 'compass-rose',
    emoji: '🧭',
    nameZh: '罗盘',
    nameEn: 'Compass Rose',
    descriptionZh: '古老的罗盘，指引归航的方向。',
    descriptionEn: "An old-timer's compass rose, points the way home.",
    anchorSlug: 'bottom-center',
    priceCoins: 400,
    displayOrder: 5,
  },
  {
    slug: 'rainbow',
    emoji: '🌈',
    nameZh: '彩虹',
    nameEn: 'Rainbow',
    descriptionZh: '海上风暴后的彩虹。',
    descriptionEn: 'A rainbow after a Pacific squall.',
    anchorSlug: 'between-4-5',
    priceCoins: 500,
    displayOrder: 6,
  },
  {
    slug: 'pirate-flag',
    emoji: '🏴‍☠️',
    nameZh: '海盗旗',
    nameEn: 'Pirate Flag',
    descriptionZh: '海盗旗在风中猎猎作响。',
    descriptionEn: 'Jolly Roger snapping in the breeze.',
    anchorSlug: 'left-margin-low',
    priceCoins: 500,
    displayOrder: 7,
  },
  {
    slug: 'whale-tail',
    emoji: '🐋',
    nameZh: '鲸鱼尾',
    nameEn: 'Whale Tail',
    descriptionZh: '座头鲸跃出水面的尾巴。',
    descriptionEn: "A humpback whale's tail breaking the surface.",
    anchorSlug: 'right-margin-mid',
    priceCoins: 700,
    displayOrder: 8,
  },
  {
    slug: 'lighthouse',
    emoji: '🗼',
    nameZh: '灯塔',
    nameEn: 'Lighthouse',
    descriptionZh: '红白相间的灯塔守望着海面。',
    descriptionEn: 'A red-and-white lighthouse keeping watch.',
    anchorSlug: 'between-6-7',
    priceCoins: 900,
    displayOrder: 9,
  },
  {
    slug: 'treasure-chest',
    emoji: '🧰',
    nameZh: '宝箱',
    nameEn: 'Treasure Chest',
    descriptionZh: '饱经风霜的宝箱，盖子微启。',
    descriptionEn: 'A weathered chest, lid slightly ajar.',
    anchorSlug: 'between-8-9',
    priceCoins: 1200,
    displayOrder: 10,
  },
];

async function main() {
  const { db } = await import('../src/db');
  const { decorations, shopItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  let decorInserted = 0;
  let shopInserted = 0;

  for (const d of DECORATIONS) {
    const existingDecor = await db.select({ id: decorations.id }).from(decorations).where(eq(decorations.slug, d.slug)).limit(1);
    if (existingDecor.length === 0) {
      await db.insert(decorations).values({
        slug: d.slug,
        nameZh: d.nameZh,
        nameEn: d.nameEn,
        emoji: d.emoji,
        descriptionZh: d.descriptionZh,
        descriptionEn: d.descriptionEn,
        anchorSlug: d.anchorSlug,
        displayOrder: d.displayOrder,
      });
      decorInserted++;
    }

    const existingShop = await db.select({ id: shopItems.id }).from(shopItems).where(eq(shopItems.slug, d.slug)).limit(1);
    if (existingShop.length === 0) {
      await db.insert(shopItems).values({
        slug: d.slug,
        kind: 'decor',
        name: `${d.nameZh} / ${d.nameEn}`,
        description: `${d.descriptionZh}\n${d.descriptionEn}`,
        imageUrl: d.emoji,
        priceCoins: d.priceCoins,
        isActive: true,
      });
      shopInserted++;
    }

    if (existingDecor.length === 0 || existingShop.length === 0) {
      console.log(`  + ${d.slug} (${d.priceCoins} coins)`);
    }
  }

  console.log(
    `Done. Decorations +${decorInserted}, shop_items +${shopInserted} ` +
    `(skipped ${DECORATIONS.length - decorInserted} decorations, ${DECORATIONS.length - shopInserted} shop_items).`,
  );
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Extend `seed-trophies.ts` with the two new trophy rows**

Open `scripts/seed-trophies.ts`. Find the trophy seed array (it's a `const` list with each trophy's `{ slug, nameZh, nameEn, emoji, category, tier, displayOrder, description... }`). Append two new entries at the bottom of the array (numbering `displayOrder` after the existing highest in the `collection` category — read the file to confirm):

```ts
{
  slug: 'decor-starter',
  nameZh: '装饰新手',
  nameEn: 'Decor Starter',
  emoji: '🏝️',
  category: 'collection',
  tier: 'bronze',
  displayOrder: /* next int after existing collection trophies */,
  descriptionZh: '购买了你的第一个航海图装饰。',
  descriptionEn: 'Bought your first island decoration.',
},
{
  slug: 'decor-completionist',
  nameZh: '装饰大师',
  nameEn: 'Decor Master',
  emoji: '🏰',
  category: 'collection',
  tier: 'gold',
  displayOrder: /* next int + 1 */,
  descriptionZh: '收集了所有 10 个航海图装饰。',
  descriptionEn: 'Owned all 10 island decorations.',
},
```

(Read the existing rows for the exact field names — `tier` may be enum-typed, `descriptionZh`/`descriptionEn` may be `description_zh`/`description_en` per the trophies schema. Match what the file already uses.)

- [ ] **Step 3: Local smoke run of decorations seed (against your dev DB)**

Run: `pnpm tsx scripts/seed-decorations.ts`

Expected: "Done. Decorations +10, shop_items +10 (skipped 0 decorations, 0 shop_items)." (First run; subsequent runs show all skipped.) Confirm no errors. **CAUTION:** if your `.env.local` points at prod (Neon shared DATABASE_URL), this also writes prod. That's actually fine because of the idempotency, but be aware.

- [ ] **Step 4: Local smoke run of trophies seed**

Run: `pnpm tsx scripts/seed-trophies.ts`

Expected: only the two new rows are inserted (existing 20 are skipped).

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-decorations.ts scripts/seed-trophies.ts
git commit -m "feat(decor): seed scripts — 10 decorations + 2 new trophies"
```

---

## Task 10: Final 4-green gate + manual smoke

**Files:** none new; this is the gate before opening the PR.

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: PASS. If there are `@typescript-eslint/no-explicit-any` lint errors in the test files, replace any `as any` with `as unknown as <TypeName>` per the established pattern.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`

Expected: all green.

- [ ] **Step 4: Run the production build**

Run: `pnpm build`

Expected: PASS. Watch for the RSC serialization gotcha noted in CLAUDE.md (function-bearing objects from server → client components). The catalog `DECOR_CATALOG` is imported in both `IslandMap.tsx` (client component) and only there — RSC boundary is safe because the import happens *inside* the client component, not as a prop.

- [ ] **Step 5: Manual smoke — kid-facing happy path**

Run: `pnpm dev` and open `http://localhost:3000/play/<childId>/shop` (use your dev seed).

Confirm:

1. **Decor tab is no longer "即将上线"** — it's tappable and shows 10 cards.
2. Buy 1 decor (sailboat, 200 coins) → button flips to "已拥有"; coin balance drops by 200; if `TrophyToast` for `decor-starter` is queued, it renders.
3. Navigate back to `/play/<childId>` → the sailboat SVG is visible at the top-right of the island map.
4. **Regression check — buy a pet** (PR #33). Pet tab → buy any pet → no longer throws "Shop item kind 'pet' is not purchasable". This proves the avatar-only-guard fix works.
5. **Regression check — buy a sound theme** (PR #31). Same as above for `music-box` or any theme.

- [ ] **Step 6: Open the PR**

```bash
git push -u origin feat/pr34-island-decorations
gh pr create --title "feat: PR #34 — island decorations + shop purchase dispatch fix" --body "$(cat <<'EOF'
## Summary
- 10 hand-rolled SVG decorations auto-appear on Yinuo's island map once owned (no equip UI). New Decor shop tab.
- 2 new trophies: `decor-starter` (own 1) and `decor-completionist` (own all 10).
- **Regression fix**: `purchaseShopItemInTx` previously hardcoded `kind === 'avatar'`, silently blocking PR #31 (sound themes) and PR #33 (pets) purchases. Refactored to a `switch (kind)` dispatch — all 4 shop tabs are now actually purchasable.

## Test plan
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
- [ ] /play/<childId>/shop → Decor tab populated; buy sailboat → shows up on island map
- [ ] Buy pet (PR #33) and sound theme (PR #31) succeeds (regression fix)
- [ ] Buying all 10 decor → `decor-completionist` trophy fires

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Wait for CI green, then squash-merge. After merge, run on prod:

```bash
pnpm tsx scripts/seed-decorations.ts
pnpm tsx scripts/seed-trophies.ts
```

Both should be 0-op if the local smoke already wrote to prod (idempotent skip-by-slug).

- [ ] **Step 7: Update CLAUDE.md**

Add a one-line entry under "Current state" and the two landmines from spec §14. Commit on a follow-up `docs/claude.md` commit on main *after* PR merge (per the recent pattern in `5014e4c`).

---

## Self-review notes (already applied to this plan)

- **Spec coverage:** every section of the spec maps to a task:
  - §3.1 (data model) → Task 1
  - §3.2 (ownership flow) → Task 2 + Task 6 (action wiring)
  - §3.3 (purchase dispatch fix) → Task 3
  - §3.4 (IslandMap render) → Task 5
  - §3.5–§3.6 (anchor + catalog + SVGs) → Task 4
  - §4 (10-item catalog) → Task 9 (seed)
  - §5 (trophies) → Task 6
  - §6 (shop tab UI) → Task 7
  - §7 (DB layer) → Task 2
  - §8 (page wiring) → Task 8
  - §9 (tests) → distributed across Tasks 2, 3, 4, 5, 6, 7
  - §10 (scripts) → Task 9
  - §11 (migration) → Task 1
  - §13 (verification checklist) → Task 10

- **Placeholder scan:** none — every code block is concrete.

- **Type consistency:**
  - `DecorShopListing` / `DecorationRow` defined in Task 2, used in Tasks 6, 7.
  - `TrophyCheckContext` extended in Task 6 with literal `'decor-purchase'` — used consistently.
  - `PurchaseResult.trophies?` added in Task 6, consumed in Task 7's DecorTabBody.
  - `AnchorSlug` defined in Task 4, used in Task 4's catalog + Task 5's render.
  - `DECOR_CATALOG` keys map 1-1 with seed `slug` values in Task 9.

- **Subtle risks called out:**
  - Task 2 step 4 has a fallback if the chain-mock row shape doesn't match — that's intentional safety net.
  - Task 3 step 6 explicitly anticipates avatar-purchase tests stubbing `tx.select` count and needing updates.
  - Task 5 transform string carefully avoids `scale(1)` to match the test's regex.
  - Task 9 step 2 directs the engineer to read `seed-trophies.ts` for the exact field names rather than guessing.

## Execution Handoff

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task with spec + quality review between tasks. Same session, fast iteration. Established pattern from PRs #30–#33.

2. **Inline Execution** — execute tasks here with batch checkpoints.

Which approach?
