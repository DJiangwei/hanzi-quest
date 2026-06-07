# Backpack Flags-by-Continent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the World Flags pack to all 193 UN member states grouped by 6 continents, add a generic section-header grouped render (reused to group Solar System by body type), and tag each flag card with its continent.

**Architecture:** `continent` becomes a TS field on `FlagItem` (derived at render by slug, like Solar's existing `type` — no DB column, no migration). Flag emoji is **derived from `iso2`** via the Unicode regional-indicator transform, so we never hand-type ~190 emoji and the emoji⟷country mapping is guaranteed correct. A new optional `grouping` field on `PackUiMeta` drives a grouped-section branch in `PackPageBody`; absent it, packs render the existing flat grid. The 193-country dataset is **authored as committed static data** (see Deviation note) — the tested artifact is the data file, guarded by structural invariants.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle (no migration here), Vitest + RTL + jsdom (mocks `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`).

**Deviation from spec (§5):** The approved spec proposed generating ZH names/capitals/lore offline via a DeepSeek script, spot-checked, then committing. This plan instead authors the data file directly as static content. Rationale: the deliverable is identical (a committed, reviewed bilingual data file read at runtime with **no runtime AI**), but it drops a flaky external dependency and an awkward spot-check loop for a one-time artifact. If David prefers the DeepSeek-generated path, Task 3 is the only task that changes (swap "author the array" for "run a generation script, then review its output"); everything else is unaffected.

**No DB migration. No recompile** (collection packs don't touch `week_levels`).

---

## File structure

**Modified**
- `src/lib/collections/flagsData.ts` — `Continent` type, `CONTINENT_LABELS`, `CONTINENT_ORDER`, `flagEmojiFromIso2()` helper; `FlagItem` gains `iso2` + `continent`; `FLAGS` grows 30 → 193 (built from a raw list with emoji derived from iso2).
- `src/lib/collections/solarSystemData.ts` — `SOLAR_TYPE_ORDER` + `TYPE_EMOJI` (per-type header emoji).
- `src/lib/collections/packRegistry.ts` — `PackGrouping` interface + `grouping` on `flags-v1` and `solar-system-v1`.
- `src/components/play/PackPageBody.tsx` — extract a `PackTile` inner piece; add a grouped-section render branch.
- `src/components/play/items/FlagCard.tsx` — continent badge (non-compact).
- `scripts/seed-flags-pack.ts` — header comment count (30 → 193); logic unchanged (already insert-missing).
- `tests/unit/flags-data.test.ts` — update count assertion + add invariants.
- `CLAUDE.md` — current-state line + landmine.

**New**
- `tests/unit/flag-emoji.test.ts` — emoji-from-iso2 helper.
- `tests/unit/pack-grouping.test.ts` — registry grouping invariants.
- `tests/unit/pack-page-body-grouped.test.tsx` — grouped render.
- `tests/unit/solar-grouping-data.test.ts` — solar order + emoji.

---

## Task 1: `flagEmojiFromIso2` helper + continent metadata

**Files:**
- Modify: `src/lib/collections/flagsData.ts`
- Test: `tests/unit/flag-emoji.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/flag-emoji.test.ts
import { describe, expect, it } from 'vitest';
import {
  flagEmojiFromIso2,
  CONTINENT_LABELS,
  CONTINENT_ORDER,
} from '@/lib/collections/flagsData';

describe('flagEmojiFromIso2', () => {
  it('maps iso2 → regional-indicator flag emoji', () => {
    expect(flagEmojiFromIso2('cn')).toBe('🇨🇳');
    expect(flagEmojiFromIso2('gb')).toBe('🇬🇧');
    expect(flagEmojiFromIso2('us')).toBe('🇺🇸');
  });
  it('is case-insensitive', () => {
    expect(flagEmojiFromIso2('CN')).toBe('🇨🇳');
  });
  it('returns a white flag for malformed input', () => {
    expect(flagEmojiFromIso2('xyz')).toBe('🏳️');
    expect(flagEmojiFromIso2('')).toBe('🏳️');
  });
});

describe('continent metadata', () => {
  it('CONTINENT_ORDER lists all 6 inhabited continents once', () => {
    expect(CONTINENT_ORDER).toHaveLength(6);
    expect(new Set(CONTINENT_ORDER).size).toBe(6);
  });
  it('every continent has a bilingual label + emoji', () => {
    for (const c of CONTINENT_ORDER) {
      expect(CONTINENT_LABELS[c].zh).toBeTruthy();
      expect(CONTINENT_LABELS[c].en).toBeTruthy();
      expect(CONTINENT_LABELS[c].emoji).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- flag-emoji`
Expected: FAIL — `flagEmojiFromIso2` / `CONTINENT_LABELS` not exported.

- [ ] **Step 3: Add the helper + metadata at the top of `flagsData.ts`** (above `FlagItem`)

```ts
export type Continent =
  | 'asia' | 'europe' | 'africa'
  | 'north_america' | 'south_america' | 'oceania';

export const CONTINENT_LABELS: Record<
  Continent,
  { zh: string; en: string; emoji: string }
> = {
  asia: { zh: '亚洲', en: 'Asia', emoji: '🌏' },
  europe: { zh: '欧洲', en: 'Europe', emoji: '🌍' },
  africa: { zh: '非洲', en: 'Africa', emoji: '🌍' },
  north_america: { zh: '北美洲', en: 'North America', emoji: '🌎' },
  south_america: { zh: '南美洲', en: 'South America', emoji: '🌎' },
  oceania: { zh: '大洋洲', en: 'Oceania', emoji: '🌏' },
};

export const CONTINENT_ORDER: Continent[] = [
  'asia', 'europe', 'africa', 'north_america', 'south_america', 'oceania',
];

/**
 * Build a 🇨🇳-style flag emoji from an ISO-3166 alpha-2 code via the Unicode
 * regional-indicator transform (a→🇦 … z→🇿). Returns 🏳️ for malformed input.
 */
export function flagEmojiFromIso2(iso2: string): string {
  const cc = iso2.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return '🏳️';
  const BASE = 0x1f1e6; // regional indicator 'A'
  const a = 'a'.charCodeAt(0);
  return String.fromCodePoint(
    BASE + (cc.charCodeAt(0) - a),
    BASE + (cc.charCodeAt(1) - a),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- flag-emoji`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/flagsData.ts tests/unit/flag-emoji.test.ts
git commit -m "feat(flags): continent metadata + iso2→emoji helper"
```

---

## Task 2: Extend `FlagItem` + migrate the existing 30 entries

**Files:**
- Modify: `src/lib/collections/flagsData.ts`
- Test: `tests/unit/flags-data.test.ts`

This task changes the type and the *shape* of the existing 30 entries (adds `iso2` + `continent`, derives `emoji` from `iso2`) WITHOUT yet adding the other 163 countries. That keeps the diff reviewable.

- [ ] **Step 1: Update `flags-data.test.ts` for the new invariants** (replace the whole file)

```ts
import { describe, expect, it } from 'vitest';
import {
  FLAGS,
  FLAGS_BY_SLUG,
  flagEmojiFromIso2,
  CONTINENT_ORDER,
} from '@/lib/collections/flagsData';

describe('flagsData', () => {
  it('every entry has bilingual name, capital, and lore', () => {
    for (const f of FLAGS) {
      expect(f.nameZh, `${f.slug} nameZh`).toBeTruthy();
      expect(f.nameEn, `${f.slug} nameEn`).toBeTruthy();
      expect(f.capitalZh, `${f.slug} capitalZh`).toBeTruthy();
      expect(f.capitalEn, `${f.slug} capitalEn`).toBeTruthy();
      expect(f.loreZh, `${f.slug} loreZh`).toBeTruthy();
      expect(f.loreEn, `${f.slug} loreEn`).toBeTruthy();
    }
  });

  it('every entry has a 2-letter iso2 and a derived emoji', () => {
    for (const f of FLAGS) {
      expect(f.iso2, `${f.slug} iso2`).toMatch(/^[a-z]{2}$/);
      expect(f.emoji, `${f.slug} emoji`).toBe(flagEmojiFromIso2(f.iso2));
    }
  });

  it('every entry has a valid continent in CONTINENT_ORDER', () => {
    for (const f of FLAGS) {
      expect(CONTINENT_ORDER, `${f.slug} continent`).toContain(f.continent);
    }
  });

  it('slugs and iso2 codes are unique', () => {
    const slugs = FLAGS.map((f) => f.slug);
    const isos = FLAGS.map((f) => f.iso2);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(isos).size).toBe(isos.length);
  });

  it('rarity is one of common / rare / epic', () => {
    const valid = new Set(['common', 'rare', 'epic']);
    for (const f of FLAGS) {
      expect(valid.has(f.rarity), `${f.slug} rarity=${f.rarity}`).toBe(true);
    }
  });

  it('FLAGS_BY_SLUG indexes every entry', () => {
    for (const f of FLAGS) {
      expect(FLAGS_BY_SLUG[f.slug]?.slug).toBe(f.slug);
    }
  });

  it('keeps the original Yinuo-relevant countries', () => {
    expect(FLAGS_BY_SLUG['uk']?.nameZh).toBe('英国');
    expect(FLAGS_BY_SLUG['uk']?.iso2).toBe('gb');
    expect(FLAGS_BY_SLUG['china']?.continent).toBe('asia');
    expect(FLAGS_BY_SLUG['usa']?.continent).toBe('north_america');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- flags-data`
Expected: FAIL — entries lack `iso2`/`continent`.

- [ ] **Step 3: Refactor `FlagItem` + rebuild `FLAGS` from a raw list**

Change the interface to add `iso2` + `continent`, and build `FLAGS` so `emoji` is derived (drop the literal `emoji` from each row). The existing 30 rows become a `RAW_FLAGS` array with `iso2` + `continent` added and `emoji` removed. Example of the new shape (apply to all 30):

```ts
export interface FlagItem {
  slug: string;
  iso2: string;
  emoji: string; // derived from iso2 at build time
  continent: Continent;
  nameZh: string;
  nameEn: string;
  capitalZh: string;
  capitalEn: string;
  loreZh: string;
  loreEn: string;
  rarity: FlagRarity;
  dropWeight: number;
}

type RawFlag = Omit<FlagItem, 'emoji'>;

const RAW_FLAGS: RawFlag[] = [
  { slug: 'china', iso2: 'cn', continent: 'asia', nameZh: '中国', nameEn: 'China', capitalZh: '北京', capitalEn: 'Beijing', loreZh: '大熊猫的故乡。', loreEn: 'Home of the giant panda!', rarity: 'common', dropWeight: 3 },
  { slug: 'uk', iso2: 'gb', continent: 'europe', nameZh: '英国', nameEn: 'United Kingdom', capitalZh: '伦敦', capitalEn: 'London', loreZh: '有红色双层巴士。', loreEn: 'Famous for red double-decker buses.', rarity: 'common', dropWeight: 3 },
  { slug: 'usa', iso2: 'us', continent: 'north_america', nameZh: '美国', nameEn: 'United States', capitalZh: '华盛顿', capitalEn: 'Washington, D.C.', loreZh: '有五十颗星星的国旗。', loreEn: 'Its flag has fifty stars.', rarity: 'common', dropWeight: 3 },
  // …convert the remaining 27 existing entries the same way (preserve their
  //   nameZh/capital/lore/rarity/dropWeight verbatim; add iso2 + continent):
  //   france/fr/europe, germany/de/europe, japan/jp/asia, south-korea/kr/asia,
  //   canada/ca/north_america, australia/au/oceania, india/in/asia,
  //   brazil/br/south_america, russia/ru/europe, italy/it/europe,
  //   spain/es/europe, mexico/mx/north_america, egypt/eg/africa,
  //   south-africa/za/africa, argentina/ar/south_america, switzerland/ch/europe,
  //   greece/gr/europe, netherlands/nl/europe, thailand/th/asia,
  //   singapore/sg/asia, turkey/tr/asia, saudi-arabia/sa/asia, uae/ae/asia,
  //   vietnam/vn/asia, indonesia/id/asia, portugal/pt/europe, sweden/se/europe.
];

export const FLAGS: FlagItem[] = RAW_FLAGS.map((f) => ({
  ...f,
  emoji: flagEmojiFromIso2(f.iso2),
}));

export const FLAGS_BY_SLUG: Record<string, FlagItem> = Object.fromEntries(
  FLAGS.map((f) => [f.slug, f]),
);
```

Continent assignments for the existing cross-continental rows: `russia → europe`, `turkey → asia`, `egypt → africa` (documented; one continent each).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- flags-data flag-emoji`
Expected: PASS. Also run `pnpm test -- flag-card` (FlagCard reads `FLAGS_BY_SLUG[...].emoji` — still present) — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/flagsData.ts tests/unit/flags-data.test.ts
git commit -m "feat(flags): add iso2 + continent to FlagItem; migrate existing 30"
```

---

## Task 3: Author the full 193-country dataset

**Files:**
- Modify: `src/lib/collections/flagsData.ts` (grow `RAW_FLAGS` 30 → 193)
- Test: `tests/unit/flags-data.test.ts` (add count + coverage invariants)

> **Controller-authored data task.** This is a large, judgment-heavy data artifact (accurate Chinese names/capitals + age-6 bilingual fun facts for ~163 added countries). It should be authored by the most capable model, not delegated to a cheap subagent. The structural test below is the completeness guard; correctness of individual translations is verified by review.

**Roster rules (so the set is unambiguous):**
- **Exactly the 193 UN member states.** Skip all disputed / non-member / observer entities: Taiwan, Kosovo, Palestine, Western Sahara, Vatican (Holy See), Northern Cyprus, Abkhazia, South Ossetia, Transnistria, Somaliland.
- **Slugs:** lowercase-kebab of the common English name (`south-korea`, `costa-rica`, `dr-congo`, `cote-divoire`, `bosnia-herzegovina`, `papua-new-guinea`, etc.). Preserve the 30 existing slugs verbatim.
- **`iso2`:** the country's ISO-3166 alpha-2 (lowercase). `emoji` is derived — never typed.
- **One continent per country** (kid-atlas convention). Cross-continental assignments (fixed): Russia→europe, Türkiye→asia, Kazakhstan→asia, Azerbaijan→asia, Armenia→asia, Georgia→asia, Cyprus→europe, Egypt→africa. Central America + the Caribbean → `north_america`.
- **Target per-continent counts** (the test asserts each continent is non-empty and totals 193; these are the expected splits): asia ~48, europe ~44, africa 54, north_america ~23, south_america 12, oceania ~14.
- **Rarity by recognizability** (drives drop order, common drops most): `common` (weight 3) ≈ 55 highly-familiar countries (major economies + Yinuo's neighbors + famous tourist countries); `rare` (weight 2) ≈ 85 mid-familiarity; `epic` (weight 1) ≈ 53 small / less-familiar. `dropWeight` MUST be 3/2/1 for common/rare/epic respectively.
- **Lore:** one short, kid-friendly, apolitical bilingual fact each (e.g. a famous animal, food, landmark, or nature). ZH ≤ ~14 chars; EN ≤ ~8 words.

- [ ] **Step 1: Add the count + coverage invariants to `flags-data.test.ts`** (append inside the `describe`)

```ts
  it('contains all 193 UN member states', () => {
    expect(FLAGS).toHaveLength(193);
  });

  it('every continent has at least one country', () => {
    for (const c of CONTINENT_ORDER) {
      expect(
        FLAGS.some((f) => f.continent === c),
        `continent ${c} is empty`,
      ).toBe(true);
    }
  });

  it('dropWeight matches rarity (common=3, rare=2, epic=1)', () => {
    const expected = { common: 3, rare: 2, epic: 1 } as const;
    for (const f of FLAGS) {
      expect(f.dropWeight, `${f.slug}`).toBe(expected[f.rarity]);
    }
  });

  it('excludes disputed / non-UN territories', () => {
    for (const slug of ['taiwan', 'kosovo', 'palestine', 'western-sahara', 'vatican']) {
      expect(FLAGS_BY_SLUG[slug], `${slug} should be excluded`).toBeUndefined();
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- flags-data`
Expected: FAIL — `FLAGS` has 30, not 193.

- [ ] **Step 3: Author the remaining ~163 countries into `RAW_FLAGS`**

Add all remaining UN members following the roster rules above. Each row is one object literal matching `RawFlag` (no `emoji`). Group the additions by continent with a `// --- Asia ---` style comment block per continent for reviewability. Work continent-by-continent; cross-check each iso2 and the Chinese name/capital as you go.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- flags-data flag-emoji flag-card`
Expected: PASS (193 entries, all invariants green).

- [ ] **Step 5: Self-review the data + commit**

Spot-check ~15 entries across continents (correct iso2, sensible Chinese name/capital, apolitical lore). Fix any errors inline.

```bash
git add src/lib/collections/flagsData.ts tests/unit/flags-data.test.ts
git commit -m "feat(flags): full 193 UN member states with continents"
```

---

## Task 4: Solar System grouping metadata

**Files:**
- Modify: `src/lib/collections/solarSystemData.ts`
- Test: `tests/unit/solar-grouping-data.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/solar-grouping-data.test.ts
import { describe, expect, it } from 'vitest';
import {
  SOLAR_BODIES,
  SOLAR_TYPE_ORDER,
  TYPE_EMOJI,
  TYPE_LABELS,
} from '@/lib/collections/solarSystemData';

describe('solar grouping metadata', () => {
  it('SOLAR_TYPE_ORDER covers every type used by a body', () => {
    for (const b of SOLAR_BODIES) {
      expect(SOLAR_TYPE_ORDER).toContain(b.type);
    }
  });
  it('SOLAR_TYPE_ORDER has no duplicates and matches TYPE_LABELS keys', () => {
    expect(new Set(SOLAR_TYPE_ORDER).size).toBe(SOLAR_TYPE_ORDER.length);
    for (const t of SOLAR_TYPE_ORDER) {
      expect(TYPE_LABELS[t]).toBeDefined();
    }
  });
  it('every type has a header emoji', () => {
    for (const t of SOLAR_TYPE_ORDER) {
      expect(TYPE_EMOJI[t]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- solar-grouping-data`
Expected: FAIL — `SOLAR_TYPE_ORDER` / `TYPE_EMOJI` not exported.

- [ ] **Step 3: Add the exports to `solarSystemData.ts`** (after `TYPE_LABELS`)

```ts
/** Display order for the grouped Solar System render. */
export const SOLAR_TYPE_ORDER: SolarBodyType[] = [
  'star', 'rocky', 'gas', 'ice', 'moon',
];

/** Header emoji per body type (section headers in the grouped grid). */
export const TYPE_EMOJI: Record<SolarBodyType, string> = {
  rocky: '🪨',
  gas: '🌀',
  ice: '❄️',
  star: '☀️',
  moon: '🌙',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- solar-grouping-data`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/solarSystemData.ts tests/unit/solar-grouping-data.test.ts
git commit -m "feat(solar): grouping order + per-type header emoji"
```

---

## Task 5: `PackGrouping` in the registry

**Files:**
- Modify: `src/lib/collections/packRegistry.ts`
- Test: `tests/unit/pack-grouping.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pack-grouping.test.ts
import { describe, expect, it } from 'vitest';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { FLAGS } from '@/lib/collections/flagsData';
import { SOLAR_BODIES } from '@/lib/collections/solarSystemData';

describe('pack grouping config', () => {
  it('flags-v1 groups every flag into a continent in its order', () => {
    const g = getPackMeta('flags-v1')!.grouping!;
    expect(g).toBeDefined();
    for (const f of FLAGS) {
      const key = g.resolveGroup(f.slug);
      expect(key, `${f.slug}`).not.toBeNull();
      expect(g.order, `${f.slug}`).toContain(key);
      expect(g.labels[key!]).toBeDefined();
    }
  });

  it('solar-system-v1 groups every body into a type in its order', () => {
    const g = getPackMeta('solar-system-v1')!.grouping!;
    expect(g).toBeDefined();
    for (const b of SOLAR_BODIES) {
      const key = g.resolveGroup(b.slug);
      expect(g.order).toContain(key);
      expect(g.labels[key!]).toBeDefined();
    }
  });

  it('non-grouped packs (zodiac, dinosaurs) have no grouping', () => {
    expect(getPackMeta('zodiac-v1')!.grouping).toBeUndefined();
    expect(getPackMeta('dinosaurs-v1')!.grouping).toBeUndefined();
  });

  it('resolveGroup returns null for an unknown slug', () => {
    expect(getPackMeta('flags-v1')!.grouping!.resolveGroup('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- pack-grouping`
Expected: FAIL — `grouping` not on meta.

- [ ] **Step 3: Add `PackGrouping` + wire flags & solar**

Add the interface to `packRegistry.ts` and import the metadata. Note `CONTINENT_LABELS` / `TYPE_LABELS` carry exactly `{ zh, en, emoji }` for flags and `{ zh, en }` for solar — solar needs the emoji merged from `TYPE_EMOJI`.

```ts
import {
  FLAGS_BY_SLUG,
  CONTINENT_LABELS,
  CONTINENT_ORDER,
} from '@/lib/collections/flagsData';
import {
  SOLAR_BODIES_BY_SLUG,
  SOLAR_TYPE_ORDER,
  TYPE_LABELS,
  TYPE_EMOJI,
} from '@/lib/collections/solarSystemData';

export interface PackGrouping {
  /** item slug → group key (null = ungrouped; rendered in a trailing bucket). */
  resolveGroup: (slug: string) => string | null;
  /** Fixed section order, top → bottom. */
  order: string[];
  /** Bilingual + emoji header label per group key. */
  labels: Record<string, { zh: string; en: string; emoji: string }>;
}
```

Add `grouping?: PackGrouping;` to `PackUiMeta`. Then on `flags-v1`:

```ts
    grouping: {
      resolveGroup: (slug) => FLAGS_BY_SLUG[slug]?.continent ?? null,
      order: CONTINENT_ORDER,
      labels: CONTINENT_LABELS,
    },
```

On `solar-system-v1` (merge emoji into the bilingual labels):

```ts
    grouping: {
      resolveGroup: (slug) => SOLAR_BODIES_BY_SLUG[slug]?.type ?? null,
      order: SOLAR_TYPE_ORDER,
      labels: Object.fromEntries(
        SOLAR_TYPE_ORDER.map((t) => [
          t,
          { zh: TYPE_LABELS[t].zh, en: TYPE_LABELS[t].en, emoji: TYPE_EMOJI[t] },
        ]),
      ),
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- pack-grouping`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/packRegistry.ts tests/unit/pack-grouping.test.ts
git commit -m "feat(packs): optional PackGrouping; wire flags + solar"
```

---

## Task 6: `PackPageBody` grouped-section render

**Files:**
- Modify: `src/components/play/PackPageBody.tsx`
- Test: `tests/unit/pack-page-body-grouped.test.tsx`

Goal: when `meta.grouping` is present, render one section (header + grid) per group in `order`; otherwise render the existing single grid. The per-tile content (Card + ×N dupe badge + swap chip) must be **identical** in both paths — extract it into a `PackTile` inner component.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/pack-page-body-grouped.test.tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PackPageBody } from '@/components/play/PackPageBody';
import type { CollectibleItem } from '@/lib/db/collections';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function flagItem(slug: string, nameEn: string): CollectibleItem {
  return {
    id: `id-${slug}`, packId: 'p', slug, nameZh: nameEn, nameEn,
    loreZh: '', loreEn: '', rarity: 'common', dropWeight: 3,
    imageUrl: null, createdAt: new Date(),
  };
}

describe('PackPageBody grouped render', () => {
  const items = [
    flagItem('china', 'China'),       // asia
    flagItem('japan', 'Japan'),       // asia
    flagItem('france', 'France'),     // europe
    flagItem('egypt', 'Egypt'),       // africa
  ];

  it('renders a section header per non-empty continent in order', () => {
    render(
      <PackPageBody
        childId="c1" packSlug="flags-v1" items={items}
        ownedItemIds={['id-china']} ownedItems={[{ ...items[0], count: 1 }]}
        balance={0} shardCount={0}
      />,
    );
    expect(screen.getByText('亚洲')).toBeInTheDocument();
    expect(screen.getByText('欧洲')).toBeInTheDocument();
    expect(screen.getByText('非洲')).toBeInTheDocument();
    // Empty continents (no items) render no header:
    expect(screen.queryByText('大洋洲')).not.toBeInTheDocument();
  });

  it('places each flag under its own continent section', () => {
    render(
      <PackPageBody
        childId="c1" packSlug="flags-v1" items={items}
        ownedItemIds={[]} ownedItems={[]} balance={0} shardCount={0}
      />,
    );
    const asia = screen.getByTestId('pack-section-asia');
    expect(within(asia).getByText('China')).toBeInTheDocument();
    expect(within(asia).getByText('Japan')).toBeInTheDocument();
    expect(within(asia).queryByText('France')).not.toBeInTheDocument();
    const europe = screen.getByTestId('pack-section-europe');
    expect(within(europe).getByText('France')).toBeInTheDocument();
  });

  it('falls back to a single flat grid when the pack has no grouping', () => {
    const zItems = [flagItem('rat', 'Rat')]; // zodiac-v1 has no grouping
    render(
      <PackPageBody
        childId="c1" packSlug="zodiac-v1" items={zItems}
        ownedItemIds={[]} ownedItems={[]} balance={0} shardCount={0}
      />,
    );
    expect(screen.getByTestId('pack-grid-with-badges')).toBeInTheDocument();
    expect(screen.queryByTestId('pack-section-asia')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- pack-page-body-grouped`
Expected: FAIL — no section testids; grouped branch absent.

- [ ] **Step 3: Refactor `PackPageBody`**

Extract the per-tile markup (currently inside the `items.map(...)` in the grid) into a local `PackTile` component, and the grid wrapper into a `TileGrid` helper. Then branch on `meta.grouping`. Keep the existing flat path (`data-testid="pack-grid-with-badges"`) for ungrouped packs.

```tsx
// Inside PackPageBody, after computing ownedSet + countById + meta:
const gridStyle = { gridTemplateColumns: `repeat(${meta.gridColumns ?? 3}, minmax(0, 1fr))` };

function PackTile({ item }: { item: CollectibleItem }) {
  const Card = meta!.ItemCard;
  const count = countById.get(item.id) ?? 0;
  const isOwned = ownedSet.has(item.id);
  return (
    <div className="relative">
      <Card item={item} owned={isOwned} size="md" compact={false} />
      {count > 1 && (
        <span className="absolute right-0.5 top-0.5 z-10 rounded-full bg-sky-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
          ×{count}
        </span>
      )}
      {!isOwned && (
        <button
          type="button"
          data-testid="swap-chip"
          disabled={shardCount < SWAP_COST}
          onClick={() => setSwapItem(item)}
          className={`absolute inset-x-1 bottom-1 z-10 min-h-6 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            shardCount >= SWAP_COST ? 'bg-sky-500 text-white' : 'bg-stone-300 text-stone-600'
          }`}
        >
          {shardCount >= SWAP_COST ? '🔹换卡 / Trade' : `需 ${SWAP_COST}🔹`}
        </button>
      )}
    </div>
  );
}
```

Replace the single grid block with:

```tsx
{meta.grouping ? (
  <div className="flex flex-col gap-4">
    {meta.grouping.order.map((key) => {
      const groupItems = items.filter(
        (i) => meta.grouping!.resolveGroup(i.slug) === key,
      );
      if (groupItems.length === 0) return null;
      const label = meta.grouping!.labels[key];
      const ownedInGroup = groupItems.filter((i) => ownedSet.has(i.id)).length;
      return (
        <section key={key} data-testid={`pack-section-${key}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">{label.emoji}</span>
            <h2 className="font-hanzi text-lg font-bold text-[var(--color-treasure-800)]">
              {label.zh}
            </h2>
            <span className="text-sm text-[var(--color-treasure-700)]">{label.en}</span>
            <span className="ml-auto text-xs font-semibold text-[var(--color-treasure-600)]">
              {ownedInGroup}/{groupItems.length}
            </span>
          </div>
          <div className="grid gap-2.5" style={gridStyle}>
            {groupItems.map((item) => <PackTile key={item.id} item={item} />)}
          </div>
        </section>
      );
    })}
  </div>
) : (
  <div data-testid="pack-grid-with-badges" className="grid gap-2.5" style={gridStyle}>
    {items.map((item) => <PackTile key={item.id} item={item} />)}
  </div>
)}
```

Wrap both in the existing parchment container `<div className="rounded-2xl border border-[#c89f5e] ...">`. Define `PackTile` inside the component body (it closes over `meta`, `countById`, `ownedSet`, `shardCount`, `setSwapItem`).

- [ ] **Step 4: Run the tests**

Run: `pnpm test -- pack-page-body-grouped pack-page-body pack-page-swap-chip`
Expected: PASS (grouped render works; existing flat-grid + swap-chip tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/components/play/PackPageBody.tsx tests/unit/pack-page-body-grouped.test.tsx
git commit -m "feat(packs): grouped-section render in PackPageBody"
```

---

## Task 7: `FlagCard` continent badge

**Files:**
- Modify: `src/components/play/items/FlagCard.tsx`
- Test: `tests/unit/flag-card.test.tsx`

- [ ] **Step 1: Add a badge test** (append inside the `describe` in `flag-card.test.tsx`)

```tsx
  it('renders a bilingual continent badge in non-compact mode', () => {
    render(<FlagCard item={makeItem()} owned />); // china → asia
    expect(screen.getByText('亚洲')).toBeInTheDocument();
    expect(screen.getByText('Asia')).toBeInTheDocument();
  });

  it('hides the continent badge when compact=true', () => {
    render(<FlagCard item={makeItem()} owned compact />);
    expect(screen.queryByText('亚洲')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- flag-card`
Expected: FAIL — no continent badge.

- [ ] **Step 3: Add the badge to `FlagCard`**

Import the continent label and render a pill (mirrors `SolarBodyCard`'s type badge). Place it after the name block, before the capital block, only when `!compact` and a continent is resolvable.

```tsx
import { FLAGS_BY_SLUG, CONTINENT_LABELS } from '@/lib/collections/flagsData';
// …inside the component, after `const flagMeta = FLAGS_BY_SLUG[item.slug];`
const continent = flagMeta?.continent;
const continentLabel = continent ? CONTINENT_LABELS[continent] : null;
```

```tsx
{!compact && continentLabel && (
  <div
    className={[
      'mt-1 flex items-center gap-1 rounded-full px-2 py-0.5',
      size === 'lg' ? 'text-xs' : 'text-[9px]',
      owned ? 'bg-sky-200 text-sky-900' : 'bg-stone-200 text-stone-500',
    ].join(' ')}
  >
    <span aria-hidden="true">{continentLabel.emoji}</span>
    <span className="font-hanzi">{continentLabel.zh}</span>
    <span aria-hidden="true">·</span>
    <span>{continentLabel.en}</span>
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- flag-card`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/play/items/FlagCard.tsx tests/unit/flag-card.test.tsx
git commit -m "feat(flags): per-card continent badge"
```

---

## Task 8: Seed comment, docs, and four-green gate

**Files:**
- Modify: `scripts/seed-flags-pack.ts` (comment only)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the seed script header comment**

In `scripts/seed-flags-pack.ts`, change the docstring line "Upserts 30 country rows" → "Upserts all 193 UN member-state rows" and the step "2. Upserts 30 country rows" → "2. Upserts 193 country rows". No logic change (it already inserts only missing slugs, idempotent).

- [ ] **Step 2: Run the full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green.

> Note (`pnpm build` side-effect — known landmine): `build` runs `tsx scripts/migrate.ts` first, which applies any pending migrations to the shared prod DB. This feature adds **no migration**, so build is safe to run.

- [ ] **Step 3: Update `CLAUDE.md`**

Add to "Current state" a one-line bullet:

> - **Flags-by-Continent (PR open 2026-06-07)** — World Flags pack expanded 30 → **193 UN member states**, grouped into 6 scrollable **continent** sections in the Backpack; each flag card tagged with its continent. Generic `PackGrouping` (optional `grouping` on `PackUiMeta`) drives section-header render in `PackPageBody`; **Solar System** reuses it grouped by body `type`. `continent`/`iso2` are TS fields on `FlagItem` (emoji derived from `iso2`); **no DB migration, no recompile** — continent is render-derived by slug like Solar's `type`. Post-merge: `pnpm tsx scripts/seed-flags-pack.ts` seeds the ~163 new `collectible_items`.

Add a Landmine:

> - **Pack grouping is client-only display config; continent is derived TS, not a DB column.** `PackGrouping` lives on `PackUiMeta` (`packRegistry.ts`) and carries a `resolveGroup` function — `PackPageBody` resolves it itself via `getPackMeta(slug)` (client-side); NEVER pass `meta`/`grouping` from a server component (same RSC hazard as `ItemCard`). A flag's `continent` (and a solar body's `type`) is read from `flagsData.ts`/`solarSystemData.ts` by slug at render — adding/moving a country is a pure data edit + re-run of `seed-flags-pack.ts`; no migration. Flag `emoji` is derived from `iso2` via `flagEmojiFromIso2` — set `iso2`, never hand-type the emoji.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-flags-pack.ts CLAUDE.md
git commit -m "docs(flags): seed comment + CLAUDE.md state & landmine"
```

---

## Self-review (completed by plan author)

- **Spec coverage:** §3.1 `continent`/`iso2`/labels → Tasks 1–2; §3.2 193 countries + per-continent + rarity → Task 3; §3.3 solar metadata → Task 4; §4.1 `PackGrouping` registry → Task 5; §4.2 grouped `PackPageBody` → Task 6; §4.3 `FlagCard` badge → Task 7; §6 seed + §7 files + CLAUDE.md → Task 8. §5 (content generation) covered by Task 3 with a documented deviation (static authoring vs DeepSeek). §8 exclusions tested in Task 3. §10 testing distributed across tasks. No gaps.
- **Type consistency:** `FlagItem` (with `iso2`+`continent`+derived `emoji`), `Continent`, `CONTINENT_LABELS`/`CONTINENT_ORDER`, `flagEmojiFromIso2`, `PackGrouping` (`resolveGroup`/`order`/`labels`), `SOLAR_TYPE_ORDER`/`TYPE_EMOJI` are used consistently across Tasks 1–7. `PackTile`/`gridStyle` introduced and used within Task 6 only.
- **Placeholder scan:** the only non-inlined content is the 193-row dataset (Task 3), which is a reviewed data artifact guarded by structural tests — not a logic placeholder. All code steps show complete code.
