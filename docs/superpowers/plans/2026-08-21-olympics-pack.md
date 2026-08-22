# Olympics Collectible Pack (PR A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `olympics-v1`, a 20-card grouped collectible pack of Summer Olympic sports, to the Backpack.

**Architecture:** Pure additive. Follows the established "add a collectible pack" recipe exactly — a data file, a `makeVocabCard` wrapper component, a `PACK_REGISTRY` entry, one line in the existing seed script, and one `buildPrompt` case in the Cloudflare art generator. **No migration, no schema change, no changes to any shared game logic.** This PR is deliberately the low-risk half of the packs-v2 spec; it also re-proves the seed → flux → zoom → verify prod pipeline before PR B depends on it.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle/Neon Postgres, Vitest + React Testing Library, Cloudflare Workers AI (flux-1-schnell), Vercel Blob.

**Spec:** `docs/superpowers/specs/2026-08-21-collection-packs-v2-design.md` §3.1, §6, §11.

## Global Constraints

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must ALL be green before the PR is opened. Run the FULL suite (`pnpm test`), never just the new files — a shared-read change breaking an unrelated suite has bitten this repo before.
- Work on branch `feat/collection-packs-v2` (already created, already holds the spec commits). **Never push to `main`.** Branch protection is enforced. **Use SSH for git push** (HTTPS fails on David's setup).
- Tests mock all external boundaries (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`). No test hits a real DB or network.
- **Bilingual rule (locked):** every kid-facing collectible carries BOTH `nameZh` and `nameEn`, and lore is dual `loreZh`/`loreEn`. No language toggle. Yinuo is English-native.
- Drizzle migrations are append-only — but this PR adds **none**. Packs are DB rows, not schema. If you find yourself writing SQL DDL, stop: you have misread the plan.
- Pack UI config lives in `src/lib/collections/packRegistry.ts`, NOT a DB column.
- **Never pass `PackUiMeta` (or any function-bearing object) from a server component into a `'use client'` component.** Pass `packSlug: string` and call `getPackMeta(slug)` inside the client component. Local tests and `pnpm build` will NOT catch a violation — only prod does.
- Art style preamble is `UNIFIED_ART_STYLE` from `src/lib/ai/art-style.ts`. Do not write a new style string.
- **PR numbers in the doc snippets below are provisional.** The last merged PR was #152, so this is #153 *if* nothing lands first. Open the PR, read the number GitHub assigns, then correct it in CLAUDE.md / CHANGELOG / PLAN.md before requesting review.
- **Vercel Blob free tier = 2,000 Advanced Operations/month.** Every `put()` counts. Generate each asset ONCE; never bulk-regenerate; never run the art script with `FORCE=1` in this PR.

---

### Task 1: Olympics data file

**Files:**
- Create: `src/lib/collections/olympicsData.ts`
- Test: `tests/unit/vocab-packs-data.test.ts` (append a `describe` block)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type OlympicGroup = 'water' | 'ball' | 'combat' | 'skill'`
  - `interface OlympicItem { slug: string; nameZh: string; nameEn: string; emoji: string; group: OlympicGroup; loreZh: string; loreEn: string }`
  - `OLYMPIC_SPORTS: OlympicItem[]` (20 entries)
  - `OLYMPICS_BY_SLUG: Record<string, OlympicItem>`
  - `OLYMPIC_GROUP_ORDER: OlympicGroup[]`
  - `OLYMPIC_GROUP_LABELS: Record<OlympicGroup, { zh: string; en: string; emoji: string }>`

This mirrors `src/lib/collections/transportData.ts` exactly — read that file first if anything below is unclear.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/vocab-packs-data.test.ts`. Add the import at the top of the file alongside the existing ones:

```ts
import {
  OLYMPIC_SPORTS,
  OLYMPICS_BY_SLUG,
  OLYMPIC_GROUP_ORDER,
  OLYMPIC_GROUP_LABELS,
} from '@/lib/collections/olympicsData';
```

Then append this block at the end of the file:

```ts
describe('olympics data', () => {
  it('has 20 bilingual items with emoji + valid group + unique slugs', () => {
    expect(OLYMPIC_SPORTS).toHaveLength(20);
    const slugs = new Set<string>();
    for (const s of OLYMPIC_SPORTS) {
      expect(s.nameZh, s.slug).toBeTruthy();
      expect(s.nameEn, s.slug).toBeTruthy();
      expect(s.emoji, s.slug).toBeTruthy();
      expect(s.loreZh, s.slug).toBeTruthy();
      expect(s.loreEn, s.slug).toBeTruthy();
      expect(OLYMPIC_GROUP_ORDER, s.slug).toContain(s.group);
      expect(slugs.has(s.slug), s.slug).toBe(false);
      slugs.add(s.slug);
    }
  });

  it('every group in the order has a bilingual label, and every group is used', () => {
    const used = new Set(OLYMPIC_SPORTS.map((s) => s.group));
    for (const g of OLYMPIC_GROUP_ORDER) {
      expect(OLYMPIC_GROUP_LABELS[g]?.zh, g).toBeTruthy();
      expect(OLYMPIC_GROUP_LABELS[g]?.en, g).toBeTruthy();
      expect(OLYMPIC_GROUP_LABELS[g]?.emoji, g).toBeTruthy();
      expect(used.has(g), `group '${g}' has no sports`).toBe(true);
    }
  });

  it('BY_SLUG resolves', () => {
    expect(OLYMPICS_BY_SLUG['table-tennis']?.nameZh).toBe('乒乓球');
    expect(OLYMPICS_BY_SLUG['climbing']?.group).toBe('skill');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/vocab-packs-data.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/collections/olympicsData"`.

- [ ] **Step 3: Write the data file**

Create `src/lib/collections/olympicsData.ts` with exactly this content:

```ts
/** 奥运会 / Olympics collectible pack (`olympics-v1`). Bilingual; grouped
 *  水上/球类/力量格斗/竞速技巧. Summer disciplines — the vocabulary is the point,
 *  not any one host city's programme. Emoji is the CardArt fallback; real flux
 *  art lives in image_url. */
export type OlympicGroup = 'water' | 'ball' | 'combat' | 'skill';

export interface OlympicItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  group: OlympicGroup;
  loreZh: string;
  loreEn: string;
}

export const OLYMPIC_GROUP_ORDER: OlympicGroup[] = ['water', 'ball', 'combat', 'skill'];

export const OLYMPIC_GROUP_LABELS: Record<OlympicGroup, { zh: string; en: string; emoji: string }> = {
  water: { zh: '水上', en: 'Water', emoji: '🌊' },
  ball: { zh: '球类', en: 'Ball', emoji: '⚽' },
  combat: { zh: '力量格斗', en: 'Strength & Combat', emoji: '🥋' },
  skill: { zh: '竞速技巧', en: 'Speed & Skill', emoji: '🏃' },
};

export const OLYMPIC_SPORTS: OlympicItem[] = [
  { slug: 'swimming', nameZh: '游泳', nameEn: 'Swimming', emoji: '🏊', group: 'water', loreZh: '在水里划呀划，游得最快的赢。', loreEn: 'Race through the water — the fastest swimmer wins.' },
  { slug: 'diving', nameZh: '跳水', nameEn: 'Diving', emoji: '🤿', group: 'water', loreZh: '从高台跳下去，水花越小越好。', loreEn: 'Leap from the high board — the smaller the splash, the better.' },
  { slug: 'kayaking', nameZh: '皮划艇', nameEn: 'Kayaking', emoji: '🛶', group: 'water', loreZh: '用桨划开水面，一路向前。', loreEn: 'Paddle hard and cut through the water.' },
  { slug: 'football', nameZh: '足球', nameEn: 'Football', emoji: '⚽', group: 'ball', loreZh: '用脚把球踢进球门。', loreEn: 'Kick the ball into the goal.' },
  { slug: 'basketball', nameZh: '篮球', nameEn: 'Basketball', emoji: '🏀', group: 'ball', loreZh: '把球投进高高的篮筐。', loreEn: 'Throw the ball through the high hoop.' },
  { slug: 'table-tennis', nameZh: '乒乓球', nameEn: 'Table tennis', emoji: '🏓', group: 'ball', loreZh: '小小的球，飞得特别快。', loreEn: 'A tiny ball that flies very fast.' },
  { slug: 'badminton', nameZh: '羽毛球', nameEn: 'Badminton', emoji: '🏸', group: 'ball', loreZh: '羽毛球轻轻的，会在空中飘。', loreEn: 'The shuttlecock floats through the air.' },
  { slug: 'volleyball', nameZh: '排球', nameEn: 'Volleyball', emoji: '🏐', group: 'ball', loreZh: '球不能落地，大家一起托。', loreEn: 'Keep the ball off the floor — together.' },
  { slug: 'tennis', nameZh: '网球', nameEn: 'Tennis', emoji: '🎾', group: 'ball', loreZh: '隔着球网你来我往。', loreEn: 'Back and forth across the net.' },
  { slug: 'fencing', nameZh: '击剑', nameEn: 'Fencing', emoji: '🤺', group: 'combat', loreZh: '穿上白衣服，用剑轻轻一点。', loreEn: 'In white armour, a quick touch of the blade.' },
  { slug: 'judo', nameZh: '柔道', nameEn: 'Judo', emoji: '🥋', group: 'combat', loreZh: '借力打力，把对手轻轻放倒。', loreEn: 'Use their own strength to take them down.' },
  { slug: 'boxing', nameZh: '拳击', nameEn: 'Boxing', emoji: '🥊', group: 'combat', loreZh: '戴上大手套，出拳又快又准。', loreEn: 'Big gloves, fast and accurate punches.' },
  { slug: 'weightlifting', nameZh: '举重', nameEn: 'Weightlifting', emoji: '🏋️', group: 'combat', loreZh: '把很重很重的杠铃举过头顶。', loreEn: 'Lift the heavy bar right over your head.' },
  { slug: 'running', nameZh: '跑步', nameEn: 'Running', emoji: '🏃', group: 'skill', loreZh: '谁先冲过终点线谁就赢。', loreEn: 'First across the line wins.' },
  { slug: 'gymnastics', nameZh: '体操', nameEn: 'Gymnastics', emoji: '🤸', group: 'skill', loreZh: '翻跟头、转圈圈，稳稳落地。', loreEn: 'Flip, spin, and land steady.' },
  { slug: 'archery', nameZh: '射箭', nameEn: 'Archery', emoji: '🏹', group: 'skill', loreZh: '拉满弓，瞄准红心。', loreEn: 'Draw the bow and aim for the bullseye.' },
  { slug: 'cycling', nameZh: '自行车', nameEn: 'Cycling', emoji: '🚴', group: 'skill', loreZh: '蹬得越快，车跑得越远。', loreEn: 'The harder you pedal, the further you fly.' },
  { slug: 'equestrian', nameZh: '马术', nameEn: 'Equestrian', emoji: '🏇', group: 'skill', loreZh: '和马儿一起跳过栏杆。', loreEn: 'Jump the fences together with your horse.' },
  { slug: 'skateboarding', nameZh: '滑板', nameEn: 'Skateboarding', emoji: '🛹', group: 'skill', loreZh: '踩着滑板飞起来。', loreEn: 'Fly into the air on your board.' },
  { slug: 'climbing', nameZh: '攀岩', nameEn: 'Climbing', emoji: '🧗', group: 'skill', loreZh: '手脚并用，爬到最高的地方。', loreEn: 'Hands and feet — climb right to the top.' },
];

export const OLYMPICS_BY_SLUG: Record<string, OlympicItem> = Object.fromEntries(
  OLYMPIC_SPORTS.map((s) => [s.slug, s]),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/vocab-packs-data.test.ts`
Expected: PASS (all four `describe` blocks, including the three pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/olympicsData.ts tests/unit/vocab-packs-data.test.ts
git commit -m "feat(packs): olympics-v1 data — 20 summer disciplines, 4 groups"
```

---

### Task 2: Card component + registry entry

**Files:**
- Create: `src/components/play/items/OlympicCard.tsx`
- Modify: `src/lib/collections/packRegistry.ts` (imports at top; one entry appended to `PACK_REGISTRY`)
- Test: `tests/unit/pack-registry.test.ts`, `tests/unit/pack-grouping.test.ts`

**Interfaces:**
- Consumes: `OLYMPICS_BY_SLUG`, `OLYMPIC_GROUP_ORDER`, `OLYMPIC_GROUP_LABELS` from Task 1.
- Produces: `OlympicCard` (a `ComponentType<ItemCardProps>`), and `getPackMeta('olympics-v1')` returning a `PackUiMeta` with a `grouping`.

`makeVocabCard` (`src/components/play/items/VocabCard.tsx`) already renders bilingual name, `CardArt` (real image or emoji fallback), the group badge, and lore at `size="lg"`. Do **not** write a bespoke card component — `TransportCard.tsx` and `InstrumentCard.tsx` are both 3-line factory calls and this must be too.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/pack-registry.test.ts`, add `'olympics-v1'` to the existing `it.each([...])` array so it reads:

```ts
  it.each(['transport-v1', 'minibeasts-v1', 'instruments-v1', 'animals-v1', 'olympics-v1'])(
```

and append this test inside the same `describe`:

```ts
  it('olympics-v1 is grouped and uses the 4-section order', () => {
    const g = getPackMeta('olympics-v1')!.grouping!;
    expect(g).toBeTruthy();
    expect(g.order).toEqual(['water', 'ball', 'combat', 'skill']);
  });
```

In `tests/unit/pack-grouping.test.ts`, add the import:

```ts
import { OLYMPIC_SPORTS } from '@/lib/collections/olympicsData';
```

and append this test inside the existing `describe('pack grouping config', ...)`:

```ts
  it('olympics-v1 groups every sport into a section in its order', () => {
    const g = getPackMeta('olympics-v1')!.grouping!;
    for (const s of OLYMPIC_SPORTS) {
      const key = g.resolveGroup(s.slug);
      expect(key, s.slug).not.toBeNull();
      expect(g.order, s.slug).toContain(key);
      expect(g.labels[key!], s.slug).toBeDefined();
    }
    expect(g.resolveGroup('not-a-sport')).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/pack-registry.test.ts tests/unit/pack-grouping.test.ts`
Expected: FAIL — `getPackMeta('olympics-v1')` returns `null`, so the `!` access throws `Cannot read properties of null`.

- [ ] **Step 3: Write the card component**

Create `src/components/play/items/OlympicCard.tsx`:

```tsx
import { makeVocabCard } from './VocabCard';
import { OLYMPICS_BY_SLUG, OLYMPIC_GROUP_LABELS } from '@/lib/collections/olympicsData';
export const OlympicCard = makeVocabCard({ bySlug: OLYMPICS_BY_SLUG, fallbackEmoji: '🏅', groupLabels: OLYMPIC_GROUP_LABELS, testId: 'olympic-card' });
```

- [ ] **Step 4: Add the registry entry**

In `src/lib/collections/packRegistry.ts`, add these two imports next to the existing card / data imports:

```ts
import { OlympicCard } from '@/components/play/items/OlympicCard';
import {
  OLYMPICS_BY_SLUG,
  OLYMPIC_GROUP_ORDER,
  OLYMPIC_GROUP_LABELS,
} from '@/lib/collections/olympicsData';
```

Then append this entry to `PACK_REGISTRY`, after the `'animals-v1'` entry:

```ts
  'olympics-v1': {
    displayNameZh: '奥运会',
    displayNameEn: 'Olympics',
    sloganZh: '收集夏季奥运会的比赛项目。',
    sloganEn: 'Collect the sports of the Summer Games.',
    themeEmoji: '🏅',
    themeBannerClass: 'bg-gradient-to-br from-sky-200 via-blue-300 to-indigo-400',
    themeAccentClass: 'text-blue-900',
    gridColumns: 3,
    ItemCard: OlympicCard,
    resolveRevealEmoji: (slug) => OLYMPICS_BY_SLUG[slug]?.emoji ?? null,
    grouping: {
      resolveGroup: (slug) => OLYMPICS_BY_SLUG[slug]?.group ?? null,
      order: OLYMPIC_GROUP_ORDER,
      labels: OLYMPIC_GROUP_LABELS,
    },
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/pack-registry.test.ts tests/unit/pack-grouping.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/play/items/OlympicCard.tsx src/lib/collections/packRegistry.ts tests/unit/pack-registry.test.ts tests/unit/pack-grouping.test.ts
git commit -m "feat(packs): OlympicCard + olympics-v1 registry entry"
```

---

### Task 3: Seed script

**Files:**
- Modify: `scripts/seed-vocab-packs.ts`

**Interfaces:**
- Consumes: `OLYMPIC_SPORTS` from Task 1.
- Produces: a `collection_packs` row `olympics-v1` (`is_active=true`, `gacha_eligible=true`) plus 20 `collectible_items` rows whose `image_url` holds the emoji as the `CardArt` text fallback.

`seed-vocab-packs.ts` already loops over a `packs` array and (a) upserts the pack by slug with `onConflictDoNothing` and (b) inserts only items whose slug is missing. Adding olympics is therefore two lines and is fully idempotent for the four existing packs.

**There is no unit test for this task.** Seed scripts are ops code that talks to a real DB; the repo does not unit-test them (`seed-vocab-packs.ts`, `seed-landmarks-pack.ts`, etc. have no test files). Verification is `scripts/verify-integrity.ts` after the prod run, covered in Task 6. Do not invent a mocked test for it.

- [ ] **Step 1: Add the import**

In `scripts/seed-vocab-packs.ts`, inside `main()`, next to the four existing data imports:

```ts
  const { OLYMPIC_SPORTS } = await import('../src/lib/collections/olympicsData');
```

Note the dynamic `await import` inside `main()` — this is mandatory for any script touching `process.env.DATABASE_URL`, so `loadEnv()` runs before the db client is constructed. Do not hoist it to a top-level import.

- [ ] **Step 2: Add the pack entry**

Append to the `packs` array in the same file:

```ts
    { slug: 'olympics-v1', name: '奥运会', description: 'Sports of the Summer Games.', themeColor: '#2f6fd0', items: OLYMPIC_SPORTS },
```

`SeedItem` has no `group` field, and it does not need one — grouping is client-side display config resolved from `olympicsData.ts` by slug, never a DB column. The extra `group` property on each `OlympicItem` is simply ignored by the insert mapper, which reads only `slug`/`nameZh`/`nameEn`/`loreZh`/`loreEn`/`emoji`.

- [ ] **Step 3: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS with no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-vocab-packs.ts
git commit -m "feat(packs): seed olympics-v1 via seed-vocab-packs"
```

---

### Task 4: Cloudflare art generator wiring

**Files:**
- Modify: `scripts/generate-collectible-art-cloudflare.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime (it reads the DB rows Task 3 seeds).
- Produces: nothing consumed by later tasks.

Same non-test rationale as Task 3 — this is an ops script.

- [ ] **Step 1: Add the pack to the target list**

In `scripts/generate-collectible-art-cloudflare.ts`, append to `TARGET_PACK_SLUGS`:

```ts
  'olympics-v1',
```

- [ ] **Step 2: Add the per-slug subject map**

Add this constant next to the existing `SOLAR_SUBJECT` / `FESTIVAL_SUBJECT` / `SEASON_SUBJECT` maps:

```ts
/** Per-slug subject prompts for the 奥运会 / Olympics pack. Written out in full
 *  rather than derived from nameEn: "a child doing Fencing" renders as a random
 *  crowd scene, whereas naming the kit and the object makes flux composable.
 *  `boxing` deliberately describes gloves + head guard and no opponent — a
 *  punching-a-person prompt is a likely NSFW false positive (cf. the `gong`
 *  and `Uranus` overrides above). */
const OLYMPIC_SUBJECT: Record<string, string> = {
  swimming: 'a cute cartoon child swimming front crawl in a blue swimming pool lane, wearing goggles and a swim cap, centered, plain light background',
  diving: 'a cute cartoon child diving off a high diving board towards blue water, centered, plain light background',
  kayaking: 'a cute cartoon child paddling a bright kayak with a double-bladed paddle on calm water, centered, plain light background',
  football: 'a cute cartoon child in a football kit kicking a black-and-white football, full body, centered, plain light background',
  basketball: 'a cute cartoon child jumping to shoot an orange basketball into a hoop, full body, centered, plain light background',
  'table-tennis': 'a cute cartoon child holding a table tennis bat about to hit a small white ball over a net, centered, plain light background',
  badminton: 'a cute cartoon child swinging a badminton racket at a white shuttlecock, full body, centered, plain light background',
  volleyball: 'a cute cartoon child jumping to hit a volleyball over a net, full body, centered, plain light background',
  tennis: 'a cute cartoon child swinging a tennis racket at a yellow tennis ball, full body, centered, plain light background',
  fencing: 'a cute cartoon child in a white fencing jacket and mesh mask holding a thin sport sword, full body, centered, plain light background',
  judo: 'a cute cartoon child in a white judo suit with a coloured belt standing in a ready stance, full body, centered, plain light background',
  boxing: 'a cute cartoon child wearing big red sport gloves and a padded head guard, standing in a ready stance, full body, centered, plain light background',
  weightlifting: 'a cute cartoon child lifting a barbell with round weight plates above their head, full body, centered, plain light background',
  running: 'a cute cartoon child sprinting on a red running track, full body, side view, centered, plain light background',
  gymnastics: 'a cute cartoon child doing a handstand on a blue gymnastics mat, full body, centered, plain light background',
  archery: 'a cute cartoon child drawing a bow and arrow aiming at a round target, full body, centered, plain light background',
  cycling: 'a cute cartoon child riding a racing bicycle wearing a helmet, full body, side view, centered, plain light background',
  equestrian: 'a cute cartoon child riding a brown horse jumping over a low fence, full body, side view, centered, plain light background',
  skateboarding: 'a cute cartoon child jumping on a skateboard wearing a helmet, full body, centered, plain light background',
  climbing: 'a cute cartoon child climbing a colourful climbing wall wearing a harness, full body, centered, plain light background',
};
```

- [ ] **Step 3: Add the `buildPrompt` case**

In `buildPrompt`, add this case to the `switch (packSlug)` alongside the existing ones:

```ts
    case 'olympics-v1':
      return `${STYLE_PREAMBLE}${OLYMPIC_SUBJECT[slug] ?? `a cute cartoon child athlete doing ${nameEn}, full body, centered, plain light background`}`;
```

- [ ] **Step 4: Verify it typechecks and lints**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-collectible-art-cloudflare.ts
git commit -m "feat(packs): flux prompts for olympics-v1 card art"
```

---

### Task 5: Docs

**Files:**
- Modify: `CLAUDE.md` (subsystem snapshot: pack count + pack list; "Recent changes" window; "last refreshed" date)
- Modify: `docs/CHANGELOG.md` (full narrative entry)
- Modify: `PLAN.md` (§1 shipped table: one row)

CLAUDE.md's snapshot currently claims "**15** collectible packs" but `PACK_REGISTRY` holds 14 (verified: zodiac, flags, sea-creatures, dinosaurs, solar-system, landmarks, transport, minibeasts, instruments, animals, festivals, season-summer, champions, key-vault). Correct the count to **15** *as a true statement* after adding olympics, and note the prior number was wrong.

- [ ] **Step 1: Update CLAUDE.md**

In the "Cards & collection" paragraph, change the opening from `15 collectible packs in the Backpack` to:

```
15 collectible packs in the Backpack (`/collection`): zodiac, flags (193, grouped by continent), sea creatures, dinosaurs, solar system, landmarks, transport, minibeasts, instruments, animals, **olympics** (20 summer sports, grouped 水上/球类/力量格斗/竞速技巧 — all KS1-vocab packs via the `makeVocabCard` factory), plus reward-only (gacha_eligible=false) festivals, season-summer, champions, key-vault.
```

(The count was previously stated as 15 while the registry held 14; adding olympics makes 15 correct.)

Update the "last refreshed" date on the snapshot heading to `2026-08-21` and add this bullet to the top of the "Recent changes" window, dropping the oldest bullet so the window stays at 3:

```
- **PR #153 (2026-08-21)** — new `olympics-v1` collectible pack: 20 summer disciplines grouped 水上/球类/力量格斗/竞速技巧, via the `makeVocabCard` factory + a `PACK_REGISTRY` entry + one line in `seed-vocab-packs.ts`. No migration. First half of the packs-v2 spec; the gated Hello Kitty / Paw Patrol packs follow in PR B. **Post-merge (required, else the pack is empty):** `seed-vocab-packs.ts`, then the CF art generator + `zoom-collectible-art.ts` + `verify-integrity.ts` against PROD.
```

- [ ] **Step 2: Update docs/CHANGELOG.md**

Add a new entry at the top, matching the surrounding entries' heading style:

```markdown
## PR #153 — `olympics-v1` collectible pack (2026-08-21)

Adds a 20-card Olympics pack to the Backpack, grouped into 水上 (3) / 球类 (6) /
力量格斗 (4) / 竞速技巧 (7).

Pure additive, following the established pack recipe: `olympicsData.ts` +
`OlympicCard` (a 3-line `makeVocabCard` wrapper) + a `PACK_REGISTRY` entry + one
entry in `seed-vocab-packs.ts` + a `buildPrompt` case in the CF art generator.
No migration, no schema change, no shared-logic change.

The pack was requested as "the sports of the most recent Doha Olympics". There
is no Doha Olympics on record (Milan-Cortina, winter 2026, was the most recent
Games; Doha hosts the 2030 Asian Games), so it is built from the recognisable
summer disciplines instead — the vocabulary (游泳 / 跑步 / 足球 / 体操) is what
carries the learning value.

This is PR A of the two-PR packs-v2 plan
(`docs/superpowers/specs/2026-08-21-collection-packs-v2-design.md`); PR B adds
the per-child pack gate and the two Map-1-gated packs.

**Post-merge ops (required):** `seed-vocab-packs.ts` → CF art generator
(non-FORCE, 20 `put`s ≈ 1% of the monthly Blob budget) →
`ONLY_PACK=olympics-v1 zoom-collectible-art.ts` → `verify-collectible-images.ts`
→ `verify-integrity.ts`.
```

- [ ] **Step 3: Update PLAN.md**

Add one row to the §1 shipped table, in the same column shape as the rows above it:

```
| #153 | 2026-08-21 | `olympics-v1` 收藏包（20 张，分 4 组） |
```

Match the existing table's exact column count and wording style — read the two rows above before writing this one.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/CHANGELOG.md PLAN.md
git commit -m "docs: olympics-v1 pack — snapshot, changelog, plan row"
```

---

### Task 6: Four-green gate + PR

**Files:** none modified — this task verifies and ships.

- [ ] **Step 1: Run the FULL local suite**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all four green. `pnpm test` should report ~1735+ tests passing across 306+ files.

If `pnpm test` fails in a file you did not touch, do NOT skip it or narrow the run — a shared-read change breaking an unrelated suite is exactly the failure mode this gate exists to catch. Fix it.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feat/collection-packs-v2
```

Uses SSH (David's remote is already SSH; HTTPS will fail).

- [ ] **Step 3: Open the PR**

```bash
gh pr create --title "feat(packs): olympics-v1 — 20 summer sports collectible pack" --body "$(cat <<'EOF'
PR A of the two-PR packs-v2 plan. Adds a 20-card Olympics collectible pack.

- `olympicsData.ts` — 20 summer disciplines, bilingual name + lore + emoji, grouped 水上 / 球类 / 力量格斗 / 竞速技巧
- `OlympicCard` — 3-line `makeVocabCard` wrapper (grouped variant)
- `PACK_REGISTRY['olympics-v1']` with the 4-section `grouping`
- one entry in `seed-vocab-packs.ts` (idempotent; existing packs untouched)
- `OLYMPIC_SUBJECT` prompts + a `buildPrompt` case in the CF art generator

No migration. No shared game logic touched.

Spec: `docs/superpowers/specs/2026-08-21-collection-packs-v2-design.md` §3.1.

## Post-merge ops (required — the pack is empty without them)

Against PROD (swap `DATABASE_URL` to the commented `# PROD_DATABASE_URL=` line in `.env.local`, swap back after):

```
pnpm tsx scripts/backup-db.ts
pnpm tsx scripts/seed-vocab-packs.ts
CF_ACCOUNT_ID=… CF_API_TOKEN=… pnpm tsx scripts/generate-collectible-art-cloudflare.ts
ONLY_PACK=olympics-v1 pnpm tsx scripts/zoom-collectible-art.ts
pnpm tsx scripts/verify-collectible-images.ts
pnpm tsx scripts/verify-integrity.ts
```

20 `put()` ≈ 1% of the 2,000/month Vercel Blob budget. Run the art generator **non-FORCE**.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_013EsxqpdcngBeh1pNDvZQWz
EOF
)"
```

- [ ] **Step 4: Wait for CI and report**

Run:

```bash
until [ "$(gh pr checks --json bucket --jq 'all(.[]; .bucket != "pending")')" = "true" ]; do sleep 20; done; gh pr checks
```

Expected: all checks pass. Report the PR URL and CI status to David; **do not merge without his go-ahead** (CLAUDE.md: always confirm before starting or landing a PR).

---

## Post-merge prod ops (David runs, or Claude runs with David's confirmation)

See Task 6 Step 3's PR body. Two cautions:

1. **`DATABASE_URL` is split per environment.** Local `.env.local` points at the Neon **dev** branch. A prod seed requires temporarily swapping in the commented `# PROD_DATABASE_URL=` line, or supplying `DATABASE_URL=…` as a shell env var for the one command. Swap back immediately after.
2. **One Vercel Blob store sits behind both prod and dev.** Any `put()` is live in production regardless of which `DATABASE_URL` is set. Never run the art generator with `FORCE=1` in this PR.
