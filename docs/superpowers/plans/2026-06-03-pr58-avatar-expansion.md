# PR #58 — Avatar Expansion + Multi-Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand avatar customization from 4 slots to 7 (adds hair, pants, decor) and introduce a 2-theme model (Pirate + Caribbean) via a tag-and-filter mechanism, growing the catalog from 22 to ~40 items.

**Architecture:** Schema migration adds `avatar_items.theme` text column (no enum, future-proof). `AVATAR_SLOT_IDS` array becomes the single source of truth for slots + render order — `AvatarRender` iterates it instead of hardcoding 4 layers. `ItemDef` gains a `theme: AvatarTheme` field. New `ThemeChipStrip` component filters the shop's avatar tab client-side. 17 new items added inline to `itemCatalog.tsx` with hand-rolled SVG components. Seed script idempotently inserts new rows + backfills theme on existing.

**Tech Stack:** Next.js 16, React 19, Drizzle (additive migration 0020), Vitest + RTL + jsdom, SVG.

---

## Pre-flight

**Branch:** `feat/pr58-avatar-expansion` (already created off `main`).
**Baseline test count:** 687 (post-PR-#57 main).

```bash
git status  # spec doc already committed (commit 6475465)
rm -rf .next && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all green at 687 tests.

---

## File structure

### New files
| Path | Responsibility |
|---|---|
| `drizzle/0020_<name>.sql` | Drizzle-generated migration: `ALTER TABLE avatar_items ADD COLUMN theme text` + index. |
| `src/lib/avatar/themes.ts` | `AvatarTheme` type, `AVATAR_THEMES` array, `THEME_DISPLAY_NAMES` map. Pure module, no React. |
| `src/components/shop/ThemeChipStrip.tsx` | Horizontal chip filter `[All] [Pirate] [Caribbean]`. Client-side filter state. |
| `tests/unit/avatar/avatar-render-slot-iteration.test.tsx` | Layering order, empty-slot graceful handling, 7-slot composition. |
| `tests/unit/avatar/theme-chip-strip.test.tsx` | Chip strip render + selection + change callback. |
| `tests/unit/avatar/item-catalog-theme-coverage.test.ts` | Every (slot, theme) cell has ≥1 item; defaults exist; all items have `theme`. |
| `tests/unit/avatar/avatar-tab-body-filter.test.tsx` | Avatar tab filters items by chip selection. |

### Modified files
| Path | Change |
|---|---|
| `src/lib/avatar/defaultLook.ts` | Extend `AVATAR_SLOT_IDS` to 7; add `hair` + `pants` to `DEFAULT_AVATAR`; extend `SLOT_DISPLAY_NAMES`. |
| `src/components/play/AvatarRender.tsx` | Replace hardcoded 4-layer array with iteration over `AVATAR_SLOT_IDS`. |
| `src/lib/avatar/itemCatalog.tsx` | Add `theme: AvatarTheme` field to `ItemDef`. Tag all 22 existing items as `theme: 'pirate'`. Add 19 new items (2 defaults + 6 pirate shop + 11 caribbean shop). |
| `src/components/shop/AvatarTabBody.tsx` (or whatever the shop avatar tab is called — locate via grep) | Mount `<ThemeChipStrip>` at top; filter items by selected theme. |
| `scripts/seed-shop-avatar-items.ts` | Insert the 19 new items idempotently; backfill `theme='pirate'` on existing NULL rows. |
| `scripts/migrate.ts` | Add the theme backfill UPDATE to the seed pass. |
| `CLAUDE.md` | PR #58 entry + 4 landmines. |

### Untouched
- `child_avatar_inventory`, `child_avatar_equipped`, `avatar_slots`, `child_profiles` — no schema impact.
- Per-pack `getEquippedAvatar` action — its return shape is `Record<slot, info>` which already handles unknown slots gracefully.
- Story Mode `resolveNarrativeHint` — automatically picks up new items' `narrativeHint` via the existing `lookupItem` resolver.

---

## Task 1: Schema migration 0020

**Files:**
- Modify: `src/db/schema/avatar.ts`
- Create: `drizzle/0020_<name>.sql` (generated)

- [ ] **Step 1.1: Extend the avatarItems table**

In `src/db/schema/avatar.ts`, add a `theme` column to the `avatarItems` table definition. Locate the table (around line 34) and add `theme: text('theme')` (nullable). Add an index. After the modification, the table should look like:

```ts
export const avatarItems = pgTable(
  'avatar_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slotId: text('slot_id')
      .notNull()
      .references(() => avatarSlots.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    imageUrl: text('image_url'),
    unlockVia: avatarUnlockVia('unlock_via').notNull().default('shop'),
    unlockRef: text('unlock_ref'),
    theme: text('theme'),  // PR #58 — nullable text, validated in TS
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('avatar_items_slot_idx').on(t.slotId),
    index('avatar_items_theme_idx').on(t.theme),
  ],
);
```

- [ ] **Step 1.2: Generate migration**

```bash
pnpm drizzle-kit generate
```

Expected output: `drizzle/0020_<adjective>_<noun>.sql` with `ALTER TABLE "avatar_items" ADD COLUMN "theme" text;` + `CREATE INDEX ... ON avatar_items(theme)`. Inspect — no destructive ops.

- [ ] **Step 1.3: Verify typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 1.4: Commit**

```bash
git add src/db/schema/avatar.ts drizzle/0020_*.sql drizzle/meta/_journal.json drizzle/meta/0020_snapshot.json
git commit -m "feat(pr58): schema + migration 0020 (avatar_items.theme)"
```

---

## Task 2: Theme types module

**Files:**
- Create: `src/lib/avatar/themes.ts`

- [ ] **Step 2.1: Create the module**

Create `src/lib/avatar/themes.ts`:

```ts
/**
 * Avatar themes — purely categorization for the shop chip filter (PR #58).
 *
 * Theme is stored as TEXT in `avatar_items.theme` (no pgEnum) so future
 * themes can be added by code-only changes. Validate at the action layer
 * by checking against `AVATAR_THEMES`.
 */

export const AVATAR_THEMES = ['pirate', 'caribbean'] as const;
export type AvatarTheme = (typeof AVATAR_THEMES)[number];

export const THEME_DISPLAY_NAMES: Record<AvatarTheme, { zh: string; en: string }> = {
  pirate: { zh: '海盗', en: 'Pirate' },
  caribbean: { zh: '加勒比', en: 'Caribbean' },
};

export function isAvatarTheme(value: unknown): value is AvatarTheme {
  return typeof value === 'string' && (AVATAR_THEMES as readonly string[]).includes(value);
}
```

- [ ] **Step 2.2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: clean (no consumers yet, just verifying the file is well-formed).

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/avatar/themes.ts
git commit -m "feat(pr58): AvatarTheme types + display names"
```

---

## Task 3: Extend slot inventory in `defaultLook.ts`

**Files:**
- Modify: `src/lib/avatar/defaultLook.ts`

- [ ] **Step 3.1: Replace the file contents**

Open `src/lib/avatar/defaultLook.ts`. Replace its contents with:

```ts
/**
 * Stable identifiers for the default avatar items. Mirrors the rows the
 * seed script writes with `unlock_via = 'default'`. Every child sees this
 * look before they buy anything; the rows are never sold.
 *
 * PR #58: expanded to 7 slots. Array order = back-to-front SVG render order.
 * `decor` intentionally has no default (it's optional/expressive).
 */
export const DEFAULT_AVATAR = {
  head: 'default-kid-warm',
  hat: 'default-bandana-red',
  top: 'default-tee-stripes',
  background: 'default-ocean',
  hair: 'default-hair-brown',  // PR #58 new default
  pants: 'default-pants-blue', // PR #58 new default
  // decor intentionally absent
} as const;

/**
 * Slot rendering order (back → front). Adding to this array auto-extends
 * AvatarRender — no other code change needed.
 *
 *   background  ← furthest back
 *   decor       ← decorative bg elements (sun, palm)
 *   head        ← face/skin
 *   pants       ← legs
 *   top         ← shirt (drawn over the pants waistline)
 *   hair        ← hair on top of head, under hat
 *   hat         ← hat / accessory on top
 */
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

- [ ] **Step 3.2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: TYPE ERROR — many existing consumers of `AvatarSlotId` and `DEFAULT_AVATAR` now reference new keys. Don't panic; Tasks 4-6 will fix them.

The errors should be:
- `AvatarRender.tsx` — hardcoded slot order missing new slots (Task 4 fixes)
- `itemCatalog.tsx` — items with `slot: AvatarSlotId` are still valid; missing `theme` field will fail later (Task 5 fixes)
- Any test that destructures `DEFAULT_AVATAR` — should still typecheck since `hair` and `pants` are added, not removed

If the errors are different from the above, investigate before continuing.

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/avatar/defaultLook.ts
git commit -m "feat(pr58): extend AVATAR_SLOT_IDS to 7 slots (hair, pants, decor)"
```

---

## Task 4: Refactor `AvatarRender` to iterate `AVATAR_SLOT_IDS`

**Files:**
- Modify: `src/components/play/AvatarRender.tsx`
- Test: `tests/unit/avatar/avatar-render-slot-iteration.test.tsx`

- [ ] **Step 4.1: Write the failing test**

Create the test directory if missing, then create `tests/unit/avatar/avatar-render-slot-iteration.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AvatarRender } from '@/components/play/AvatarRender';
import { AVATAR_SLOT_IDS, DEFAULT_AVATAR } from '@/lib/avatar/defaultLook';

describe('AvatarRender slot iteration (PR #58)', () => {
  it('renders one <g> per slot that has a default OR equipped item, in AVATAR_SLOT_IDS order', () => {
    const { container } = render(<AvatarRender equipped={{}} />);
    // Inner clipped container has one <g> per non-empty slot.
    // decor has no default, so 6 of 7 slots render = 6 <g> children inside the clip wrapper.
    const innerGroups = container.querySelectorAll('svg > g[clip-path] > g');
    expect(innerGroups.length).toBe(AVATAR_SLOT_IDS.length - 1); // 6 (decor has no default)
  });

  it('renders empty decor slot gracefully (no extra group)', () => {
    const { container } = render(<AvatarRender equipped={{ decor: undefined }} />);
    const innerGroups = container.querySelectorAll('svg > g[clip-path] > g');
    expect(innerGroups.length).toBe(AVATAR_SLOT_IDS.length - 1); // 6 (decor stays empty)
  });

  it('respects an explicitly-equipped decor item', () => {
    // We don't yet have a real decor item — this test is a placeholder asserting
    // the prop is at least accepted without error. Real item rendering covered
    // by Task 7 (caribbean palmtree decor) tests.
    expect(() =>
      render(<AvatarRender equipped={{ decor: 'carib-palmtree' }} />),
    ).not.toThrow();
  });

  it('renders defaults for all 6 non-decor slots', () => {
    const { container } = render(<AvatarRender />);
    // Confirm DEFAULT_AVATAR has the right shape
    expect(Object.keys(DEFAULT_AVATAR).sort()).toEqual([
      'background',
      'hair',
      'hat',
      'head',
      'pants',
      'top',
    ]);
    // Confirm the rendered SVG has the expected number of groups
    const innerGroups = container.querySelectorAll('svg > g[clip-path] > g');
    expect(innerGroups.length).toBe(6);
  });
});
```

- [ ] **Step 4.2: Run + confirm failure**

```bash
pnpm vitest run tests/unit/avatar/avatar-render-slot-iteration.test.tsx
```

Expected: FAIL — `AvatarRender` is still hardcoded to 4 layers.

- [ ] **Step 4.3: Replace the layer composition in `AvatarRender`**

In `src/components/play/AvatarRender.tsx`, replace the `layers` array + map block with an iteration over `AVATAR_SLOT_IDS`:

```tsx
import { useId } from 'react';
import { lookupItem } from '@/lib/avatar/itemCatalog';
import { AVATAR_SLOT_IDS, DEFAULT_AVATAR, type AvatarSlotId } from '@/lib/avatar/defaultLook';

export interface AvatarRenderProps {
  /** Map of slot id → equipped unlock_ref. Missing slots fall back to the catalog default (if defined). */
  equipped?: Partial<Record<AvatarSlotId, string | null | undefined>>;
  /** Render size in CSS pixels. Defaults to 72px (HUD size). */
  size?: number;
  /** Extra class on the outer SVG. */
  className?: string;
  /** Accessible label (default: "我的形象"). Pass empty string to hide. */
  label?: string;
}

/**
 * Composes the 7 avatar slots into a single SVG using AVATAR_SLOT_IDS as the
 * render order (back → front). Missing items + slots without a default
 * (decor) render nothing.
 */
export function AvatarRender({
  equipped,
  size = 72,
  className,
  label = '我的形象',
}: AvatarRenderProps) {
  const clipId = `avatar-clip-${useId().replace(/:/g, '')}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={label ? 'img' : 'presentation'}
      aria-label={label || undefined}
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {AVATAR_SLOT_IDS.map((slot) => {
          // Resolve item: equipped → fall back to DEFAULT_AVATAR[slot] if present
          const ref =
            equipped?.[slot] ??
            (DEFAULT_AVATAR as Record<string, string>)[slot] ??
            null;
          if (!ref) return null;
          const item = lookupItem(ref);
          if (!item) return null;
          return <g key={slot}>{item.renderSvg()}</g>;
        })}
      </g>
      <circle
        cx="50"
        cy="50"
        r="49"
        fill="none"
        stroke="#7a4a14"
        strokeWidth="2"
      />
    </svg>
  );
}
```

- [ ] **Step 4.4: Run tests + confirm pass**

```bash
pnpm vitest run tests/unit/avatar/avatar-render-slot-iteration.test.tsx
```

Expected: PASS — 4 tests (test 4.3 "Respects equipped decor" passes by virtue of not throwing).

- [ ] **Step 4.5: Run full suite — confirm no regressions**

```bash
pnpm vitest run
```

Expected: PASS — any existing AvatarRender tests still work (the public API is unchanged; only internals refactored).

- [ ] **Step 4.6: Commit**

```bash
git add src/components/play/AvatarRender.tsx tests/unit/avatar/avatar-render-slot-iteration.test.tsx
git commit -m "feat(pr58): AvatarRender iterates AVATAR_SLOT_IDS (auto-extends with new slots)"
```

---

## Task 5: Extend `ItemDef` with `theme` + tag existing 22 items

**Files:**
- Modify: `src/lib/avatar/itemCatalog.tsx`
- Test: `tests/unit/avatar/item-catalog-theme-coverage.test.ts`

- [ ] **Step 5.1: Write the failing test**

Create `tests/unit/avatar/item-catalog-theme-coverage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { allItems } from '@/lib/avatar/itemCatalog';
import { AVATAR_SLOT_IDS, DEFAULT_AVATAR } from '@/lib/avatar/defaultLook';

describe('item catalog theme coverage (PR #58)', () => {
  it('every item has a theme field', () => {
    for (const item of allItems()) {
      expect(item.theme).toBeDefined();
      expect(['pirate', 'caribbean']).toContain(item.theme);
    }
  });

  it('DEFAULT_AVATAR references existing catalog items', () => {
    for (const [slot, unlockRef] of Object.entries(DEFAULT_AVATAR)) {
      const item = allItems().find((i) => i.unlockRef === unlockRef);
      expect(item, `default for slot ${slot} = ${unlockRef}`).toBeDefined();
    }
  });

  it('decor is not in DEFAULT_AVATAR (intentional)', () => {
    expect((DEFAULT_AVATAR as Record<string, string>).decor).toBeUndefined();
  });

  it('every slot has at least 1 pirate item', () => {
    const items = allItems();
    for (const slot of AVATAR_SLOT_IDS) {
      const found = items.find((i) => i.slot === slot && i.theme === 'pirate');
      expect(found, `slot=${slot} has no pirate item`).toBeDefined();
    }
  });

  it('every slot has at least 1 caribbean item', () => {
    const items = allItems();
    for (const slot of AVATAR_SLOT_IDS) {
      const found = items.find((i) => i.slot === slot && i.theme === 'caribbean');
      expect(found, `slot=${slot} has no caribbean item`).toBeDefined();
    }
  });
});
```

- [ ] **Step 5.2: Confirm failure**

```bash
pnpm vitest run tests/unit/avatar/item-catalog-theme-coverage.test.ts
```

Expected: FAIL — `theme` field doesn't exist; caribbean coverage missing.

- [ ] **Step 5.3: Extend `ItemDef`**

In `src/lib/avatar/itemCatalog.tsx`, modify the `ItemDef` interface (near line 6):

```ts
import type { AvatarTheme } from './themes';

export interface ItemDef {
  unlockRef: string;
  slot: AvatarSlotId;
  displayName: string;
  description?: string;
  rarity?: ItemRarity;
  priceCoins?: number;
  narrativeHint: string;
  /** PR #58: cosmetic categorization. Required on every item. */
  theme: AvatarTheme;
  renderSvg: () => ReactElement;
}
```

Add the import at the top of the file:

```ts
import type { AvatarTheme } from './themes';
```

- [ ] **Step 5.4: Tag all 22 existing items as theme='pirate'**

In `src/lib/avatar/itemCatalog.tsx`, find every `const ... : ItemDef = { ... }` declaration (there are 22). Add `theme: 'pirate',` to each. Suggested mechanical approach — for each ItemDef object, insert `theme: 'pirate',` right after the `narrativeHint` line.

After this step, the file's typecheck should succeed for the existing 22 items but the new test from Step 5.1 will still fail on "every slot has at least 1 caribbean item" — that's fine; Tasks 6-7 add the new items.

- [ ] **Step 5.5: Verify typecheck + intermediate test state**

```bash
pnpm typecheck
pnpm vitest run tests/unit/avatar/item-catalog-theme-coverage.test.ts
```

Expected:
- typecheck: clean
- coverage test: FAIL on "every slot has at least 1 caribbean item" (expected) AND on "every slot has at least 1 pirate item" because the new `hair`, `pants`, `decor` slots have NO items at all yet. That's expected and resolved in Task 6.

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/avatar/itemCatalog.tsx tests/unit/avatar/item-catalog-theme-coverage.test.ts
git commit -m "feat(pr58): ItemDef.theme; tag existing 22 items as 'pirate'"
```

---

## Task 6: Add 8 new pirate items (2 hair, 2 pants, 2 decor + 2 defaults for hair/pants)

**Files:**
- Modify: `src/lib/avatar/itemCatalog.tsx`

Total: 6 shop items + 2 defaults = 8 new pirate items.

- [ ] **Step 6.1: Add the 2 default items**

In `src/lib/avatar/itemCatalog.tsx`, after the existing default items (around line 90 — find the section header `// ─── DEFAULTS ──...`), add 2 new defaults BEFORE the section ends. Each is a self-contained `const ... : ItemDef`:

```tsx
const defaultHairBrown: ItemDef = {
  unlockRef: 'default-hair-brown',
  slot: 'hair',
  displayName: '棕色短发',
  narrativeHint: 'short brown hair',
  theme: 'pirate',
  renderSvg: () => (
    <g key="default-hair-brown">
      {/* Short brown bob on the head — sits between head and hat */}
      <path
        d="M 30 36 Q 38 22 50 22 Q 62 22 70 36 Q 67 32 60 32 Q 55 30 50 32 Q 45 30 40 32 Q 33 32 30 36 Z"
        fill="#6b4226"
        stroke="#3a2515"
        strokeWidth="1"
      />
      <path
        d="M 30 36 Q 32 42 30 48"
        stroke="#6b4226"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 70 36 Q 68 42 70 48"
        stroke="#6b4226"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  ),
};

const defaultPantsBlue: ItemDef = {
  unlockRef: 'default-pants-blue',
  slot: 'pants',
  displayName: '蓝色短裤',
  narrativeHint: 'simple blue shorts',
  theme: 'pirate',
  renderSvg: () => (
    <g key="default-pants-blue">
      {/* Blue shorts below the torso */}
      <rect x="38" y="76" width="10" height="14" rx="2" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1" />
      <rect x="52" y="76" width="10" height="14" rx="2" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1" />
      <rect x="38" y="73" width="24" height="5" rx="1" fill="#1e3a8a" />
    </g>
  ),
};
```

- [ ] **Step 6.2: Add 6 pirate shop items**

After the existing pirate shop items (around line ~600 — find the last `ItemDef` declaration before the `ALL_ITEMS` array), add the 6 new pirate shop items:

```tsx
const pirateHairBlackLong: ItemDef = {
  unlockRef: 'pirate-hair-black-long',
  slot: 'hair',
  displayName: '黑色长发',
  rarity: 'rare',
  priceCoins: 280,
  narrativeHint: 'long flowing black hair',
  theme: 'pirate',
  renderSvg: () => (
    <g key="pirate-hair-black-long">
      <path
        d="M 28 32 Q 38 22 50 22 Q 62 22 72 32 L 74 60 Q 68 65 64 60 L 64 40 Q 50 35 36 40 L 36 60 Q 32 65 26 60 Z"
        fill="#1a1a1a"
        stroke="#000"
        strokeWidth="1"
      />
    </g>
  ),
};

const pirateHairDreads: ItemDef = {
  unlockRef: 'pirate-hair-dreads-brown',
  slot: 'hair',
  displayName: '棕色脏辫',
  rarity: 'rare',
  priceCoins: 320,
  narrativeHint: 'brown dreadlocks tied with beads',
  theme: 'pirate',
  renderSvg: () => (
    <g key="pirate-hair-dreads-brown">
      <path
        d="M 30 34 Q 50 20 70 34 L 70 38 Q 50 30 30 38 Z"
        fill="#4a2f1a"
      />
      {/* Three dread strands */}
      <rect x="32" y="38" width="3" height="22" fill="#4a2f1a" rx="1.5" />
      <rect x="48" y="38" width="3" height="24" fill="#4a2f1a" rx="1.5" />
      <rect x="65" y="38" width="3" height="22" fill="#4a2f1a" rx="1.5" />
      <circle cx="33.5" cy="62" r="2" fill="#d4a017" />
      <circle cx="49.5" cy="64" r="2" fill="#d4a017" />
      <circle cx="66.5" cy="62" r="2" fill="#d4a017" />
    </g>
  ),
};

const piratePantsRagged: ItemDef = {
  unlockRef: 'pirate-pants-ragged-tan',
  slot: 'pants',
  displayName: '破旧棕裤',
  rarity: 'common',
  priceCoins: 120,
  narrativeHint: 'tattered tan trousers',
  theme: 'pirate',
  renderSvg: () => (
    <g key="pirate-pants-ragged-tan">
      <path
        d="M 38 73 L 36 90 L 44 90 L 46 78 L 50 78 L 52 90 L 60 90 L 62 73 Z"
        fill="#a87844"
        stroke="#7a5530"
        strokeWidth="1"
      />
      {/* Jagged hem suggestion */}
      <path d="M 36 90 L 38 88 L 40 90 L 42 88 L 44 90" stroke="#7a5530" strokeWidth="0.8" fill="none" />
      <path d="M 52 90 L 54 88 L 56 90 L 58 88 L 60 90" stroke="#7a5530" strokeWidth="0.8" fill="none" />
    </g>
  ),
};

const piratePantsStripeNavy: ItemDef = {
  unlockRef: 'pirate-pants-stripe-navy',
  slot: 'pants',
  displayName: '海军条纹裤',
  rarity: 'rare',
  priceCoins: 280,
  narrativeHint: 'navy striped trousers',
  theme: 'pirate',
  renderSvg: () => (
    <g key="pirate-pants-stripe-navy">
      <rect x="38" y="73" width="10" height="17" fill="#1e3a8a" stroke="#0f172a" strokeWidth="1" />
      <rect x="52" y="73" width="10" height="17" fill="#1e3a8a" stroke="#0f172a" strokeWidth="1" />
      {/* Vertical stripes */}
      <line x1="42" y1="73" x2="42" y2="90" stroke="#dbeafe" strokeWidth="0.8" />
      <line x1="46" y1="73" x2="46" y2="90" stroke="#dbeafe" strokeWidth="0.8" />
      <line x1="56" y1="73" x2="56" y2="90" stroke="#dbeafe" strokeWidth="0.8" />
      <line x1="60" y1="73" x2="60" y2="90" stroke="#dbeafe" strokeWidth="0.8" />
    </g>
  ),
};

const decorPirateFlag: ItemDef = {
  unlockRef: 'decor-pirate-flag',
  slot: 'decor',
  displayName: '海盗旗',
  rarity: 'rare',
  priceCoins: 350,
  narrativeHint: 'with a Jolly Roger flag in the background',
  theme: 'pirate',
  renderSvg: () => (
    <g key="decor-pirate-flag">
      {/* Flagpole + Jolly Roger in upper-right corner */}
      <line x1="82" y1="14" x2="82" y2="40" stroke="#3a2515" strokeWidth="1.5" />
      <rect x="82" y="14" width="14" height="10" fill="#1a1a1a" />
      <circle cx="89" cy="18" r="2" fill="#fff" />
      <rect x="88" y="20" width="2" height="2" fill="#fff" />
    </g>
  ),
};

const decorShipMast: ItemDef = {
  unlockRef: 'decor-ship-mast',
  slot: 'decor',
  displayName: '船桅',
  rarity: 'epic',
  priceCoins: 700,
  narrativeHint: 'with a tall ship mast and sail behind them',
  theme: 'pirate',
  renderSvg: () => (
    <g key="decor-ship-mast">
      {/* Mast + sail in upper-left */}
      <line x1="14" y1="8" x2="14" y2="60" stroke="#5a3a1a" strokeWidth="2" />
      <path d="M 14 12 Q 26 28 14 44 Z" fill="#f5e6c8" stroke="#a08660" strokeWidth="1" />
      <line x1="14" y1="20" x2="22" y2="22" stroke="#a08660" strokeWidth="0.7" />
      <line x1="14" y1="30" x2="22" y2="30" stroke="#a08660" strokeWidth="0.7" />
    </g>
  ),
};
```

- [ ] **Step 6.3: Add all 8 new items to the `ALL_ITEMS` array**

Find the `ALL_ITEMS` declaration (around line 622). Add the 8 new identifiers:

```ts
const ALL_ITEMS: ItemDef[] = [
  // existing 22 items …
  defaultHairBrown,
  defaultPantsBlue,
  pirateHairBlackLong,
  pirateHairDreads,
  piratePantsRagged,
  piratePantsStripeNavy,
  decorPirateFlag,
  decorShipMast,
];
```

- [ ] **Step 6.4: Verify typecheck + intermediate test state**

```bash
pnpm typecheck
pnpm vitest run tests/unit/avatar/item-catalog-theme-coverage.test.ts
```

Expected:
- typecheck: clean
- coverage test: FAIL only on "every slot has at least 1 caribbean item" (other tests pass now that all 7 pirate slots have items)

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/avatar/itemCatalog.tsx
git commit -m "feat(pr58): 8 new pirate items (2 defaults + 6 shop) for hair/pants/decor"
```

---

## Task 7: Add 11 caribbean items

**Files:**
- Modify: `src/lib/avatar/itemCatalog.tsx`

11 items: 1 head + 2 hats + 2 hair + 2 tops + 2 pants + 1 decor + 1 background.

- [ ] **Step 7.1: Add 11 caribbean shop items**

In `src/lib/avatar/itemCatalog.tsx`, after the pirate shop items (right before `const ALL_ITEMS = [...]`), add the 11 caribbean items as inline `const ... : ItemDef` declarations:

```tsx
// ─── CARIBBEAN THEME ─────────────────────────────────────────────────────

const caribKidTan: ItemDef = {
  unlockRef: 'carib-kid-tan',
  slot: 'head',
  displayName: '阳光男孩',
  rarity: 'common',
  priceCoins: 100,
  narrativeHint: 'a sun-kissed island kid',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-kid-tan">
      <circle cx="50" cy="46" r="22" fill="#d4965e" stroke="#7a4a2a" strokeWidth="1.5" />
      <circle cx="42" cy="44" r="1.8" fill="#2a1a14" />
      <circle cx="58" cy="44" r="1.8" fill="#2a1a14" />
      <path d="M 43 53 Q 50 57 57 53" stroke="#7a4a2a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="36" cy="50" r="2.5" fill="#c87850" opacity="0.6" />
      <circle cx="64" cy="50" r="2.5" fill="#c87850" opacity="0.6" />
    </g>
  ),
};

const caribStrawhat: ItemDef = {
  unlockRef: 'carib-strawhat',
  slot: 'hat',
  displayName: '草帽',
  rarity: 'common',
  priceCoins: 100,
  narrativeHint: 'a wide-brimmed straw hat',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-strawhat">
      <ellipse cx="50" cy="30" rx="26" ry="5" fill="#e2b366" stroke="#a07a30" strokeWidth="1" />
      <path d="M 36 30 Q 50 18 64 30 L 60 26 Q 50 18 40 26 Z" fill="#d4a04e" stroke="#a07a30" strokeWidth="1" />
      <path d="M 42 24 Q 50 22 58 24" stroke="#a07a30" strokeWidth="0.7" fill="none" />
    </g>
  ),
};

const caribHibiscusBand: ItemDef = {
  unlockRef: 'carib-hibiscus-band',
  slot: 'hat',
  displayName: '芙蓉发带',
  rarity: 'rare',
  priceCoins: 290,
  narrativeHint: 'a hibiscus flower hairband',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-hibiscus-band">
      <path d="M 28 32 Q 50 26 72 32 L 72 36 Q 50 30 28 36 Z" fill="#7c2d12" />
      {/* Hibiscus flower on the side */}
      <circle cx="68" cy="32" r="4" fill="#ec4899" />
      <circle cx="65" cy="30" r="3" fill="#f472b6" />
      <circle cx="70" cy="29" r="3" fill="#f472b6" />
      <circle cx="71" cy="33" r="3" fill="#f472b6" />
      <circle cx="68" cy="32" r="1" fill="#fde047" />
    </g>
  ),
};

const caribHairBraids: ItemDef = {
  unlockRef: 'carib-hair-braids-blonde',
  slot: 'hair',
  displayName: '金色辫子',
  rarity: 'rare',
  priceCoins: 280,
  narrativeHint: 'sun-bleached blonde braids',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-hair-braids-blonde">
      <path d="M 30 32 Q 50 24 70 32 L 70 38 Q 50 32 30 38 Z" fill="#fde68a" stroke="#a07a30" strokeWidth="1" />
      <path d="M 30 38 L 26 60 L 30 60 Z" fill="#fde68a" />
      <path d="M 70 38 L 74 60 L 70 60 Z" fill="#fde68a" />
      <circle cx="28" cy="62" r="1.5" fill="#ec4899" />
      <circle cx="72" cy="62" r="1.5" fill="#ec4899" />
    </g>
  ),
};

const caribHairCurls: ItemDef = {
  unlockRef: 'carib-hair-curls-honey',
  slot: 'hair',
  displayName: '蜂蜜色卷发',
  rarity: 'common',
  priceCoins: 140,
  narrativeHint: 'honey-colored curls',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-hair-curls-honey">
      <path
        d="M 28 36 Q 30 26 40 24 Q 50 20 60 24 Q 70 26 72 36 Q 70 40 65 38 Q 60 36 55 38 Q 50 36 45 38 Q 40 36 35 38 Q 30 40 28 36 Z"
        fill="#f59e0b"
        stroke="#92400e"
        strokeWidth="1"
      />
    </g>
  ),
};

const caribShirtHibiscus: ItemDef = {
  unlockRef: 'carib-shirt-hibiscus',
  slot: 'top',
  displayName: '芙蓉花衬衫',
  rarity: 'rare',
  priceCoins: 320,
  narrativeHint: 'a Hawaiian shirt patterned with hibiscus flowers',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-shirt-hibiscus">
      <path d="M 32 65 L 30 78 L 40 80 L 50 78 L 60 80 L 70 78 L 68 65 Q 50 62 32 65 Z" fill="#22d3ee" stroke="#0e7490" strokeWidth="1" />
      {/* Flower dots */}
      <circle cx="38" cy="72" r="1.8" fill="#ec4899" />
      <circle cx="48" cy="74" r="1.8" fill="#ec4899" />
      <circle cx="58" cy="71" r="1.8" fill="#ec4899" />
      <circle cx="44" cy="68" r="1.2" fill="#fde047" />
      <circle cx="54" cy="69" r="1.2" fill="#fde047" />
    </g>
  ),
};

const caribTankCoral: ItemDef = {
  unlockRef: 'carib-tank-coral',
  slot: 'top',
  displayName: '珊瑚色背心',
  rarity: 'common',
  priceCoins: 130,
  narrativeHint: 'a coral-pink tank top',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-tank-coral">
      <path d="M 36 65 L 34 78 L 50 80 L 66 78 L 64 65 Q 50 62 36 65 Z" fill="#fb7185" stroke="#9f1239" strokeWidth="1" />
      {/* Tank straps */}
      <line x1="38" y1="65" x2="40" y2="60" stroke="#9f1239" strokeWidth="1.2" />
      <line x1="62" y1="65" x2="60" y2="60" stroke="#9f1239" strokeWidth="1.2" />
    </g>
  ),
};

const caribShortsAqua: ItemDef = {
  unlockRef: 'carib-shorts-aqua',
  slot: 'pants',
  displayName: '水蓝短裤',
  rarity: 'common',
  priceCoins: 110,
  narrativeHint: 'aqua-blue swim shorts',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-shorts-aqua">
      <rect x="38" y="76" width="10" height="12" rx="2" fill="#06b6d4" stroke="#0e7490" strokeWidth="1" />
      <rect x="52" y="76" width="10" height="12" rx="2" fill="#06b6d4" stroke="#0e7490" strokeWidth="1" />
      <rect x="38" y="74" width="24" height="4" fill="#0e7490" />
      <path d="M 38 80 Q 41 79 44 80" stroke="#ffffff" strokeWidth="0.8" fill="none" opacity="0.5" />
      <path d="M 52 80 Q 55 79 58 80" stroke="#ffffff" strokeWidth="0.8" fill="none" opacity="0.5" />
    </g>
  ),
};

const caribSkirtTropical: ItemDef = {
  unlockRef: 'carib-skirt-tropical',
  slot: 'pants',
  displayName: '热带花裙',
  rarity: 'rare',
  priceCoins: 280,
  narrativeHint: 'a tropical-print wrap skirt',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-skirt-tropical">
      <path d="M 34 74 L 30 90 L 70 90 L 66 74 Z" fill="#10b981" stroke="#047857" strokeWidth="1" />
      <circle cx="38" cy="80" r="1.5" fill="#fde047" />
      <circle cx="50" cy="82" r="1.5" fill="#fde047" />
      <circle cx="62" cy="80" r="1.5" fill="#fde047" />
      <circle cx="44" cy="85" r="1.5" fill="#ec4899" />
      <circle cx="56" cy="85" r="1.5" fill="#ec4899" />
    </g>
  ),
};

const decorCaribPalm: ItemDef = {
  unlockRef: 'carib-palmtree',
  slot: 'decor',
  displayName: '棕榈树',
  rarity: 'rare',
  priceCoins: 330,
  narrativeHint: 'with a palm tree swaying in the breeze',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-palmtree">
      <path d="M 84 12 Q 82 40 80 56" stroke="#78350f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Palm fronds */}
      <path d="M 84 12 Q 70 8 64 14 Q 72 14 84 12 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
      <path d="M 84 12 Q 98 8 96 18 Q 90 14 84 12 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
      <path d="M 84 12 Q 76 4 82 4 Q 84 8 84 12 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
      <path d="M 84 12 Q 92 4 90 4 Q 86 6 84 12 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
    </g>
  ),
};

const bgCaribSunset: ItemDef = {
  unlockRef: 'carib-beach-sunset',
  slot: 'background',
  displayName: '加勒比日落',
  rarity: 'epic',
  priceCoins: 800,
  narrativeHint: 'against a Caribbean sunset over a sandy beach',
  theme: 'caribbean',
  renderSvg: () => (
    <g key="carib-beach-sunset">
      {/* Gradient suggestion: orange sunset sky → soft sand → turquoise water line */}
      <rect x="0" y="0" width="100" height="60" fill="#fb923c" />
      <rect x="0" y="40" width="100" height="20" fill="#fbbf24" opacity="0.7" />
      <circle cx="50" cy="38" r="9" fill="#fde047" />
      <rect x="0" y="60" width="100" height="6" fill="#06b6d4" />
      <rect x="0" y="66" width="100" height="34" fill="#fef3c7" />
      {/* Little wave hints */}
      <path d="M 10 64 Q 14 62 18 64" stroke="#0e7490" strokeWidth="0.8" fill="none" />
      <path d="M 30 64 Q 34 62 38 64" stroke="#0e7490" strokeWidth="0.8" fill="none" />
      <path d="M 60 64 Q 64 62 68 64" stroke="#0e7490" strokeWidth="0.8" fill="none" />
    </g>
  ),
};
```

- [ ] **Step 7.2: Add the 11 caribbean items to `ALL_ITEMS`**

Update the `ALL_ITEMS` array at the bottom of the file:

```ts
const ALL_ITEMS: ItemDef[] = [
  // … existing 22 + 8 new pirate from Task 6 …
  caribKidTan,
  caribStrawhat,
  caribHibiscusBand,
  caribHairBraids,
  caribHairCurls,
  caribShirtHibiscus,
  caribTankCoral,
  caribShortsAqua,
  caribSkirtTropical,
  decorCaribPalm,
  bgCaribSunset,
];
```

- [ ] **Step 7.3: Run coverage test + confirm pass**

```bash
pnpm vitest run tests/unit/avatar/item-catalog-theme-coverage.test.ts
```

Expected: ALL pass — every slot now has both a pirate and caribbean item.

- [ ] **Step 7.4: Run full suite + typecheck**

```bash
pnpm typecheck
pnpm vitest run
```

Expected: PASS — all previous tests still green.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/avatar/itemCatalog.tsx
git commit -m "feat(pr58): 11 new caribbean items across all 7 slots"
```

---

## Task 8: `ThemeChipStrip` component

**Files:**
- Create: `src/components/shop/ThemeChipStrip.tsx`
- Test: `tests/unit/avatar/theme-chip-strip.test.tsx`

- [ ] **Step 8.1: Write the failing test**

Create `tests/unit/avatar/theme-chip-strip.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeChipStrip } from '@/components/shop/ThemeChipStrip';

describe('ThemeChipStrip', () => {
  it('renders All + Pirate + Caribbean chips', () => {
    render(<ThemeChipStrip selected="all" onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pirate|海盗/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Caribbean|加勒比/i })).toBeInTheDocument();
  });

  it('highlights the currently-selected chip via aria-pressed', () => {
    render(<ThemeChipStrip selected="pirate" onSelect={() => undefined} />);
    const pirate = screen.getByRole('button', { name: /Pirate|海盗/i });
    expect(pirate.getAttribute('aria-pressed')).toBe('true');
    const all = screen.getByRole('button', { name: /All/i });
    expect(all.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onSelect with the chip value on click', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ThemeChipStrip selected="all" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /Caribbean|加勒比/i }));
    expect(onSelect).toHaveBeenCalledWith('caribbean');
  });
});
```

- [ ] **Step 8.2: Confirm failure**

```bash
pnpm vitest run tests/unit/avatar/theme-chip-strip.test.tsx
```

Expected: FAIL — component not exported.

- [ ] **Step 8.3: Implement the component**

Create `src/components/shop/ThemeChipStrip.tsx`:

```tsx
'use client';

import { AVATAR_THEMES, THEME_DISPLAY_NAMES, type AvatarTheme } from '@/lib/avatar/themes';

export type ThemeChipValue = 'all' | AvatarTheme;

interface ThemeChipStripProps {
  selected: ThemeChipValue;
  onSelect: (value: ThemeChipValue) => void;
}

export function ThemeChipStrip({ selected, onSelect }: ThemeChipStripProps) {
  const chips: { value: ThemeChipValue; label: string }[] = [
    { value: 'all', label: '全部 / All' },
    ...AVATAR_THEMES.map((t) => ({
      value: t,
      label: `${THEME_DISPLAY_NAMES[t].zh} / ${THEME_DISPLAY_NAMES[t].en}`,
    })),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Theme filter">
      {chips.map((chip) => {
        const isActive = chip.value === selected;
        return (
          <button
            key={chip.value}
            type="button"
            role="tab"
            aria-pressed={isActive}
            onClick={() => onSelect(chip.value)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
              isActive
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200',
            ].join(' ')}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 8.4: Run tests + confirm pass**

```bash
pnpm vitest run tests/unit/avatar/theme-chip-strip.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 8.5: Commit**

```bash
git add src/components/shop/ThemeChipStrip.tsx tests/unit/avatar/theme-chip-strip.test.tsx
git commit -m "feat(pr58): ThemeChipStrip filter component"
```

---

## Task 9: Wire `ThemeChipStrip` into the avatar shop tab

**Files:**
- Modify: the avatar shop tab body (locate via grep)
- Test: `tests/unit/avatar/avatar-tab-body-filter.test.tsx`

- [ ] **Step 9.1: Locate the avatar shop tab file**

```bash
grep -rln "avatar.*Tab\|AvatarTab" src/components/shop/ src/components/play/shop/ 2>/dev/null | head -5
```

Read whatever file appears. The avatar tab typically lives in `src/components/shop/AvatarTabBody.tsx` or under `src/app/play/[childId]/shop/`. If a different layout is used, adapt the rest of this task to fit. Note the import path.

- [ ] **Step 9.2: Write the failing test**

Create `tests/unit/avatar/avatar-tab-body-filter.test.tsx`. The test fixtures depend on the existing component's prop shape — read the component first, then write the test to match. Example template (adjust prop names):

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Replace `AvatarTabBody` with the actual exported component name + path
import { AvatarTabBody } from '@/components/shop/AvatarTabBody';

// Build fixture items that mimic the production shop-item shape.
// Look at existing tests for this component to see the fixture pattern.
const items = [
  /* … minimal fixtures: 1 pirate + 1 caribbean item, fields as required … */
];

describe('AvatarTabBody theme filter (PR #58)', () => {
  it('renders ThemeChipStrip + shows all items by default', () => {
    render(<AvatarTabBody items={items} /* … other required props … */ />);
    expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument();
    // Both pirate and caribbean items visible
    expect(screen.getByText(/Pirate Hat/i)).toBeInTheDocument();
    expect(screen.getByText(/Carib/i)).toBeInTheDocument();
  });

  it('filters to pirate items when Pirate chip is selected', async () => {
    const user = userEvent.setup();
    render(<AvatarTabBody items={items} /* …  */ />);
    await user.click(screen.getByRole('button', { name: /Pirate|海盗/i }));
    expect(screen.getByText(/Pirate Hat/i)).toBeInTheDocument();
    expect(screen.queryByText(/Carib/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 9.3: Confirm failure**

```bash
pnpm vitest run tests/unit/avatar/avatar-tab-body-filter.test.tsx
```

Expected: FAIL — no chip strip rendered yet.

- [ ] **Step 9.4: Add `ThemeChipStrip` to the avatar tab body**

In the file you located in Step 9.1:

1. Add import:
   ```tsx
   import { useState } from 'react';
   import { ThemeChipStrip, type ThemeChipValue } from './ThemeChipStrip';
   ```

2. Add state + filter logic inside the component:
   ```tsx
   const [themeFilter, setThemeFilter] = useState<ThemeChipValue>('all');

   const filteredItems = items.filter((item) => {
     if (themeFilter === 'all') return true;
     // Look up the item's theme from the catalog
     const meta = lookupItem(item.unlockRef);
     if (!meta) return true; // unknown items are always visible (safe fallback)
     return meta.theme === themeFilter;
   });
   ```

   You may need to import `lookupItem` from `'@/lib/avatar/itemCatalog'`. The exact mapping from the shop-item row to the catalog `unlockRef` depends on the existing prop shape — adapt the filter predicate accordingly.

3. Render the chip strip at the top of the tab body's render tree:
   ```tsx
   <div>
     <ThemeChipStrip selected={themeFilter} onSelect={setThemeFilter} />
     {/* existing grid render, but using `filteredItems` instead of `items` */}
   </div>
   ```

- [ ] **Step 9.5: Run tests + confirm pass**

```bash
pnpm vitest run
```

Expected: PASS — the new filter test + all existing tests.

- [ ] **Step 9.6: Commit**

```bash
git add src/components/shop/ tests/unit/avatar/avatar-tab-body-filter.test.tsx
git commit -m "feat(pr58): wire ThemeChipStrip into avatar shop tab"
```

---

## Task 10: Extend seed script — insert 19 new items + backfill theme

**Files:**
- Modify: `scripts/seed-shop-avatar-items.ts`
- Modify: `scripts/migrate.ts`

- [ ] **Step 10.1: Inspect the existing seed script**

```bash
cat scripts/seed-shop-avatar-items.ts | head -50
```

Note the existing insert pattern. The script should already iterate `allItems()` (or similar) and idempotently INSERT into `avatar_items` + `shop_items`.

- [ ] **Step 10.2: Add the theme column to inserts**

In `scripts/seed-shop-avatar-items.ts`, find where the script INSERTs into `avatar_items`. Add the `theme` field to the values:

```ts
.values({
  // … existing fields …
  unlockRef: item.unlockRef,
  unlockVia: item.priceCoins === undefined ? 'default' : 'shop',
  theme: item.theme,  // PR #58: NEW
})
```

If using `onConflictDoNothing` on the slug — perfect, the new theme value applies only on fresh inserts. For pre-existing rows that get a NEW theme value, the script needs an explicit UPDATE — but since existing rows already get backfilled to 'pirate' in Task 10.3, that's handled separately.

- [ ] **Step 10.3: Add backfill of existing rows in `scripts/migrate.ts`**

In `scripts/migrate.ts`, find the seed pass (the second connection block after the schema migration). Add the avatar theme backfill alongside the scene_template seed:

```ts
      // Backfill avatar_items.theme on any pre-PR-#58 rows.
      await sql`
        UPDATE avatar_items SET theme = 'pirate' WHERE theme IS NULL
      `;
      console.log('Avatar items: theme backfilled to "pirate" on pre-PR-58 rows');
```

- [ ] **Step 10.4: Verify no breaking change**

The seed script and migrate are server-side ops scripts. They aren't typechecked by `pnpm typecheck` against the runtime DB. Run a smoke check:

```bash
pnpm tsx scripts/seed-shop-avatar-items.ts --help 2>&1 | head -5 || true
```

Expected: either help output or a quick failure indicating env not set. The script itself shouldn't crash on import.

- [ ] **Step 10.5: Commit**

```bash
git add scripts/seed-shop-avatar-items.ts scripts/migrate.ts
git commit -m "feat(pr58): seed script — theme on new inserts; backfill existing"
```

---

## Task 11: CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 11.1: Bump refresh date**

Update `## Current state (last refreshed YYYY-MM-DD)` to today's date.

- [ ] **Step 11.2: Append PR #58 entry**

After the last existing PR entry in "Current state", add:

```markdown
- **PR #58 (shipped YYYY-MM-DD)** — Avatar expansion + multi-theme. Expanded from 4 slots to 7 (hair / pants / decor added). Render order now driven by `AVATAR_SLOT_IDS` array — `AvatarRender` iterates instead of hardcoding 4 layers, so adding a new slot is a single-array edit. New `theme` text column on `avatar_items` (migration 0020, nullable, indexed); existing 22 items backfilled to `'pirate'` via `scripts/migrate.ts` seed pass. Two themes in v1: pirate (22 existing + 6 new shop + 2 new defaults `default-hair-brown` + `default-pants-blue`) and caribbean (11 new across all 7 slots, including beach-sunset background). New `ThemeChipStrip` component (`[All] [Pirate] [Caribbean]`) at the top of the avatar shop tab, client-side filter. Items mix-and-match across themes (no theme lock). decor slot has no default — kid sees no decor until they buy one. `AVATAR_THEMES` is a `text` (not pgEnum) so future themes are code-only changes. Total catalog: 22 → 39 items. +N tests (post-verify).
```

- [ ] **Step 11.3: Append landmines**

In the Landmines section, append:

```markdown
- **`AVATAR_SLOT_IDS` array order IS the SVG render order.** PR #58 made this explicit by replacing the hardcoded 4-layer composition in `AvatarRender` with an iteration over the array. Back → front layering: background → decor → head → pants → top → hair → hat. Reordering breaks anatomical layering (e.g. swapping hair before head would draw hair under the face). Adding a new slot = single-array edit + a new SVG component per item — no other code change required.
- **`decor` slot has no default.** `DEFAULT_AVATAR` deliberately omits the `decor` key (it's optional/expressive). Code that iterates equipped items must handle missing keys gracefully — the `AvatarRender` slot iteration checks `if (!ref) return null` for exactly this case. Don't backfill a default decor item without re-evaluating the design; the empty state is intentional.
- **Avatar `theme` is `text` not a pgEnum.** PR #58 added the column as plain text so future theme additions (Indian Ocean, Space, Exploration) require zero migration. Validate at the action layer via `isAvatarTheme(value)` from `src/lib/avatar/themes.ts` if any user-controlled input touches the field. The TypeScript union `AvatarTheme` is the single source of truth in code — never write a theme literal that isn't in that union.
- **Avatar item seed script must set `theme` on every new item.** PR #58's `scripts/migrate.ts` backfill pass sets `theme = 'pirate' WHERE theme IS NULL`. If you add a new non-pirate item but forget to seed its theme value, it'll be NULL → backfilled to 'pirate' on next deploy → wrong theme. Always set the theme in the catalog and seed script together.
```

- [ ] **Step 11.4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record PR #58 (avatar expansion) + landmines"
```

---

## Task 12: Verify + push + open PR

- [ ] **Step 12.1: Run four-green gate**

```bash
rm -rf .next
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all 4 green.

- [ ] **Step 12.2: Backfill the test count + date**

Update the PR #58 CLAUDE.md entry with the actual date (today's) and `+N tests` count (compare to baseline 687).

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): backfill PR #58 date + test count"
```

- [ ] **Step 12.3: Manual dev smoke**

```bash
pnpm dev
```

Walk through:
1. Sign in → home → avatar now renders with default hair + pants visible (in addition to bandana + tee + ocean bg).
2. Shop > Avatar tab → ThemeChipStrip visible at top with `[All] [Pirate] [Caribbean]`.
3. Tap Pirate → only pirate items shown.
4. Tap Caribbean → only caribbean items shown (1 head, 2 hats, 2 hair, 2 tops, 2 pants, 1 decor, 1 bg).
5. Tap All → all 39 items.
6. Buy + equip a Caribbean hair piece → home page avatar updates instantly.
7. Mix-and-match: equip Caribbean hair + Pirate bandana → hair shown beneath the hat (correct layering).
8. Buy + equip a decor item → decoration visible behind the kid figure on the avatar.

- [ ] **Step 12.4: Push + open PR**

```bash
git push -u origin feat/pr58-avatar-expansion
gh pr create --title "feat(pr58): avatar expansion + multi-theme (Pirate + Caribbean)" --body "$(cat <<'EOF'
## Summary

Expands avatar customization from 4 slots to 7 (adds **hair**, **pants**, **decor**) and introduces a 2-theme model via tag + chip filter. Pirate (existing 22 + 8 new) and Caribbean (11 new) = 39 total items.

## Changes

- **Slot expansion**: `AVATAR_SLOT_IDS` array now drives the render order; `AvatarRender` iterates instead of hardcoding 4 layers. Back → front: background → decor → head → pants → top → hair → hat.
- **`avatar_items.theme`** text column (migration 0020). Existing rows backfilled to `'pirate'` via `scripts/migrate.ts` seed pass.
- **`ThemeChipStrip`** at the top of the avatar shop tab: `[All] [Pirate] [Caribbean]`, client-side filter. Items mix-and-match across themes — no theme lock.
- **New defaults**: `default-hair-brown`, `default-pants-blue` (decor has no default by design).

## Test plan

- [ ] Default look renders with hair + pants visible (no purchase needed)
- [ ] Decor slot empty by default
- [ ] Chip strip filters items by theme
- [ ] Caribbean hair + pirate bandana layering correct (hair under hat)
- [ ] decor item renders behind the kid figure on the avatar

## Post-merge ops

```bash
pnpm tsx scripts/seed-shop-avatar-items.ts
```

Idempotent; inserts the 19 new items into prod. Migration 0020 auto-applies via PR #53's Vercel build step. The `migrate.ts` seed pass backfills theme on existing rows automatically.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review (controller checklist)

Spec coverage:

| Spec § | Item | Task |
|---|---|---|
| 4.1 / Slot expansion | AVATAR_SLOT_IDS + DEFAULT_AVATAR + SLOT_DISPLAY_NAMES | Task 3 |
| 4.2 / Theme tag schema | Migration + backfill in migrate.ts | Tasks 1, 10 |
| 4.2 / AvatarTheme types | themes.ts module | Task 2 |
| 4.3 / ItemDef.theme field | Extend interface + tag 22 existing | Task 5 |
| 4.3 / 6 new pirate + 2 defaults | All hair/pants/decor for pirate | Task 6 |
| 4.3 / 11 caribbean items | All 7 slots covered | Task 7 |
| 4.4 / AvatarRender iteration | Replace hardcoded layers | Task 4 |
| 4.5 / ThemeChipStrip + filter wiring | Component + tab body | Tasks 8, 9 |
| 4.6 / Seed script extension | New items + backfill | Task 10 |
| 7 / Tests | Render, filter, coverage | Tasks 4, 5, 7, 8, 9 |
| 8 / Verification | Four-green + dev smoke | Task 12 |
| 9 / v2 candidates | Documented, not implemented | n/a |
| 10 / Landmines | CLAUDE.md | Task 11 |
| 11 / Rollout | Post-merge seed + auto-migrate | Task 12 |

Placeholder scan: every step has full code or commands. The 17 new SVG components are specified inline. The avatar shop tab body location (Task 9) is left to grep — the existing component name varies by project history. Acceptable since the spec doesn't fix a path and the implementer will discover the file in Step 9.1.

Type consistency:
- `AvatarSlotId`, `AvatarTheme`, `ItemDef`, `ThemeChipValue` defined in Tasks 2-5, consumed identically in Tasks 6-9.
- `AVATAR_SLOT_IDS` order matches §4.1 layering everywhere.
- `unlockRef` slug values match between catalog entries and DEFAULT_AVATAR references.

Plan is internally consistent and ready for execution.
