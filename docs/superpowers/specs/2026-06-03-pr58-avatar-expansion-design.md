# PR #58 — Avatar Expansion + Multi-Theme — Design

**Status:** approved (David, 2026-06-03)
**Branch:** `feat/pr58-avatar-expansion`
**Owner:** Claude + David

---

## 1. Goal

Enrich the avatar customization system from David's playtest feedback: expand from 4 slots to 7 (adds **hair**, **pants**, **decor**), introduce a 2-theme model (**Pirate** + **Caribbean**) via a tag-and-filter mechanism, and grow the catalog from 22 items to ~40. Themes are pure categorization — items mix-and-match freely.

## 2. Why

Yinuo's playtest with the current avatar surface showed cosmetic options were thin (4 slots, all pirate). David explicitly asked for more body slots (hair, pants, background decor) and multi-theme content (with Caribbean Sea highlighted because of its Map 1 tie-in). Multi-theme infrastructure also opens the door for future map-themed packs (Indian Ocean, Space, etc.) without further schema changes.

## 3. Scope

### Locked decisions

| Decision | Choice |
|---|---|
| Total slots | 7 (existing 4 + hair + pants + decor) |
| Slot layering (back → front) | background → decor → head → pants → top → hair → hat |
| Themes in v1 | `'pirate'`, `'caribbean'` |
| Theme model | Tag + shop chip filter (no purchase coupling, mix-and-match allowed) |
| Default decor | Empty (decor is optional/expressive, not required for a complete look) |
| New defaults | `default-hair-brown` (short brown bob), `default-pants-blue` (basic blue shorts) |
| Pricing | Existing rarity tiers from PR #21 (common 80-150 / rare 250-400 / epic 600-900) |
| Total items | ~40 post-ship: 22 existing + 17 new (6 pirate + 11 caribbean) |

### Non-goals

- Theme-locked items (Caribbean shoppable regardless of current map)
- Outfit bundles / "sets" purchase flow
- Animated avatar items
- Custom avatar items uploaded by parents
- Per-week limited cosmetic drops
- Pants below-knee detail (shorts only — keeps SVG simple at the avatar render size)
- Shoes, accessories (necklace/glasses), hand-held items — explicit v2 candidates
- Migrating Map 2 to ship with avatar items (Map 2 still has 0 weeks; Indian Ocean items would be a future PR if/when Map 2 authors content)

## 4. Architecture

### 4.1 Slot expansion

`src/lib/avatar/defaultLook.ts`:

```ts
export const AVATAR_SLOT_IDS = [
  'background',
  'decor',
  'head',
  'pants',
  'top',
  'hair',
  'hat',
] as const;
export type AvatarSlotId = (typeof AVATAR_SLOT_IDS)[number];

export const DEFAULT_AVATAR = {
  head: 'default-kid-warm',
  hat: 'default-bandana-red',
  top: 'default-tee-stripes',
  background: 'default-ocean',
  hair: 'default-hair-brown',
  pants: 'default-pants-blue',
  // decor intentionally absent: decor is optional/expressive only
} as const;

export const SLOT_DISPLAY_NAMES: Record<AvatarSlotId, string> = {
  background: '背景',
  decor: '装饰',
  head: '脸',
  pants: '裤子',
  top: '上衣',
  hair: '发型',
  hat: '帽子',
};
```

The slot array order is **also the SVG rendering order** — back to front. `AvatarRender` composes one `<g>` per slot in this order. Slots without an equipped item render nothing (no fallback box).

### 4.2 Theme tag

Schema migration 0020 adds a single column:

```sql
ALTER TABLE avatar_items ADD COLUMN theme text;
CREATE INDEX idx_avatar_items_theme ON avatar_items(theme);
```

Backfill (in the migrate.ts seed pass, after schema migrations):

```sql
UPDATE avatar_items SET theme = 'pirate' WHERE theme IS NULL;
```

Then new items get seeded with their theme via the existing `scripts/seed-shop-avatar-items.ts` (extended).

Theme value union (purely TypeScript-level, not a pgEnum — keeps it cheap to add themes later without migrations):

```ts
export type AvatarTheme = 'pirate' | 'caribbean';
export const AVATAR_THEMES: readonly AvatarTheme[] = ['pirate', 'caribbean'] as const;
export const THEME_DISPLAY_NAMES: Record<AvatarTheme, { zh: string; en: string }> = {
  pirate: { zh: '海盗', en: 'Pirate' },
  caribbean: { zh: '加勒比', en: 'Caribbean' },
};
```

### 4.3 Item catalog

`src/lib/avatar/itemCatalog.tsx` extends:

- Each existing entry gains `theme: 'pirate'`.
- New entries: 6 pirate items (2 hair / 2 pants / 2 decor) + 11 Caribbean items (1 head / 2 hats / 2 hair / 2 tops / 2 pants / 1 decor / 1 background).
- Each item still has an inline SVG component. New components added per item — no shared rendering logic.

Catalog entry shape grows by one field:

```ts
export interface AvatarItemMeta {
  id: string;
  slot: AvatarSlotId;
  rarity: ItemRarity;
  priceCoins: number;
  unlockVia: 'default' | 'shop';
  displayName: { zh: string; en: string };
  theme: AvatarTheme;             // NEW (required, non-nullable in the meta map)
  Component: ComponentType<{ size: number }>;
}
```

The default items also carry a theme (`'pirate'` for the original 4; `'pirate'` for the new `default-hair-brown` + `default-pants-blue` since they're styled to match the existing pirate kid look).

### 4.4 AvatarRender extension

`src/components/play/AvatarRender.tsx` — add 3 new `<g>` groups inside the existing SVG composition. The slot iteration just uses `AVATAR_SLOT_IDS` as the rendering order, so adding the 3 new ids to the array auto-extends the render with no other code change. Verify the current code maps over the array (vs. hardcoding 4 groups) — if hardcoded, refactor to iterate.

### 4.5 Shop UI — theme chip filter

`src/components/shop/AvatarTabBody.tsx` (or wherever the avatar shop tab renders):

- New `<ThemeChipStrip>` component at the top of the avatar tab
- Chips: `[All] [Pirate] [Caribbean]`, default selected = `All`
- Selecting a chip filters the displayed items to that theme (or all)
- Filter is client-side only — items are already loaded
- Items the kid already owns stay visible in any filter (with the "Owned" / "Equipped" badge)
- Default-look items (unlock_via='default') show in their theme filter only — not in 'all' as separate entries, since they're already equipped and the kid doesn't need to buy them again. Actually re-check: the existing avatar tab shows owned items too (so the kid can re-equip them). Defaults are always "Equipped". They show in 'all' AND their theme.

Visual: chip strip uses the same pill style as existing `ShopCategoryTabs` (rounded full, sky-tinted active state).

### 4.6 New seed data

`scripts/seed-shop-avatar-items.ts` extended to:
1. Idempotently insert the 17 new items (slug-based ON CONFLICT DO NOTHING).
2. Update theme on existing items to `'pirate'` if NULL.
3. The 2 new defaults (`default-hair-brown`, `default-pants-blue`) get `unlock_via='default'`.

After PR merges: run the seed script against prod once. Idempotent so re-running is harmless. Add `pnpm db:seed-avatar` script or document the manual `pnpm tsx scripts/seed-shop-avatar-items.ts` invocation in CLAUDE.md.

## 5. Content design — the 17 new items

### Pirate additions (6)
- **Hair**: `pirate-hair-black-long` (rare, 280c), `pirate-hair-dreads-brown` (rare, 320c) — long pirate locks
- **Pants**: `pirate-pants-ragged-tan` (common, 120c), `pirate-pants-stripe-navy` (rare, 280c) — torn / striped trousers
- **Decor**: `decor-pirate-flag` (rare, 350c), `decor-ship-mast` (epic, 700c) — Jolly Roger / ship rigging in background

### Caribbean additions (11)
- **Head**: `carib-kid-tan` (common, default-style, 100c) — sun-kissed skin
- **Hats**: `carib-strawhat` (common, 100c), `carib-hibiscus-band` (rare, 290c) — straw hat / flower hair band
- **Hair**: `carib-hair-braids-blonde` (rare, 280c), `carib-hair-curls-honey` (common, 140c)
- **Tops**: `carib-shirt-hibiscus` (rare, 320c), `carib-tank-coral` (common, 130c) — floral / tank top
- **Pants**: `carib-shorts-aqua` (common, 110c), `carib-skirt-tropical` (rare, 280c)
- **Decor**: `carib-palmtree` (rare, 330c) — palm tree
- **Background**: `carib-beach-sunset` (epic, 800c) — beach with sunset

Names use slug form for stable identity. Display names render via `displayName` zh/en pair in catalog.

## 6. Data flow

```
Parent / kid view of /play/[childId]/shop
    ↓
AvatarTabBody loads listShopItems({ kind: 'avatar' })
    ↓
Renders <ThemeChipStrip> on top (default = All)
    ↓
Filters catalog by theme client-side
    ↓
Kid taps item → existing purchase + equip flow (PR #21) — no change
    ↓
On equip: writes to child_avatar_equipped, AvatarRender pulls from getEquippedAvatar
    ↓
AvatarRender iterates AVATAR_SLOT_IDS in order, renders <g> per slot
```

No new server actions. No new tables (just one column).

## 7. Tests

**New test files:**
- `tests/unit/avatar/avatar-render.test.tsx`:
  - Renders all 7 slots in correct z-order
  - Empty `decor` slot renders nothing (no error)
  - Default look composes correctly
- `tests/unit/avatar/theme-filter.test.tsx`:
  - Chip strip renders 3 chips: All / Pirate / Caribbean
  - Selecting 'Pirate' filters items to theme='pirate' only
  - Selecting 'All' shows everything
  - Owned/equipped items stay visible regardless of filter
- `tests/unit/avatar/item-catalog.test.ts`:
  - Every slot has at least 1 item per theme (post-seed coverage check)
  - All slot IDs in DEFAULT_AVATAR exist in AVATAR_SLOT_IDS
  - decor is excluded from DEFAULT_AVATAR (intentional)
  - Every item has a `theme` field set
- `tests/unit/avatar/avatar-tab-body.test.tsx`:
  - Pre-existing tests adapted to the chip strip + 7 slots

**Updated test files:**
- `tests/unit/avatar-render*.test.tsx` (if exists) — extend for new slots
- `tests/unit/shop-db.test.ts` — assert avatar items survive theme column addition

**Estimated:** +20 to +25 new tests.

## 8. Verification

Pre-merge:
1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — four green.
2. `pnpm dev` → log in → home → confirm avatar renders with default look (now includes hair + pants).
3. Shop > Avatar tab → confirm chip strip at top.
4. Tap 'Pirate' chip → only pirate items shown.
5. Tap 'Caribbean' chip → only caribbean items shown.
6. Tap 'All' → everything.
7. Buy a Caribbean hair piece → equip → confirm renders on AvatarRender.
8. Mix-and-match: Caribbean hair + pirate hat = both render correctly with hair under hat.

Post-merge ops:
```bash
pnpm tsx scripts/seed-shop-avatar-items.ts
```
(Idempotent; safe to re-run.)

## 9. Open questions / v2 candidates

- **Shoes slot** — not in v1 because at avatar render size shoes are barely visible. v2 if it adds expressive value.
- **Accessory slot** (glasses, necklace, earrings) — v2 candidate.
- **Hand-held item slot** (sword, lantern, parrot perch) — Yinuo would love a parrot but it'd need its own animation slot.
- **Indian Ocean theme** — natural 3rd theme once Map 2 has content. PR #59+ candidate.
- **Space / Exploration themes** — David's original brainstorm list, deferred to PR #60+.
- **Animated avatar items** (parrot blinking, hair waving in wind) — v2.
- **Outfit bundle purchase** — v2; Reading-Eggs-style "Pirate Captain Kit" 4-piece set with discount.
- **Theme unlock via map progression** — deferred; current model is purely cosmetic categorization.

## 10. Landmines / things to preserve

- **`AVATAR_SLOT_IDS` array order IS the SVG render order.** Reordering breaks layering — e.g. swapping hair before head would draw hair under the face. Don't sort alphabetically; the array order is semantic.
- **`decor` has no default.** `DEFAULT_AVATAR` deliberately omits the `decor` key. Code that iterates equipped items must handle missing keys gracefully (Object key check, not array indexing). The kid's first session shows no decor — purchase / equip is the only path to a non-empty decor slot.
- **Theme is text, not enum.** Migration 0020 uses `text` not `pgEnum` so future theme additions don't require migrations. Adds a small risk of typo-bug (`'caribbeen'` would silently pass DB validation) — mitigate by validating against the TS `AvatarTheme` union at the action layer.
- **Existing 22 items default to theme='pirate' via backfill.** If you add a non-pirate item BEFORE running the seed script, the `WHERE theme IS NULL` backfill will set it to 'pirate' incorrectly. Always set theme at seed time for new items.
- **`getEquippedAvatar` returns a `Record<slot, {avatarItemId, unlockRef, ...}>`-shaped map.** PR #48's narrative-hint feature reads `.unlockRef` per slot. The 3 new slots need narrative hints too (`narrativeHint` field on the new items in itemCatalog) so Story Mode chapter prompts include them.
- **PR #50's `SpeakButton` and Story Mode `ChapterAudioButton`** consume the avatar through `AvatarRender` for the hero card. Adding 3 new slots = AvatarRender will composite 3 more SVG groups. Verify no z-index conflicts (the new groups use the SVG document order; no `z-index` CSS needed).

## 11. Effort + rollout

- ~10 implementation tasks: schema migration, slot expansion in defaultLook, item catalog extension (17 new items + 17 SVG components), AvatarRender slot iteration, ThemeChipStrip + AvatarTabBody wiring, seed script extension, tests, CLAUDE.md, verify, PR
- ~25 files touched
- 1 migration (0020) + 1 seed script run post-merge
- No recompile required (avatar isn't tied to scene compile)
- No prod data risk: additive schema, optional column, idempotent seed
- Rollout: PR → four-green gate → merge → auto-migrate on Vercel build (PR #53) → run seed script against prod once
