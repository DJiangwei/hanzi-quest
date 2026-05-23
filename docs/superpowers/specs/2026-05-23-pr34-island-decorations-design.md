# PR #34 — Island decorations (auto-show, hand-rolled SVG)

**Date:** 2026-05-23
**Author:** Claude + David (brainstorm)
**Status:** Spec — pending implementation plan

---

## 1. Goal

Add the **Decor** shop category Yinuo has been seeing as "即将上线" since PR #21. Each decoration is a small hand-rolled SVG that, once owned, automatically appears at a fixed anchor on her island map. Buying more decorations = more of the world fills in. No equip UI, no drag-to-place — ownership is visibility.

After this PR ships:
- The Shop has a 4th live tab (**Decor**) showing 10 cards: sailboat, lighthouse, compass rose, etc.
- Yinuo can buy any of them with coins (200–1200 range, total set cost ≈ 5,100).
- On the island map (and only there), every owned decoration renders at its anchor — between islands, in the margins, in the corners.
- Two trophies are added: `decor-starter` (first decor) and `decor-completionist` (all 10).
- A pre-existing platform bug is fixed: `purchaseShopItemInTx` no longer hardcodes `kind === 'avatar'`, so PRs #31 (sounds) and #33 (pets) become actually purchasable in prod for the first time.

## 2. Locked decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Placement model | **Anchor-based, auto-show all owned.** No equip UI. Each item maps to one fixed anchor; owning = visible. |
| Catalog scope | **10 items, hand-rolled SVG**, consistent with IslandMap's existing visual style. |
| Trophy hooks | **2 trophies**: `decor-starter` (own 1) + `decor-completionist` (own all 10). |
| Render layer | Inline in the existing `<svg>` viewBox (z-order: waves → decorations → dotted path → islands). |
| Position source | **TS catalog** (`src/lib/decor/anchors.ts`) — positions are layout config, not runtime data. DB stores only the anchor slug. |
| Data model | New `decorations` catalog table (mirrors `pets` shape). **No** `child_decor_equipped` table — ownership = `shop_purchases ⋈ shop_items (kind='decor')`. |
| Where decor shows | Island map page only (`/play/[childId]`). Not on level pages, not on shop, not on collection. |

## 3. Architecture

### 3.1 Data model

**New table** `decorations` (Drizzle `src/db/schema/decorations.ts`):

```ts
export const decorations = pgTable(
  'decorations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    nameZh: text('name_zh').notNull(),
    nameEn: text('name_en').notNull(),
    descriptionZh: text('description_zh'),
    descriptionEn: text('description_en'),
    emoji: text('emoji').notNull(),       // tile preview only; map uses SVG
    anchorSlug: text('anchor_slug').notNull(),
    displayOrder: integer('display_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('decorations_display_order_idx').on(t.displayOrder)],
);
```

**Enum extension:** `shopItemKind` gets `'decor'` appended. Drizzle migration `0010_*.sql`, append-only.

**No equip table.** Pet uses one because only one pet is shown at a time; decor shows all owned simultaneously, so the join `shop_purchases → shop_items → decorations` is the only state needed.

### 3.2 Ownership flow

```
Child taps Buy in DecorTabBody
  → purchaseShopItemAction(shopItemId)
  → purchaseShopItem(childId, shopItemId)  ← in tx
       deduct coins
       insert shop_purchases row
       (NO inventory side-effect; ownership derives from shop_purchases)
       award trophies via checkAndGrantTrophies({kind:'decor-purchase'})
  → revalidatePath('/play/[childId]')   ← decor reappears at its anchor on next render
  → revalidatePath('/play/[childId]/shop')
```

### 3.3 The `purchaseShopItemInTx` fix (REQUIRED, pre-existing bug)

Today `src/lib/db/shop.ts:172` throws `ItemNotPurchasableError` for any `kind !== 'avatar'`. This silently blocks PRs #31 (sound themes) and #33 (pets) — both ship UI that calls `purchaseShopItemAction`, but the action rejects them at the SQL boundary. Yinuo has not hit this yet because her trophy history shows no `equip-sound-theme` and no pet purchase.

**Fix in this PR:**
- Replace the `kind !== 'avatar'` guard with a kind-specific dispatch. Avatar branches into "link avatar_items + insert inventory"; all other supported kinds (`sound_theme`, `pet`, `decor`) skip the avatar inventory side-effect entirely.
- Keep `ItemNotPurchasableError` for genuinely unsupported kinds (`consumable`, `powerup`, `pack_voucher`).
- Trophy hook call moves into the action (`src/lib/actions/shop.ts`) post-commit, dispatching on the *purchased* shop item's `kind` to decide which `TrophyCheckContext` to send.

```ts
// pseudo
async function purchaseShopItemInTx(tx, childId, shopItemId) {
  const shopItem = ...;
  switch (shopItem.kind) {
    case 'avatar':       return purchaseAvatarInTx(tx, childId, shopItem);
    case 'sound_theme':
    case 'pet':
    case 'decor':        return purchaseGenericInTx(tx, childId, shopItem);
    default:             throw new ItemNotPurchasableError(...);
  }
}
```

`purchaseGenericInTx` does: balance check → debit coins → insert `shop_purchases` row → return `{ shopItemId, coinsAfter, avatarItemId: null }`.

This refactor stays inside `src/lib/db/shop.ts` and `src/lib/actions/shop.ts`; no callers need to change.

### 3.4 IslandMap render integration

`src/components/play/IslandMap.tsx` props extension:

```ts
interface Props {
  childId: string;
  islands: IslandInput[];
  ownedCount: number;
  totalCount?: number;
  decorations?: { slug: string }[];   // NEW, defaults to []
}
```

A new `<g>` group renders **between** the existing waves group and the dotted path group:

```tsx
{decorations.map((d) => {
  const catalog = DECOR_CATALOG[d.slug];
  if (!catalog) return null;
  const { x, y, scale = 1 } = ANCHORS[catalog.anchor];
  const Comp = catalog.Component;
  return (
    <g key={d.slug} transform={`translate(${x} ${y}) scale(${scale})`} opacity={0.92}>
      <Comp />
    </g>
  );
})}
```

**Why before the path/islands:** decorations are world-background, not foreground UI. Paths and islands need to render on top so they remain clearly tappable.

### 3.5 Anchor & catalog files

`src/lib/decor/anchors.ts` — pure TS, no React. Anchor slug → coords. Coords are in the IslandMap viewBox (360 × svgHeight). For "between-N-N" anchors, the `y` is the midpoint between two islands' positions; computed from `TOP_PADDING + index * VERTICAL_SPACING`.

```ts
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

export const ANCHORS: Record<AnchorSlug, { x: number; y: number; scale?: number }> = {
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

Math: `TOP_PADDING=80`, `VERTICAL_SPACING=150`, `BOTTOM_PADDING=80`. For 10 islands, each at `y = 80 + idx*150` (idx 0..9), so island y values are 80, 230, 380, 530, 680, 830, 980, 1130, 1280, 1430; `svgHeight = 80 + 9*150 + 80 = 1590`. Between-N-N anchors are the midpoint of two adjacent island y values (e.g. between-2-3 = (230+380)/2 = 305). `bottom-center` = `svgHeight - 40 = 1550`. Plan stage will codify these constants by importing them from IslandMap rather than hard-coding numbers.

`src/lib/decor/catalog.tsx` — single source of truth for slug → anchor + SVG component:

```ts
import { Sailboat } from '@/components/play/decorations/Sailboat';
// ...
export const DECOR_CATALOG: Record<string, {
  anchor: AnchorSlug;
  Component: React.ComponentType;
}> = {
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

Catalog test asserts: every slug has a unique anchor; every anchor in the catalog exists in `ANCHORS`; no two items share an anchor.

### 3.6 Decoration SVG components

Each component is small (~30–60 lines of JSX) under `src/components/play/decorations/*.tsx`, no props, single root `<g>` returning hand-rolled paths/shapes in the IslandMap's design language (ocean blues, sunset oranges, sand tones — same CSS custom properties already in use).

Static for V1 (no animation). Reduced-motion safe by construction.

## 4. The 10-item catalog

| # | Slug | 中文 | English | Anchor | Tier | Coins |
|---|---|---|---|---|---|---|
| 1 | `sailboat` | 小帆船 | Sailboat | top-right | common | 200 |
| 2 | `seagull-pair` | 海鸥 | Seagull Pair | top-left | common | 200 |
| 3 | `hibiscus` | 木槿花 | Hibiscus | left-margin-mid | common | 250 |
| 4 | `fish-school` | 小鱼群 | Fish School | between-2-3 | common | 250 |
| 5 | `compass-rose` | 罗盘 | Compass Rose | bottom-center | rare | 400 |
| 6 | `rainbow` | 彩虹 | Rainbow | between-4-5 | rare | 500 |
| 7 | `pirate-flag` | 海盗旗 | Pirate Flag | left-margin-low | rare | 500 |
| 8 | `whale-tail` | 鲸鱼尾 | Whale Tail | right-margin-mid | epic | 700 |
| 9 | `lighthouse` | 灯塔 | Lighthouse | between-6-7 | epic | 900 |
| 10 | `treasure-chest` | 宝箱 | Treasure Chest | between-8-9 | epic | 1200 |

Full set total: **5,100 coins.** For reference: pets set ≈ 4,950; broadly comparable. Pricing intentionally puts the lighthouse and treasure chest as aspirational late-game purchases.

Bilingual descriptions (English-native rule, per memory `yinuo_english_native.md`):

```
sailboat        – "A red-sailed sloop bobbing near the start of your voyage."
                  "红帆小船，停泊在航海的起点。"
seagull-pair    – "Two seagulls wheeling above the waves."
                  "两只海鸥在浪花上盘旋。"
hibiscus        – "A tropical hibiscus growing wild on the islands."
                  "热带木槿花，生长在岛屿上。"
fish-school     – "A school of silver fish darting underwater."
                  "一群银色小鱼在水下游动。"
compass-rose    – "An old-timer's compass rose, points the way home."
                  "古老的罗盘，指引归航的方向。"
rainbow         – "A rainbow after a Pacific squall."
                  "海上风暴后的彩虹。"
pirate-flag     – "Jolly Roger snapping in the breeze."
                  "海盗旗在风中猎猎作响。"
whale-tail      – "A humpback whale's tail breaking the surface."
                  "座头鲸跃出水面的尾巴。"
lighthouse      – "A red-and-white lighthouse keeping watch."
                  "红白相间的灯塔守望着海面。"
treasure-chest  – "A weathered chest, lid slightly ajar."
                  "饱经风霜的宝箱，盖子微启。"
```

## 5. Trophy integration

**Schema:** trophies seeded into existing `trophies` table (no schema change). Category = `collection`.

| slug | nameZh | nameEn | emoji | tier | criteria |
|---|---|---|---|---|---|
| `decor-starter` | 装饰新手 | Decor Starter | 🏝️ | bronze | own ≥ 1 decor |
| `decor-completionist` | 装饰大师 | Decor Master | 🏰 | gold | own all 10 decor |

**`TrophyCheckContext` extension** in `src/lib/db/trophies.ts`:

```ts
export type TrophyCheckContext =
  | ... existing kinds ...
  | { kind: 'decor-purchase' };
```

**Handler** (new switch arm):

```ts
case 'decor-purchase': {
  const owned = await countOwnedDecorations(childId);
  if (owned >= 1) slugs.add('decor-starter');
  if (owned >= 10) slugs.add('decor-completionist');
  break;
}
```

**New evaluator** in `src/lib/db/trophies-evaluators.ts`:

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

**Wiring** in `src/lib/actions/shop.ts`:

```ts
const result = await purchaseShopItem(child.id, shopItemId);
// after the tx commits — dispatch on shopItem kind
let trophies: GrantedTrophy[] = [];
if (purchasedKind === 'decor') {
  trophies = await checkAndGrantTrophies(child.id, { kind: 'decor-purchase' });
}
// ...return trophies in PurchaseResult so the UI can toast
```

(The PurchaseResult shape grows a `trophies?: GrantedTrophy[]` field — the `TrophyToast` already used by SceneRunner/finishLevel can be reused in the DecorTabBody.)

## 6. Shop tab UI

`src/components/shop/ShopCategoryTabs.tsx` — flip `disabled` to `false` for the `decor` row.

`src/components/shop/DecorTabBody.tsx` (new, parallel to `PetsTabBody`):

- Renders a vertical list of 10 decoration cards (one column, like Pet tab).
- Card content: emoji preview tile (~48px), bilingual name (zh / en split on " / " from `shopItems.name`), bilingual description (one line each), price chip, action button.
- Action button states:
  - **already owned** → `已拥有 / Owned` (disabled, gray)
  - **affordable, unowned** → `购买 / Buy 🪙 N` (active, amber)
  - **unaffordable, unowned** → `🪙 N` (disabled)
- On purchase: optimistic state (button to pending) → `purchaseShopItemAction` → on success, `router.refresh()` + show `TrophyToast` if `result.trophies?.length`.
- No equip step. The card flips to "已拥有" state. The decoration won't be visible in this view; copy hint: *"装饰已添加到航海图 / Decoration added to your map"*.

Shop page wiring (`src/app/play/[childId]/shop/page.tsx`):

```ts
const [..., decorListings] = await Promise.all([
  ...
  listDecorShopListings(),
]);
```

`ShopBody.tsx` routes `activeTab === 'decor'` → `<DecorTabBody listings={decorListings} ... />`.

## 7. DB layer

`src/lib/db/decor.ts` (new):

```ts
export type DecorationRow = typeof decorations.$inferSelect;

export interface DecorShopListing {
  shopItem: ShopItemRow;
  decoration: DecorationRow;
}

export async function listDecorShopListings(): Promise<DecorShopListing[]>;
// shopItems ⋈ decorations (on slug match) where kind='decor' AND isActive=true

export async function listOwnedDecorationsForChild(
  childId: string,
): Promise<DecorationRow[]>;
// shopPurchases ⋈ shopItems (kind='decor') ⋈ decorations (slug match), filtered by childId
```

## 8. Page wiring

`src/app/play/[childId]/page.tsx` adds `listOwnedDecorationsForChild(child.id)` to the existing `Promise.all`, passes `decorations={owned.map(d => ({ slug: d.slug }))}` to `<IslandMap>`.

## 9. Tests (mocking `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`)

1. **`tests/unit/decor-db.test.ts`**
   - `listDecorShopListings` returns only rows where `shopItems.kind='decor'` and `isActive=true`, joined to decorations by slug.
   - `listOwnedDecorationsForChild` returns empty array for a child with no decor purchases.
   - `listOwnedDecorationsForChild` returns the right rows after one and after multiple purchases (mock data only — drizzle is mocked).

2. **`tests/unit/decor-purchase-action.test.ts`**
   - Buying a `kind='decor'` item now succeeds (was previously throwing via `ItemNotPurchasableError`).
   - The same fix unblocks `kind='pet'` and `kind='sound_theme'` — two regression tests added against `purchaseShopItemInTx` to guard the dispatch.
   - Buying a `kind='consumable'` still throws `ItemNotPurchasableError` (negative test).

3. **`tests/unit/decor-tab-body.test.tsx`**
   - Renders 10 cards when 10 listings provided.
   - Owned card shows "已拥有" + disabled button.
   - Unaffordable card shows the price chip + disabled.
   - Affordable unowned card shows "购买" and is enabled.

4. **`tests/unit/island-map-decorations.test.tsx`**
   - Given `decorations=[{slug:'sailboat'}]` and a known `ANCHORS['top-right']`, the rendered SVG contains a `<g>` with `transform="translate(300 90)"` (or with scale).
   - Empty `decorations` prop renders no decoration group.
   - Unknown slug is silently skipped (no crash).

5. **`tests/unit/trophy-decor.test.ts`**
   - `checkAndGrantTrophies({kind:'decor-purchase'})` grants `decor-starter` at 1 owned, nothing extra in between, and `decor-completionist` at 10 owned.
   - Re-running at 10 owned grants nothing new (idempotency via `onConflictDoNothing`).

6. **`tests/unit/decor-catalog.test.ts`**
   - Every `DECOR_CATALOG` slug references a real `ANCHORS` entry.
   - All 10 anchors are distinct (no overlap).
   - Slug list matches what the seed script writes.

## 10. Scripts

- **`scripts/seed-decorations.ts`** — idempotent skip-by-slug. Seeds the 10 `decorations` rows + 10 matching `shop_items` (kind='decor', slug matches, price + bilingual name "汉字 / English" + description). Uses `loadEnv()` + dynamic `@/db` import inside `main()` per the CLAUDE.md landmine.
- **`scripts/seed-trophies.ts`** — **extended** to also seed the two new trophy rows. Existing trophies are unchanged; idempotent skip-by-slug already in place. (Avoid creating a separate `seed-decor-trophies.ts`; keep all trophies in one script for ops sanity.)
- **No backfill script needed** — `decor-starter` / `decor-completionist` can only be earned through purchases, which can't have happened before this PR.

## 11. Migration

Drizzle migration `0010_*.sql` (auto-named by drizzle):

1. Append `'decor'` to `shop_item_kind` enum (`ALTER TYPE ... ADD VALUE 'decor'`).
2. `CREATE TABLE decorations ...` with index on `display_order`.

(Postgres forbids `ALTER TYPE ADD VALUE` + DML in the same transaction. The two-phase pattern from existing migrations applies — Drizzle's `migrate.ts` runs each statement in its own connection, which we already proved works for the `coin_reason` + trophy migrations in PRs #28 and #32.)

## 12. Out of scope

- **Drag-to-place / repositioning.** V1 is fixed anchors per item. If Yinuo asks for it later, a `child_decor_positions(childId, decorId, x, y)` override table is a clean add.
- **Animation.** Static SVG only. Adding a CSS bob to the sailboat or whale-tail is a 2-line follow-up gated on `useReducedMotion()`.
- **Decor on level/scene pages.** Decorations show only on the island map. The level page (`/play/[childId]/level/[weekId]`) and shop page don't render them. Mixing them into scene backgrounds is its own design problem.
- **Themed decor packs.** No "winter pack" or "festival pack" in V1. The 10 items are a single set; future packs are a `decoration_packs` table extension.
- **Sound effect on placement.** No "purchase ding" beyond the existing coin-spend animation already triggered by `awardCoinsInTx` flow.

## 13. Verification checklist (pre-PR-open)

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — 4-green gate.
2. `pnpm dev`, log in as Yinuo, open `/play/<childId>/shop` → tap Decor tab → see 10 cards.
3. Buy 1 decoration with sufficient coins → card flips to "已拥有", balance drops by N, `TrophyToast` for `decor-starter` fires.
4. Open `/play/<childId>` → confirm the purchased decoration renders at its anchor on the island map.
5. Buy all 10 (or use a test child with coins seeded) → confirm `decor-completionist` toast on the 10th purchase.
6. Toggle `prefers-reduced-motion` in DevTools → decor is static, no animation; map still renders correctly.
7. Open the Pet tab and Sound tab → buy a pet and a sound theme to **prove the avatar-only guard fix works** (these are currently broken in prod).
8. Refresh the page → owned decorations + balance + trophies persist.
9. As a shared-pack-only child (no parent_user_id), confirm shop works (per CLAUDE.md landmine: never gate per-child UI on getWeekOwnedBy).
10. Confirm `prefers-reduced-motion` falls through without crashing, and that decorations don't break the IslandMap touch targets for islands.

## 14. CLAUDE.md updates after merge

Add to "Current state" §:
> PR #34 (shipped YYYY-MM-DD) — Island decorations. 4th live shop tab (Decor). New `decorations` table + `shop_item_kind` enum value `'decor'`. 10 hand-rolled SVG items, auto-show on the island map at fixed anchors; ownership = `shop_purchases` row. New trophies `decor-starter` / `decor-completionist`. **Also fixes a pre-existing platform bug**: `purchaseShopItemInTx` previously hardcoded `kind === 'avatar'`, silently blocking pet (PR #33) and sound theme (PR #31) purchases. With #34, all 4 shop tabs are purchasable.

Add to "Landmines":
> **Shop purchase dispatch must include all purchasable kinds.** `purchaseShopItemInTx` was avatar-only in PRs #21–#33; PR #34 added a `switch (kind)` dispatch. When adding a new shop kind, extend the switch — don't add a parallel purchase action, or you'll fragment the coin-debit and trophy-grant logic.

> **Decor anchors live in TS, not DB.** `src/lib/decor/anchors.ts` is the source of truth for positions. The DB stores only the anchor slug; the TS map resolves slug → coords. To move a decoration, edit `anchors.ts` and redeploy — no migration. To add a new decoration, add an entry to both `DECOR_CATALOG` and `ANCHORS`, add an SVG component, extend the seed script.

## 15. Implementation order (preview for plan stage)

(Detailed tasks come in the plan doc.)

1. **Schema & migration** — `decorations` table + `'decor'` enum value + generate migration.
2. **DB layer** — `src/lib/db/decor.ts` with the two query helpers.
3. **Purchase dispatch fix** — refactor `purchaseShopItemInTx` to dispatch on `kind`. Tests for decor, pet, sound_theme; regression test for unsupported kinds.
4. **Anchor + catalog files** — `src/lib/decor/anchors.ts` + `src/lib/decor/catalog.tsx`. Catalog test.
5. **10 SVG components** — `src/components/play/decorations/*.tsx`. Render test per component.
6. **IslandMap render layer** — extend props + render group.
7. **Trophy integration** — extend `TrophyCheckContext`, add `countOwnedDecorations`, wire into `purchaseShopItemAction`. Test.
8. **Shop UI** — `DecorTabBody.tsx`, enable tab in `ShopCategoryTabs`, wire into `ShopBody`. Tests.
9. **Page wiring** — `/play/[childId]/page.tsx` adds the `listOwnedDecorationsForChild` call, passes to IslandMap.
10. **Seed scripts** — `seed-decorations.ts`, extend `seed-trophies.ts`. Smoke-run locally + prod after merge.

## 16. Risk & rollback

- **Catalog/anchor drift:** caught by `decor-catalog.test.ts` (catalog ⊆ anchors, all anchors unique).
- **Migration:** standard append-only enum + table; no destructive change. Rollback = drop the new table + `ALTER TYPE` is irreversible but inert if no rows of that kind exist.
- **Purchase dispatch refactor:** the change touches a critical path (avatar purchase). Regression tests cover the avatar branch unchanged; the new branches add coverage. If a P0 surfaces, the rollback is a 1-line revert of the `switch` to the old `if (kind !== 'avatar') throw`.
- **IslandMap layer:** added behind a default-empty `decorations` prop, so a bug in the catalog can't break children with no purchases.
