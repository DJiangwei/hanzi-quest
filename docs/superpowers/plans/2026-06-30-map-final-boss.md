# Map Final Boss (海域霸主) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-phase final-boss battle (海域霸主) at the end of each map that, when beaten, grants a champion trophy + exclusive card + crown cosmetic/title and unlocks the next map.

**Architecture:** A new `final_boss_clears` table is the single source of truth for "map beaten" (drives both reward idempotency and next-map gating). The battle is a runtime-built (no compile) multi-phase adaptation of `BossScene` against a per-map overlord creature. Rewards follow the festival/continent reward pattern (reward-only card pack + reward-only avatar theme + trophy, granted idempotently). Gating extends `listMapsForChild`/`switchMapAction`; the lair node + title chip are UI surfaces.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle/Neon Postgres, Vitest + RTL + jsdom, Tailwind, framer-motion (creature), Cloudflare flux (1 champion card image post-merge).

**Four-green gate (before each PR):** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

**Branch:** `feat/map-final-boss` (exists, spec committed). PR 1 = Tasks 1–13 (core boss + rewards). PR 2 = Tasks 14–22 (gating + voyage lair + title chip).

---

## File Structure

**PR 1 — core boss + rewards**
- `src/db/schema/game.ts` (modify) — `finalBossClears` table.
- `drizzle/0032_*.sql` (generated) — migration.
- `src/lib/db/final-boss.ts` (create) — `isMapFullyCleared`, `getFinalBossClear`, `markFinalBossClearInTx`, `grantMapChampionRewards`.
- `src/lib/play/final-boss.ts` (create) — PURE `buildFinalBossPhases` + types (no `@/db`).
- `src/lib/collections/championsData.ts` (create) — champion cards (1/map) + `CHAMPION_TITLES` + `MAP_TO_CHAMPION_*` maps.
- `src/components/play/items/ChampionCard.tsx` (create) — via `makeVocabCard`.
- `src/lib/collections/packRegistry.ts` (modify) — `champions-v1` entry.
- `scripts/seed-champions-pack.ts` (create) — reward-only pack + 1 card/map.
- `src/lib/avatar/itemCatalog.tsx` (modify) — champion crown ItemDefs (`theme:'champion'`, `rewardOnly`).
- `src/lib/avatar/themes.ts` (modify) — `'champion'` theme + `REWARD_THEMES`.
- `src/lib/db/shop.ts` (modify) — `REWARD_WARDROBE_THEMES += 'champion'`.
- `src/lib/economy/shards.ts` (modify) — `champions-v1` in `SHARD_SWAP_EXCLUSIVE_PACKS`.
- `scripts/seed-trophies.ts` (modify) — champion trophies + `'champion'` Category.
- `src/lib/db/trophies.ts` (modify) — `'map-champion'` context case + `MAP_TO_CHAMPION_TROPHY`.
- `src/components/scenes/fx/bosses/GhostGalleon.tsx` (create) — Caribbean overlord.
- `src/lib/scenes/final-boss-roster.ts` (create) — `getFinalBoss(packSlug)`.
- `src/components/scenes/FinalBossScene.tsx` (create) — phase machine.
- `src/lib/actions/final-boss.ts` (create) — `finishFinalBossAction`.
- `src/app/play/[childId]/final-boss/[packSlug]/page.tsx` (create) — route.
- `tests/unit/distribution-isolation-guard.test.ts` (modify) — guard the action.

**PR 2 — gating + voyage lair + title chip**
- `src/lib/play/map-order.ts` (create) — `mapOrderIndex`.
- `src/lib/db/maps.ts` (modify) — gating in `listMapsForChild`.
- `src/lib/actions/maps.ts` (modify) — reject gated switch.
- `src/lib/errors/maps-errors.ts` (modify) — gated message.
- `src/components/play/MapCard.tsx` (modify) — gated state.
- `src/components/play/VoyageBoard.tsx` (modify) — lair node.
- `src/app/play/[childId]/page.tsx` (modify) — finalBoss state + title chip.
- `src/components/play/ChampionTitleChip.tsx` (create).

---

# PR 1 — Core final boss + rewards

### Task 1: `final_boss_clears` table + migration

**Files:**
- Modify: `src/db/schema/game.ts`
- Generate: `drizzle/0032_*.sql`
- Test: `tests/unit/final-boss-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/final-boss-schema.test.ts
import { describe, expect, it } from 'vitest';
import { finalBossClears } from '@/db/schema';

describe('finalBossClears schema', () => {
  it('exists with childId + packId columns', () => {
    expect(finalBossClears).toBeDefined();
    // drizzle table objects expose columns under the property names
    expect(finalBossClears.childId).toBeDefined();
    expect(finalBossClears.packId).toBeDefined();
    expect(finalBossClears.clearedAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/final-boss-schema.test.ts`
Expected: FAIL — `finalBossClears` is not exported.

- [ ] **Step 3: Add the table to `src/db/schema/game.ts`**

Append (the file already imports `pgTable`, `uuid`, `timestamp`, `primaryKey` — verify and add any missing import). Reference `curriculumPacks` from `./content` and `childProfiles` from `./auth` the same way other tables in this file import cross-schema FKs (check the file head for the existing import lines and match them):

```ts
/**
 * One row per (child, pack) once the child beats that map's final boss
 * (海域霸主). Single source of truth for "map beaten" — drives BOTH reward
 * idempotency (in finishFinalBossAction) AND next-map gating (listMapsForChild).
 */
export const finalBossClears = pgTable(
  'final_boss_clears',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    packId: uuid('pack_id')
      .notNull()
      .references(() => curriculumPacks.id, { onDelete: 'cascade' }),
    clearedAt: timestamp('cleared_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.packId] })],
);
```

If `curriculumPacks` / `childProfiles` aren't already imported in `game.ts`, add `import { childProfiles } from './auth';` and `import { curriculumPacks } from './content';` (match how the file's existing tables reference them — open the file first).

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate`
Expected: creates `drizzle/0032_*.sql` containing `CREATE TABLE "final_boss_clears"`. Do NOT hand-edit it.

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run tests/unit/final-boss-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/game.ts drizzle/ tests/unit/final-boss-schema.test.ts
git commit -m "feat(final-boss): final_boss_clears table + migration"
```

---

### Task 2: `isMapFullyCleared` + final-boss DB reads

**Files:**
- Create: `src/lib/db/final-boss.ts`
- Test: `tests/unit/final-boss-db.test.ts`

Context: `getWeekProgressForChild`-style data comes from `src/lib/db/play.ts` (`listWeekProgressForChild(childId)` returns `Array<{ weekId; completionPercent; bossCleared }>` — confirm the exact exported name in `play.ts` around line 186; it's the function returning `bossCleared`). Published weeks for a pack come from `listChildPlayableWeeks(childId)` in `src/lib/db/weeks.ts` (each has `id`, `curriculumPackId`/pack linkage — open `weeks.ts:137` to confirm fields). `isMapFullyCleared` = every playable week whose pack is `packId` has `bossCleared`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/final-boss-db.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const playableWeeks = vi.fn();
const weekProgress = vi.fn();
vi.mock('@/lib/db/weeks', () => ({ listChildPlayableWeeks: (...a: unknown[]) => playableWeeks(...a) }));
vi.mock('@/lib/db/play', () => ({ listWeekProgressForChild: (...a: unknown[]) => weekProgress(...a) }));
vi.mock('@/db', () => ({ db: {} }));

import { isMapFullyClearedFrom } from '@/lib/db/final-boss';

describe('isMapFullyClearedFrom (pure core)', () => {
  it('true only when every week of the pack is bossCleared', () => {
    const weeks = [
      { id: 'w1', curriculumPackId: 'p1' },
      { id: 'w2', curriculumPackId: 'p1' },
      { id: 'w3', curriculumPackId: 'p2' }, // other map — ignored
    ];
    const progress = [
      { weekId: 'w1', completionPercent: 100, bossCleared: true },
      { weekId: 'w2', completionPercent: 100, bossCleared: true },
    ];
    expect(isMapFullyClearedFrom('p1', weeks, progress)).toBe(true);
  });
  it('false when a week is missing its boss clear', () => {
    const weeks = [{ id: 'w1', curriculumPackId: 'p1' }, { id: 'w2', curriculumPackId: 'p1' }];
    const progress = [{ weekId: 'w1', completionPercent: 100, bossCleared: true }];
    expect(isMapFullyClearedFrom('p1', weeks, progress)).toBe(false);
  });
  it('false when the pack has zero weeks', () => {
    expect(isMapFullyClearedFrom('p1', [], [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/final-boss-db.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/db/final-boss.ts`**

First open `src/lib/db/play.ts` (≈line 186) and `src/lib/db/weeks.ts` (≈line 137) to confirm the exact exported names and the field carrying the pack id on a playable week (it is `curriculumPackId`). Then:

```ts
// NEVER import this file from client code — it pulls in postgres.
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { finalBossClears } from '@/db/schema';
import { listChildPlayableWeeks } from '@/lib/db/weeks';
import { listWeekProgressForChild } from '@/lib/db/play';

interface WeekLite { id: string; curriculumPackId: string }
interface ProgressLite { weekId: string; bossCleared: boolean }

/** Pure core: true iff the pack has ≥1 week and every one is bossCleared. */
export function isMapFullyClearedFrom(
  packId: string,
  weeks: WeekLite[],
  progress: ProgressLite[],
): boolean {
  const packWeeks = weeks.filter((w) => w.curriculumPackId === packId);
  if (packWeeks.length === 0) return false;
  const clearedSet = new Set(progress.filter((p) => p.bossCleared).map((p) => p.weekId));
  return packWeeks.every((w) => clearedSet.has(w.id));
}

export async function isMapFullyCleared(childId: string, packId: string): Promise<boolean> {
  const [weeks, progress] = await Promise.all([
    listChildPlayableWeeks(childId),
    listWeekProgressForChild(childId),
  ]);
  return isMapFullyClearedFrom(packId, weeks as WeekLite[], progress as ProgressLite[]);
}

/** Whether this child has beaten this map's final boss. */
export async function getFinalBossClear(childId: string, packId: string): Promise<boolean> {
  const rows = await db
    .select({ packId: finalBossClears.packId })
    .from(finalBossClears)
    .where(and(eq(finalBossClears.childId, childId), eq(finalBossClears.packId, packId)))
    .limit(1);
  return rows.length > 0;
}

/** All pack ids this child has beaten the final boss for (for gating). */
export async function listFinalBossClears(childId: string): Promise<string[]> {
  const rows = await db
    .select({ packId: finalBossClears.packId })
    .from(finalBossClears)
    .where(eq(finalBossClears.childId, childId));
  return rows.map((r) => r.packId);
}
```

> Note: if `listWeekProgressForChild` has a different exported name in `play.ts`, use the actual name (the one returning `bossCleared`) and update the import + the `vi.mock` target in the test to match.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/final-boss-db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/final-boss.ts tests/unit/final-boss-db.test.ts
git commit -m "feat(final-boss): isMapFullyCleared + final-boss clear reads"
```

---

### Task 3: Pure `buildFinalBossPhases`

**Files:**
- Create: `src/lib/play/final-boss.ts`
- Test: `tests/unit/build-final-boss-phases.test.ts`

Context: The boss question types live in `BossQuestionType` (`src/lib/scenes/configs.ts`). `BossScene` consumes a `CharacterDetail` shape (see `BossScene.tsx:15-24`). We reproduce that shape here as `FinalBossCharacter` and produce 3 phase-groups.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/build-final-boss-phases.test.ts
import { describe, expect, it } from 'vitest';
import {
  buildFinalBossPhases,
  FINAL_BOSS_PHASES,
  FINAL_BOSS_PER_PHASE,
  type FinalBossCharacter,
} from '@/lib/play/final-boss';

function ch(n: number): FinalBossCharacter {
  return { characterId: `c${n}`, hanzi: `字${n}`, pinyinArray: ['zi'], meaningEn: `m${n}`, meaningZh: null, imageHook: null, firstWord: null, sentence: null };
}
function seq(vals: number[]): () => number { let i = 0; return () => vals[i++ % vals.length]; }

describe('buildFinalBossPhases', () => {
  it('returns FINAL_BOSS_PHASES groups of FINAL_BOSS_PER_PHASE questions each', () => {
    const pool = Array.from({ length: 12 }, (_, i) => ch(i));
    const phases = buildFinalBossPhases(pool, seq([0.1, 0.5, 0.9]));
    expect(phases).toHaveLength(FINAL_BOSS_PHASES);
    for (const group of phases) {
      expect(group).toHaveLength(FINAL_BOSS_PER_PHASE);
      for (const q of group) {
        expect(pool.map((c) => c.characterId)).toContain(q.target.characterId);
        expect(typeof q.type).toBe('string');
      }
    }
  });
  it('returns empty when the pool is empty', () => {
    expect(buildFinalBossPhases([], seq([0.1]))).toEqual([]);
  });
  it('cycles targets with repeats when the pool is smaller than the total', () => {
    const pool = [ch(0), ch(1), ch(2)];
    const phases = buildFinalBossPhases(pool, seq([0.2, 0.7]));
    expect(phases.flat()).toHaveLength(FINAL_BOSS_PHASES * FINAL_BOSS_PER_PHASE);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/build-final-boss-phases.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/play/final-boss.ts`**

```ts
// PURE — no '@/db'. Imported by both the route (server) and the scene (client).
import type { BossQuestionType } from '@/lib/scenes/configs';

/** The CharacterDetail shape BossScene/sub-scenes consume. */
export interface FinalBossCharacter {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  firstWord: string | null;
  sentence: { id: string; text: string; translationEn: string | null } | null;
}

export interface FinalBossQuestion {
  type: BossQuestionType;
  target: FinalBossCharacter;
}

export const FINAL_BOSS_PHASES = 3;
export const FINAL_BOSS_PER_PHASE = 6;

// Reuse the boss rotation (word_match excluded — it's a multi-char round).
const QUESTION_TYPES: BossQuestionType[] = [
  'audio_pick',
  'image_pick',
  'translate_pick',
  'sentence_cloze',
  'visual_pick',
];

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build the final-boss gauntlet: FINAL_BOSS_PHASES groups × FINAL_BOSS_PER_PHASE
 * questions, targets sampled across the whole map pool (cycled with repeats when
 * the pool is smaller than the total), question types round-robin. Pure — inject
 * `rng` for deterministic tests. Returns [] for an empty pool.
 */
export function buildFinalBossPhases(
  pool: FinalBossCharacter[],
  rng: () => number = Math.random,
): FinalBossQuestion[][] {
  if (pool.length === 0) return [];
  const total = FINAL_BOSS_PHASES * FINAL_BOSS_PER_PHASE;
  const shuffled = shuffle(pool, rng);
  const flat: FinalBossQuestion[] = Array.from({ length: total }, (_, i) => ({
    type: QUESTION_TYPES[i % QUESTION_TYPES.length],
    target: shuffled[i % shuffled.length],
  }));
  const phases: FinalBossQuestion[][] = [];
  for (let p = 0; p < FINAL_BOSS_PHASES; p++) {
    phases.push(flat.slice(p * FINAL_BOSS_PER_PHASE, (p + 1) * FINAL_BOSS_PER_PHASE));
  }
  return phases;
}
```

> Confirm `BossQuestionType` includes `'audio_pick' | 'image_pick' | 'translate_pick' | 'sentence_cloze' | 'visual_pick'` (open `src/lib/scenes/configs.ts`). If a listed type isn't in the union, drop it from `QUESTION_TYPES`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/unit/build-final-boss-phases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/play/final-boss.ts tests/unit/build-final-boss-phases.test.ts
git commit -m "feat(final-boss): pure buildFinalBossPhases"
```

---

### Task 4: Champion card data + pack registry + card component + seed

**Files:**
- Create: `src/lib/collections/championsData.ts`
- Create: `src/components/play/items/ChampionCard.tsx`
- Modify: `src/lib/collections/packRegistry.ts`
- Create: `scripts/seed-champions-pack.ts`
- Test: `tests/unit/champions-data.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/champions-data.test.ts
import { describe, expect, it } from 'vitest';
import {
  CHAMPIONS,
  CHAMPIONS_BY_SLUG,
  CHAMPION_TITLES,
  MAP_TO_CHAMPION_CARD,
} from '@/lib/collections/championsData';
import { getPackMeta } from '@/lib/collections/packRegistry';

describe('champions data', () => {
  it('has one bilingual card per supported map with a title', () => {
    expect(CHAMPIONS.length).toBeGreaterThanOrEqual(1);
    for (const c of CHAMPIONS) {
      expect(c.nameZh && c.nameEn && c.emoji).toBeTruthy();
    }
    // Caribbean map → its champion card + title exist.
    expect(MAP_TO_CHAMPION_CARD['pirate-class-level-1']).toBeTruthy();
    expect(CHAMPION_TITLES['pirate-class-level-1']?.zh).toBeTruthy();
    expect(CHAMPIONS_BY_SLUG[MAP_TO_CHAMPION_CARD['pirate-class-level-1']]).toBeTruthy();
  });
  it('registers champions-v1 with an ItemCard + reveal emoji', () => {
    const meta = getPackMeta('champions-v1');
    expect(meta).toBeTruthy();
    expect(meta!.ItemCard).toBeTypeOf('function');
    expect(meta!.resolveRevealEmoji).toBeTypeOf('function');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/champions-data.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/collections/championsData.ts`**

```ts
/** 海域霸主 / Map Champion reward cards (`champions-v1`) — reward-only, one per
 *  map, earned ONLY by beating that map's final boss (pack gacha_eligible=false,
 *  shard-swap-exclusive). Bilingual per the locked collectibles rule. */
export interface ChampionItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
}

export const CHAMPIONS: ChampionItem[] = [
  {
    slug: 'champion-caribbean',
    nameZh: '加勒比海霸主',
    nameEn: 'Lord of the Caribbean',
    emoji: '👑',
    loreZh: '你击败了幽灵旗舰，成为加勒比海的霸主！',
    loreEn: 'You sank the Ghost Galleon and became Lord of the Caribbean!',
  },
];

export const CHAMPIONS_BY_SLUG: Record<string, ChampionItem> = Object.fromEntries(
  CHAMPIONS.map((c) => [c.slug, c]),
);

/** Map pack slug → its champion card slug. */
export const MAP_TO_CHAMPION_CARD: Record<string, string> = {
  'pirate-class-level-1': 'champion-caribbean',
};

/** Map pack slug → the bilingual champion title (shown on the home chip). */
export const CHAMPION_TITLES: Record<string, { zh: string; en: string }> = {
  'pirate-class-level-1': { zh: '加勒比海霸主', en: 'Lord of the Caribbean' },
};
```

- [ ] **Step 4: Implement `src/components/play/items/ChampionCard.tsx`** (reuse the vocab-card factory)

```tsx
import { makeVocabCard } from './VocabCard';
import { CHAMPIONS_BY_SLUG } from '@/lib/collections/championsData';
export const ChampionCard = makeVocabCard({ bySlug: CHAMPIONS_BY_SLUG, fallbackEmoji: '👑', testId: 'champion-card' });
```

- [ ] **Step 5: Register `champions-v1` in `src/lib/collections/packRegistry.ts`**

Add the import with the other card/data imports:

```ts
import { ChampionCard } from '@/components/play/items/ChampionCard';
import { CHAMPIONS_BY_SLUG } from '@/lib/collections/championsData';
```

Add inside `PACK_REGISTRY` (after `season-summer-v1`):

```ts
  'champions-v1': {
    displayNameZh: '海域霸主',
    displayNameEn: 'Map Champions',
    sloganZh: '击败每片海域的霸主才能获得。',
    sloganEn: 'Earned only by defeating each sea overlord.',
    themeEmoji: '👑',
    themeBannerClass: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500',
    themeAccentClass: 'text-amber-900',
    paidPullCost: 0, // reward-only — never sold / pulled via gacha
    gridColumns: 3,
    ItemCard: ChampionCard,
    resolveRevealEmoji: (slug) => CHAMPIONS_BY_SLUG[slug]?.emoji ?? null,
  },
```

- [ ] **Step 6: Implement `scripts/seed-champions-pack.ts`** (mirror `scripts/seed-festivals-pack.ts` — reward-only pack with `gachaEligible:false`)

```ts
/**
 * Seed the 海域霸主 / Map Champions reward-only pack (`champions-v1`).
 * gacha_eligible=false (never dropped/swapped cheaply). Idempotent.
 * Usage: pnpm tsx scripts/seed-champions-pack.ts
 * CAUTION: shared DATABASE_URL on Neon free tier — confirm before running.
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: false });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set in env');
  const { db } = await import('../src/db');
  const { collectionPacks, collectibleItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { CHAMPIONS } = await import('../src/lib/collections/championsData');

  const [inserted] = await db
    .insert(collectionPacks)
    .values({ slug: 'champions-v1', name: '海域霸主', description: 'Earned by defeating each map final boss.', themeColor: '#e8a93a', isActive: true, gachaEligible: false })
    .onConflictDoNothing()
    .returning();
  const pack = inserted ?? (await db.select().from(collectionPacks).where(eq(collectionPacks.slug, 'champions-v1')).limit(1))[0];
  if (!pack) throw new Error('Failed to upsert champions pack');

  const existing = await db.select({ slug: collectibleItems.slug }).from(collectibleItems).where(eq(collectibleItems.packId, pack.id));
  const have = new Set(existing.map((e) => e.slug));
  const toInsert = CHAMPIONS.filter((c) => !have.has(c.slug));
  if (toInsert.length > 0) {
    await db.insert(collectibleItems).values(
      toInsert.map((c) => ({ packId: pack.id, slug: c.slug, nameZh: c.nameZh, nameEn: c.nameEn, loreZh: c.loreZh, loreEn: c.loreEn, imageUrl: c.emoji })),
    );
  }
  console.log(`seeded champions-v1: ${CHAMPIONS.length} cards, ${toInsert.length} new`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 7: Run the test**

Run: `pnpm vitest run tests/unit/champions-data.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/collections/championsData.ts src/components/play/items/ChampionCard.tsx src/lib/collections/packRegistry.ts scripts/seed-champions-pack.ts tests/unit/champions-data.test.ts
git commit -m "feat(final-boss): champions-v1 reward card pack"
```

> **Post-merge op:** `pnpm tsx scripts/seed-champions-pack.ts`, then champion-card CF-flux art (add `champions-v1` + a subject to `generate-collectible-art-cloudflare.ts`, non-FORCE run — ~1 image).

---

### Task 5: Champion crown cosmetic + `'champion'` theme

**Files:**
- Modify: `src/lib/avatar/themes.ts`
- Modify: `src/lib/avatar/itemCatalog.tsx`
- Modify: `src/lib/db/shop.ts`
- Modify: `src/lib/economy/shards.ts`
- Test: `tests/unit/champion-cosmetic.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/champion-cosmetic.test.ts
import { describe, expect, it } from 'vitest';
import { AVATAR_THEMES, SHOP_FILTER_THEMES, isAvatarTheme } from '@/lib/avatar/themes';
import { rewardItems } from '@/lib/avatar/itemCatalog';
import { shardSwapCostForPack, SHARD_SWAP_COST_EXCLUSIVE } from '@/lib/economy/shards';

describe('champion theme + cosmetic', () => {
  it("'champion' is a theme but NOT a shop chip", () => {
    expect(isAvatarTheme('champion')).toBe(true);
    expect(SHOP_FILTER_THEMES).not.toContain('champion');
    expect(AVATAR_THEMES).toContain('champion');
  });
  it('the caribbean crown is a reward-only champion item', () => {
    const crown = rewardItems().find((i) => i.unlockRef === 'champion-caribbean');
    expect(crown).toBeTruthy();
    expect(crown!.theme).toBe('champion');
    expect(crown!.rewardOnly).toBe(true);
  });
  it('champions-v1 swap is shard-exclusive', () => {
    expect(shardSwapCostForPack('champions-v1')).toBe(SHARD_SWAP_COST_EXCLUSIVE);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/champion-cosmetic.test.ts`
Expected: FAIL.

- [ ] **Step 3: `src/lib/avatar/themes.ts`** — add `'champion'`:

In `AVATAR_THEMES` append `'champion'`; in `THEME_DISPLAY_NAMES` add `champion: { zh: '霸主', en: 'Champion' }`; in `REWARD_THEMES` append `'champion'`.

- [ ] **Step 4: `src/lib/db/shop.ts`** — add `'champion'` to `REWARD_WARDROBE_THEMES` (line ~117).

- [ ] **Step 5: `src/lib/economy/shards.ts`** — add `'champions-v1'` to the `SHARD_SWAP_EXCLUSIVE_PACKS` set.

- [ ] **Step 6: `src/lib/avatar/itemCatalog.tsx`** — add the champion crown ItemDef (mirror the `continentEurope` golden-crown ItemDef shape — slot `hat`, `rewardOnly: true`, `theme: 'champion'`, a flat-colour `renderSvg`). Place it near the other reward cosmetics and add it to the `ALL_ITEMS` array:

```tsx
const championCaribbean: ItemDef = {
  unlockRef: 'champion-caribbean',
  slot: 'hat',
  displayName: '加勒比海霸主王冠',
  rarity: 'epic',
  rewardOnly: true,
  narrativeHint: 'a grand golden champion crown with red gems',
  theme: 'champion',
  renderSvg: () => (
    <g key="champion-caribbean">
      <path d="M 30 30 L 34 18 L 42 27 L 50 14 L 58 27 L 66 18 L 70 30 Z" fill="#f4c542" stroke="#a87913" strokeWidth="1.2" />
      <rect x="30" y="30" width="40" height="6" rx="2" fill="#e0a92e" stroke="#a87913" strokeWidth="1" />
      <circle cx="50" cy="20" r="2.6" fill="#d6322f" />
      <circle cx="38" cy="26" r="1.8" fill="#2f7bd6" />
      <circle cx="62" cy="26" r="1.8" fill="#2f7bd6" />
    </g>
  ),
};
```

Add `championCaribbean,` to the `ALL_ITEMS` array (so `rewardItems()` picks it up).

- [ ] **Step 7: Run the test + typecheck**

Run: `pnpm vitest run tests/unit/champion-cosmetic.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/avatar/themes.ts src/lib/avatar/itemCatalog.tsx src/lib/db/shop.ts src/lib/economy/shards.ts tests/unit/champion-cosmetic.test.ts
git commit -m "feat(final-boss): champion crown cosmetic + 'champion' reward theme"
```

> **Post-merge op:** `pnpm tsx scripts/seed-festival-avatar-items.ts` (it seeds ALL `rewardItems()`, now incl. the champion crown).

---

### Task 6: Champion trophy

**Files:**
- Modify: `scripts/seed-trophies.ts`
- Modify: `src/lib/db/trophies.ts`
- Test: `tests/unit/champion-trophy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/champion-trophy.test.ts
import { describe, expect, it } from 'vitest';
import { TROPHIES } from '@/scripts/seed-trophies';
import { MAP_TO_CHAMPION_TROPHY } from '@/lib/db/trophies';

describe('champion trophy', () => {
  it('the caribbean champion trophy is seeded in the champion category', () => {
    const slug = MAP_TO_CHAMPION_TROPHY['pirate-class-level-1'];
    expect(slug).toBeTruthy();
    const t = TROPHIES.find((x) => x.slug === slug);
    expect(t).toBeTruthy();
    expect(t!.category).toBe('champion');
  });
});
```

> Note: confirm how the existing tests import `TROPHIES` — `scripts/seed-trophies.ts` exports `{ TROPHIES }` and guards its `main()` with `import.meta.url === pathToFileURL(process.argv[1]).href`. Use the same import path other trophy tests use (search `tests/` for `seed-trophies`); if they import via a relative path, match it.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/champion-trophy.test.ts`
Expected: FAIL.

- [ ] **Step 3: `scripts/seed-trophies.ts`** — add `'champion'` to the `Category` union and add the trophy row to `TROPHIES`:

```ts
// Category union → add 'champion':
type Category = 'mastery' | 'streak' | 'collection' | 'coins' | 'practice' | 'story' | 'season' | 'champion';

// new row in TROPHIES:
{ slug: 'champion-caribbean', emoji: '👑', nameZh: '加勒比海霸主', nameEn: 'Lord of the Caribbean', descriptionZh: '击败加勒比海的最终霸主', descriptionEn: 'Defeat the Caribbean final boss', loreZh: '幽灵旗舰沉入海底，王冠属于你。', loreEn: 'The Ghost Galleon sinks — the crown is yours.', category: 'champion', displayOrder: 90 },
```

> Confirm `trophy_category` is stored as text (not a pgEnum that needs a migration). The `trophies` table's `category` column: open `src/db/schema/trophies.ts`. If it's a pgEnum, add `'champion'` to that enum + generate a migration; if text, no migration. (The `'season'` category was added recently — follow exactly what that did.)

- [ ] **Step 4: `src/lib/db/trophies.ts`** — add the map→trophy map + the context case:

Near the other `*_TO_TROPHY` maps add:

```ts
export const MAP_TO_CHAMPION_TROPHY: Record<string, string> = {
  'pirate-class-level-1': 'champion-caribbean',
};
```

Extend `TrophyCheckContext`:

```ts
  | { kind: 'map-champion'; packSlug: string }
```

Add the case in the `switch`:

```ts
    case 'map-champion': {
      const slug = MAP_TO_CHAMPION_TROPHY[context.packSlug];
      if (slug) slugs.add(slug);
      break;
    }
```

- [ ] **Step 5: Run the test + typecheck**

Run: `pnpm vitest run tests/unit/champion-trophy.test.ts && pnpm typecheck`
Expected: PASS. (If `@/scripts/...` alias isn't configured, import via the relative path used by existing trophy tests.)

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-trophies.ts src/lib/db/trophies.ts tests/unit/champion-trophy.test.ts src/db/schema/trophies.ts drizzle/ 2>/dev/null
git commit -m "feat(final-boss): champion trophy + map-champion grant case"
```

> **Post-merge op:** `pnpm tsx scripts/seed-trophies.ts` (idempotent).

---

### Task 7: `grantMapChampionRewards` (card + trophy + cosmetic, idempotent)

**Files:**
- Modify: `src/lib/db/final-boss.ts`
- Test: `tests/unit/grant-map-champion.test.ts`

Context: mirror `grantContinentRewards` (`src/lib/db/continent-rewards.ts`) for the cosmetic grant+equip, reuse `grantSpecificCardInTx` (`src/lib/db/admin-grants.ts`) for the specific card, `checkAndGrantTrophies({kind:'map-champion'})` for the trophy. The card needs the collectible item id for the champion card slug → look it up by slug.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/grant-map-champion.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const tx = { insert: vi.fn(() => ({ values: () => ({ onConflictDoUpdate: () => ({}), onConflictDoNothing: () => ({}) }) })) };
const transaction = vi.fn(async (fn: (t: unknown) => unknown) => fn(tx));
const select = vi.fn();
vi.mock('@/db', () => ({ db: { transaction, select: (...a: unknown[]) => select(...a) } }));
const grantSpecificCardInTx = vi.fn();
vi.mock('@/lib/db/admin-grants', () => ({ grantSpecificCardInTx: (...a: unknown[]) => grantSpecificCardInTx(...a) }));
const checkAndGrantTrophies = vi.fn(async () => [{ slug: 'champion-caribbean', nameZh: '加勒比海霸主', nameEn: 'Lord of the Caribbean', emoji: '👑' }]);
vi.mock('@/lib/db/trophies', () => ({ checkAndGrantTrophies: (...a: unknown[]) => checkAndGrantTrophies(...a), MAP_TO_CHAMPION_TROPHY: { 'pirate-class-level-1': 'champion-caribbean' } }));

import { grantMapChampionRewards } from '@/lib/db/final-boss';

beforeEach(() => { vi.clearAllMocks(); });

describe('grantMapChampionRewards', () => {
  it('grants the specific champion card + trophy and returns the reveal card + trophies', async () => {
    // getPackBySlug + champion item lookup both via db.select chains:
    select.mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => [{ id: 'pk-champ' }] }) }) }); // champions pack
    select.mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: () => [{ id: 'item-1', slug: 'champion-caribbean', nameZh: '加勒比海霸主', nameEn: 'Lord of the Caribbean', loreZh: null, loreEn: null }] }) }) }) }); // champion item
    select.mockReturnValue({ from: () => ({ where: () => ({ limit: () => [] }) }) }); // cosmetic lookup (no row → no-op)

    const res = await grantMapChampionRewards('child-1', 'pirate-class-level-1');
    expect(grantSpecificCardInTx).toHaveBeenCalledWith(tx, 'child-1', 'item-1');
    expect(checkAndGrantTrophies).toHaveBeenCalledWith('child-1', { kind: 'map-champion', packSlug: 'pirate-class-level-1' });
    expect(res.card?.slug).toBe('champion-caribbean');
    expect(res.trophies).toHaveLength(1);
  });
});
```

> The mock chains are brittle; the implementer should adjust the exact `.from()/.where()/.innerJoin()/.limit()` chain shape to match the real query they write. Keep the ASSERTIONS (grantSpecificCardInTx called with the item id; trophy context; returned card slug).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/grant-map-champion.test.ts`
Expected: FAIL — `grantMapChampionRewards` not exported.

- [ ] **Step 3: Add to `src/lib/db/final-boss.ts`**

```ts
import { sql } from 'drizzle-orm';
import { collectibleItems, collectionPacks, avatarItems, childAvatarInventory, childAvatarEquipped } from '@/db/schema';
import { grantSpecificCardInTx } from '@/lib/db/admin-grants';
import { checkAndGrantTrophies, MAP_TO_CHAMPION_TROPHY, type GrantedTrophy } from '@/lib/db/trophies';
import { MAP_TO_CHAMPION_CARD } from '@/lib/collections/championsData';
import type { RevealCard } from '@/lib/play/reveal-card';

async function grantChampionCosmetic(childId: string, unlockRef: string): Promise<void> {
  const rows = await db
    .select({ id: avatarItems.id, slotId: avatarItems.slotId })
    .from(avatarItems)
    .where(eq(avatarItems.unlockRef, unlockRef))
    .limit(1);
  const item = rows[0];
  if (!item) return; // cosmetic not seeded yet — best effort
  await db.insert(childAvatarInventory).values({ childId, avatarItemId: item.id }).onConflictDoNothing();
  await db
    .insert(childAvatarEquipped)
    .values({ childId, slotId: item.slotId, avatarItemId: item.id })
    .onConflictDoUpdate({ target: [childAvatarEquipped.childId, childAvatarEquipped.slotId], set: { avatarItemId: item.id } });
}

export interface MapChampionRewards {
  card: RevealCard | null;
  trophies: GrantedTrophy[];
}

/**
 * Grant the full champion bundle for beating `packSlug`'s final boss:
 *  - the specific reward-only champion CARD (grantSpecificCardInTx),
 *  - the champion TROPHY (checkAndGrantTrophies 'map-champion'),
 *  - the champion CROWN cosmetic, auto-equipped (best effort).
 * The CALLER owns idempotency (final_boss_clears insert) — this just grants.
 */
export async function grantMapChampionRewards(childId: string, packSlug: string): Promise<MapChampionRewards> {
  let card: RevealCard | null = null;
  const cardSlug = MAP_TO_CHAMPION_CARD[packSlug];
  if (cardSlug) {
    const itemRows = await db
      .select({ id: collectibleItems.id, slug: collectibleItems.slug, nameZh: collectibleItems.nameZh, nameEn: collectibleItems.nameEn, loreZh: collectibleItems.loreZh, loreEn: collectibleItems.loreEn })
      .from(collectibleItems)
      .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId))
      .where(and(eq(collectionPacks.slug, 'champions-v1'), eq(collectibleItems.slug, cardSlug)))
      .limit(1);
    const item = itemRows[0];
    if (item) {
      await db.transaction((tx) => grantSpecificCardInTx(tx, childId, item.id));
      card = { id: item.id, slug: item.slug, packSlug: 'champions-v1', nameZh: item.nameZh, nameEn: item.nameEn, loreZh: item.loreZh, loreEn: item.loreEn, isDupe: false, shardsAfter: 0 };
    }
  }
  const trophies = await checkAndGrantTrophies(childId, { kind: 'map-champion', packSlug });
  try {
    await grantChampionCosmetic(childId, cardSlug ?? '');
  } catch (err) {
    console.error('[final-boss] cosmetic grant failed:', err);
  }
  return { card, trophies };
}
```

> The champion crown's `unlockRef` is `champion-caribbean` (Task 5) — the SAME string as the card slug, so `grantChampionCosmetic(childId, cardSlug)` resolves it. Confirm that's true for every map you add (card slug === crown unlockRef). If you ever diverge them, introduce a `MAP_TO_CHAMPION_CROWN` map.

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run tests/unit/grant-map-champion.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/final-boss.ts tests/unit/grant-map-champion.test.ts
git commit -m "feat(final-boss): grantMapChampionRewards (card + trophy + cosmetic)"
```

---

### Task 8: Ghost Galleon overlord + final-boss roster

**Files:**
- Create: `src/components/scenes/fx/bosses/GhostGalleon.tsx`
- Create: `src/lib/scenes/final-boss-roster.ts`
- Test: `tests/unit/final-boss-roster.test.tsx`

Context: read `src/components/scenes/fx/bosses/Kraken.tsx` + `src/components/scenes/fx/bosses/types.ts` for the `BossCreatureProps` contract (`{ state: 'intro'|'idle'|'damage'|'defeat'; size: number }`) and the reduced-motion handling. GhostGalleon mirrors it with a ship silhouette.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/final-boss-roster.test.tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { getFinalBoss } from '@/lib/scenes/final-boss-roster';

describe('final boss roster', () => {
  it('resolves the Caribbean overlord and renders each state', () => {
    const entry = getFinalBoss('pirate-class-level-1');
    expect(entry).toBeTruthy();
    expect(entry!.nameZh).toBeTruthy();
    const C = entry!.Component;
    for (const state of ['intro', 'idle', 'damage', 'defeat'] as const) {
      const { container } = render(<C state={state} size={200} />);
      expect(container.querySelector('svg')).toBeTruthy();
    }
  });
  it('returns null for a map with no overlord yet', () => {
    expect(getFinalBoss('pirate-class-level-2')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/final-boss-roster.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `GhostGalleon.tsx`** (mirror `Kraken.tsx`'s prop handling + `useReducedMotion`; a haunted galleon silhouette). Keep it self-contained — a framer-motion `motion.svg` with per-state variants and a static fallback:

```tsx
'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/** 幽灵旗舰 / Ghost Galleon — the Caribbean map overlord. Bigger + ship-shaped,
 *  distinct from the weekly sea creatures. Honors reduced-motion. */
export function GhostGalleon({ state, size }: BossCreatureProps) {
  const reduced = useReducedMotion();
  const tint = state === 'damage' ? '#b34b4b' : state === 'defeat' ? '#5b6770' : '#3a4a5a';
  const opacity = state === 'defeat' ? 0.45 : 0.92;

  const anim = reduced
    ? {}
    : state === 'intro'
      ? { y: [20, 0], opacity: [0, opacity] }
      : state === 'idle'
        ? { y: [0, -4, 0] }
        : state === 'damage'
          ? { x: [0, -6, 6, 0] }
          : { y: [0, 30], opacity: [opacity, 0.2], rotate: [0, -8] };

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Ghost Galleon"
      animate={anim}
      transition={{ duration: state === 'idle' ? 2.4 : 0.9, repeat: state === 'idle' && !reduced ? Infinity : 0, ease: 'easeInOut' }}
    >
      {/* hull */}
      <path d="M 20 60 Q 50 78 80 60 L 74 70 Q 50 84 26 70 Z" fill={tint} stroke="#1f2a36" strokeWidth="1.5" opacity={opacity} />
      {/* masts */}
      <rect x="48.5" y="24" width="3" height="38" fill="#26323e" opacity={opacity} />
      {/* tattered sails */}
      <path d="M 51 28 Q 66 33 64 46 L 51 44 Z" fill="#cdd6dd" opacity={opacity * 0.85} />
      <path d="M 49 28 Q 34 33 36 46 L 49 44 Z" fill="#cdd6dd" opacity={opacity * 0.85} />
      {/* skull flag */}
      <rect x="50.5" y="20" width="10" height="7" fill="#1f2a36" opacity={opacity} />
      <circle cx="55.5" cy="23.5" r="1.6" fill="#e8e8e8" />
      {/* ghost glow */}
      <ellipse cx="50" cy="58" rx="34" ry="8" fill="#7fe3d6" opacity={state === 'defeat' ? 0.05 : 0.15} />
    </motion.svg>
  );
}
```

- [ ] **Step 4: Implement `src/lib/scenes/final-boss-roster.ts`** (client-only, holds the component — RSC hazard like `boss-roster.ts`):

```ts
import type { ComponentType } from 'react';
import type { BossCreatureProps } from '@/components/scenes/fx/bosses/types';
import { GhostGalleon } from '@/components/scenes/fx/bosses/GhostGalleon';

export interface FinalBossEntry {
  key: string;
  nameZh: string;
  nameEn: string;
  Component: ComponentType<BossCreatureProps>;
}

/** Map pack slug → its overlord. Add an entry per map (印度洋 gets its own). */
const FINAL_BOSS_ROSTER: Record<string, FinalBossEntry> = {
  'pirate-class-level-1': { key: 'ghost-galleon', nameZh: '幽灵旗舰', nameEn: 'Ghost Galleon', Component: GhostGalleon },
};

export function getFinalBoss(packSlug: string): FinalBossEntry | null {
  return FINAL_BOSS_ROSTER[packSlug] ?? null;
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run tests/unit/final-boss-roster.test.tsx && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/scenes/fx/bosses/GhostGalleon.tsx src/lib/scenes/final-boss-roster.ts tests/unit/final-boss-roster.test.tsx
git commit -m "feat(final-boss): Ghost Galleon overlord + roster"
```

---

### Task 9: `FinalBossScene` (multi-phase, full restart)

**Files:**
- Create: `src/components/scenes/FinalBossScene.tsx`
- Test: `tests/unit/components/scenes/FinalBossScene.test.tsx`

Context: adapt `BossScene.tsx` (read it). Differences: questions come pre-grouped into phases (`FinalBossQuestion[][]`); clearing a phase shows an enrage beat + a "第N阶段" banner; the overlord is `getFinalBoss(packSlug)`; loss = full restart to phase 0.

- [ ] **Step 1: Write the failing test** (drive the happy path with mocked sub-scenes)

```tsx
// tests/unit/components/scenes/FinalBossScene.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { FinalBossQuestion } from '@/lib/play/final-boss';

// Each sub-scene becomes a button that calls onComplete(true) when clicked.
function stub(name: string) {
  return { [name]: ({ onComplete }: { onComplete: (c: boolean) => void }) => (
    <button data-testid={`sub-${name}`} onClick={() => onComplete(true)}>answer</button>
  ) };
}
vi.mock('@/components/scenes/AudioPickScene', () => stub('AudioPickScene'));
vi.mock('@/components/scenes/ImagePickScene', () => stub('ImagePickScene'));
vi.mock('@/components/scenes/TranslatePickScene', () => stub('TranslatePickScene'));
vi.mock('@/components/scenes/SentenceClozeScene', () => stub('SentenceClozeScene'));
vi.mock('@/components/scenes/VisualPickScene', () => stub('VisualPickScene'));
vi.mock('@/lib/scenes/final-boss-roster', () => ({
  getFinalBoss: () => ({ key: 'gg', nameZh: '幽灵旗舰', nameEn: 'Ghost Galleon', Component: ({ state }: { state: string }) => <div data-testid="creature" data-state={state} /> }),
}));

import { FinalBossScene } from '@/components/scenes/FinalBossScene';

function q(id: string): FinalBossQuestion {
  return { type: 'audio_pick', target: { characterId: id, hanzi: id, pinyinArray: ['x'], meaningEn: id, meaningZh: null, imageHook: null, firstWord: null, sentence: null } };
}
// 3 phases × 1 question each for a fast test.
const phases: FinalBossQuestion[][] = [[q('a')], [q('b')], [q('c')]];

describe('FinalBossScene', () => {
  it('advances through all phases then calls onComplete(true)', () => {
    const onComplete = vi.fn();
    vi.useFakeTimers();
    render(<FinalBossScene packSlug="pirate-class-level-1" mapNameZh="加勒比海" mapNameEn="Caribbean" phases={phases} onComplete={onComplete} />);
    // skip the intro timer
    act(() => { vi.runOnlyPendingTimers(); });
    // answer all 3 phase questions
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('sub-AudioPickScene'));
      act(() => { vi.runOnlyPendingTimers(); }); // enrage / defeat timers
    }
    act(() => { vi.runOnlyPendingTimers(); });
    expect(onComplete).toHaveBeenCalledWith(true);
    vi.useRealTimers();
  });
});
```

> The exact timer-advance count depends on the implementation's enrage/defeat delays. The implementer should make the test green by aligning `act(runOnlyPendingTimers)` calls with the timers they introduce — keep the ASSERTION (`onComplete(true)` after the last phase).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/components/scenes/FinalBossScene.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/scenes/FinalBossScene.tsx`** (adapt `BossScene`; phases + enrage + full restart)

```tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { getFinalBoss } from '@/lib/scenes/final-boss-roster';
import type { BossAnimState } from './fx/bosses/types';
import type { FinalBossQuestion, FinalBossCharacter } from '@/lib/play/final-boss';
import { AudioPickScene } from './AudioPickScene';
import { ImagePickScene } from './ImagePickScene';
import { TranslatePickScene } from './TranslatePickScene';
import { SentenceClozeScene } from './SentenceClozeScene';
import { VisualPickScene } from './VisualPickScene';

interface Props {
  packSlug: string;
  mapNameZh: string;
  mapNameEn: string;
  phases: FinalBossQuestion[][];
  onComplete: (won: boolean) => void;
}

type Phase = 'intro' | 'fighting' | 'enrage' | 'defeating' | 'defeated';
const INTRO_MS = 1200;
const ENRAGE_MS = 900;
const DEFEAT_MS = 1400;

export function FinalBossScene({ packSlug, mapNameZh, mapNameEn, phases, onComplete }: Props) {
  const overlord = useMemo(() => getFinalBoss(packSlug), [packSlug]);
  const total = phases.reduce((s, p) => s + p.length, 0);

  const [phaseIdx, setPhaseIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [phase, setPhase] = useState<Phase>('intro');
  const [anim, setAnim] = useState<BossAnimState>('intro');
  const enrageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => { setPhase('fighting'); setAnim('idle'); }, INTRO_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => () => {
    if (enrageTimer.current) clearTimeout(enrageTimer.current);
    if (winTimer.current) clearTimeout(winTimer.current);
  }, []);

  if (!overlord) {
    return <main className="flex flex-1 items-center justify-center text-[var(--color-bad)]">No overlord for this map.</main>;
  }
  const Creature = overlord.Component;

  const answeredSoFar = phases.slice(0, phaseIdx).reduce((s, p) => s + p.length, 0) + qIdx;

  const win = () => { setPhase('defeating'); setAnim('defeat'); winTimer.current = setTimeout(() => onComplete(true), DEFEAT_MS); };

  const advanceWithinOrAcrossPhase = () => {
    const curr = phases[phaseIdx];
    if (qIdx + 1 < curr.length) { setQIdx(qIdx + 1); return; }
    // phase cleared
    if (phaseIdx + 1 >= phases.length) { win(); return; }
    setPhase('enrage'); setAnim('damage');
    enrageTimer.current = setTimeout(() => {
      setPhaseIdx(phaseIdx + 1); setQIdx(0); setAnim('idle'); setPhase('fighting');
    }, ENRAGE_MS);
  };

  const handleAnswer = (correct: boolean) => {
    if (!correct) {
      const remaining = lives - 1;
      setLives(remaining);
      if (remaining === 0) { setPhase('defeated'); setAnim('idle'); return; }
    }
    advanceWithinOrAcrossPhase();
  };

  const reset = () => { setPhaseIdx(0); setQIdx(0); setLives(3); setAnim('intro'); setPhase('intro'); };

  if (phase === 'defeating') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Creature state="defeat" size={240} />
        <h2 className="font-hanzi text-3xl font-bold text-[var(--color-good)]">胜利！/ Victory!</h2>
        <p className="text-base">{mapNameZh} 霸主已被击败 / {mapNameEn} overlord defeated</p>
      </main>
    );
  }

  if (phase === 'defeated') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Creature state="idle" size={200} />
        <h2 className="font-hanzi text-2xl font-bold text-[var(--color-bad)]">
          霸主太强了！<span className="mt-1 block text-base font-semibold opacity-80">The overlord is too strong!</span>
        </h2>
        <p className="text-base">重新开始,从第一阶段再战。<span className="block text-sm opacity-75">Start over from Phase 1.</span></p>
        <WoodSignButton size="lg" onClick={reset}>⚓ 再战 (免费) / Fight again (free)</WoodSignButton>
      </main>
    );
  }

  if (phase === 'enrage') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Creature state="damage" size={170} />
        <h2 className="font-hanzi text-2xl font-extrabold text-[var(--color-sunset-600)]">
          第 {phaseIdx + 2} 阶段！<span className="block text-base">Phase {phaseIdx + 2}!</span>
        </h2>
      </main>
    );
  }

  const q = phases[phaseIdx]?.[qIdx];
  const pool: FinalBossCharacter[] = useMemo(() => phases.flat().map((x) => x.target), [phases]);
  if (!q) return null;

  return (
    <main className="flex min-h-[80vh] flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-sand-200)] bg-white/50 px-6 py-3 text-sm backdrop-blur">
        <span data-testid="boss-lives" className="font-bold text-[var(--color-bad)]">{'⚓'.repeat(lives)}{'·'.repeat(3 - lives)}</span>
        <span data-testid="phase-pips" className="font-bold text-[var(--color-ocean-700)]">
          {Array.from({ length: phases.length }, (_, i) => (i < phaseIdx ? '●' : i === phaseIdx ? '◉' : '○')).join(' ')}
        </span>
        <span className="rounded-full bg-[var(--color-ocean-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-ocean-700)]">{answeredSoFar + 1} / {total}</span>
      </div>
      <div className="flex justify-center pt-4"><Creature state={anim} size={150} /></div>
      <div className="flex-1">
        {q.type === 'audio_pick' && <AudioPickScene key={`fb-${phaseIdx}-${qIdx}`} target={q.target} pool={pool} onComplete={handleAnswer} />}
        {q.type === 'image_pick' && <ImagePickScene key={`fb-${phaseIdx}-${qIdx}`} target={q.target} pool={pool} onComplete={handleAnswer} />}
        {q.type === 'visual_pick' && <VisualPickScene key={`fb-${phaseIdx}-${qIdx}`} target={q.target} pool={pool} onComplete={handleAnswer} />}
        {q.type === 'translate_pick' && <TranslatePickScene key={`fb-${phaseIdx}-${qIdx}`} target={q.target} pool={pool} direction={qIdx % 2 === 0 ? 'cn_to_en' : 'en_to_cn'} onComplete={handleAnswer} />}
        {q.type === 'sentence_cloze' && q.target.sentence && <SentenceClozeScene key={`fb-${phaseIdx}-${qIdx}`} target={q.target} pool={pool} sentenceText={q.target.sentence.text} translationEn={q.target.sentence.translationEn} onComplete={handleAnswer} />}
        {q.type === 'sentence_cloze' && !q.target.sentence && <TranslatePickScene key={`fb-${phaseIdx}-${qIdx}`} target={q.target} pool={pool} direction="cn_to_en" onComplete={handleAnswer} />}
      </div>
    </main>
  );
}
```

> The sub-scene prop shapes (`target`, `pool`, `onComplete`, `direction`, `sentenceText`) are exactly what `BossScene.tsx` passes — copy them verbatim from there. Note `pool`/hooks must obey rules-of-hooks (the early `if (!overlord) return` is BEFORE hooks here — move the `useMemo`s above any early return if the linter complains; mirror `BossScene`'s ordering, which computes memos first).

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run tests/unit/components/scenes/FinalBossScene.test.tsx && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/scenes/FinalBossScene.tsx tests/unit/components/scenes/FinalBossScene.test.tsx
git commit -m "feat(final-boss): multi-phase FinalBossScene"
```

---

### Task 10: `finishFinalBossAction`

**Files:**
- Create: `src/lib/actions/final-boss.ts`
- Modify: `src/lib/db/final-boss.ts` (add `markFinalBossClearInTx` / a clear+grant orchestrator)
- Test: `tests/unit/actions/final-boss.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/actions/final-boss.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({ requireChild: vi.fn(async (childId: string) => ({ parent: { id: 'p' }, child: { id: childId } })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const getPackBySlug = vi.fn(async () => ({ id: 'pk', slug: 'pirate-class-level-1' }));
vi.mock('@/lib/db/collections', () => ({ getPackBySlug: (...a: unknown[]) => getPackBySlug(...a) }));
const isMapFullyCleared = vi.fn(async () => true);
const recordFinalBossClear = vi.fn(async () => ({ firstClear: true }));
const grantMapChampionRewards = vi.fn(async () => ({ card: { id: 'i', slug: 'champion-caribbean', packSlug: 'champions-v1', nameZh: 'x', nameEn: 'y', loreZh: null, loreEn: null, isDupe: false, shardsAfter: 0 }, trophies: [{ slug: 'champion-caribbean' }] }));
vi.mock('@/lib/db/final-boss', () => ({
  isMapFullyCleared: (...a: unknown[]) => isMapFullyCleared(...a),
  recordFinalBossClear: (...a: unknown[]) => recordFinalBossClear(...a),
  grantMapChampionRewards: (...a: unknown[]) => grantMapChampionRewards(...a),
}));

import { finishFinalBossAction } from '@/lib/actions/final-boss';

beforeEach(() => { vi.clearAllMocks(); });

describe('finishFinalBossAction', () => {
  it('on first clear: records the clear, grants the bundle, returns card + trophies', async () => {
    const res = await finishFinalBossAction({ childId: 'c1', packSlug: 'pirate-class-level-1' });
    expect(recordFinalBossClear).toHaveBeenCalledWith('c1', 'pk');
    expect(grantMapChampionRewards).toHaveBeenCalledWith('c1', 'pirate-class-level-1');
    expect(res.cardGrants).toHaveLength(1);
    expect(res.trophies).toHaveLength(1);
  });
  it('rejects when the map is not fully cleared (anti-cheat)', async () => {
    isMapFullyCleared.mockResolvedValueOnce(false);
    await expect(finishFinalBossAction({ childId: 'c1', packSlug: 'pirate-class-level-1' })).rejects.toThrow();
    expect(recordFinalBossClear).not.toHaveBeenCalled();
  });
  it('is idempotent: a repeat clear grants nothing again', async () => {
    recordFinalBossClear.mockResolvedValueOnce({ firstClear: false });
    const res = await finishFinalBossAction({ childId: 'c1', packSlug: 'pirate-class-level-1' });
    expect(grantMapChampionRewards).not.toHaveBeenCalled();
    expect(res.cardGrants).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/actions/final-boss.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add `recordFinalBossClear` to `src/lib/db/final-boss.ts`** (idempotent insert):

```ts
/** Insert the (child, pack) clear. firstClear=false if it already existed. */
export async function recordFinalBossClear(childId: string, packId: string): Promise<{ firstClear: boolean }> {
  try {
    await db.insert(finalBossClears).values({ childId, packId });
    return { firstClear: true };
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
      return { firstClear: false };
    }
    throw err;
  }
}
```

- [ ] **Step 4: Implement `src/lib/actions/final-boss.ts`**

```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { getPackBySlug } from '@/lib/db/collections';
import { isMapFullyCleared, recordFinalBossClear, grantMapChampionRewards } from '@/lib/db/final-boss';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { GrantedTrophy } from '@/lib/db/trophies';

const Schema = z.object({ childId: z.string().min(1), packSlug: z.string() });

/**
 * Finish a map final boss. Anti-cheat: re-verify the whole map is cleared.
 * Idempotent: the final_boss_clears insert is the single grant guard — a repeat
 * clear records nothing new and grants nothing. First clear grants the champion
 * bundle (card + trophy + cosmetic) and unlocks the next map (the row IS the gate).
 */
export async function finishFinalBossAction(
  input: z.input<typeof Schema>,
): Promise<{ ok: true; cardGrants: RevealCard[]; trophies: GrantedTrophy[] }> {
  const parsed = Schema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const pack = await getPackBySlug(parsed.packSlug);
  if (!pack) throw new Error('Map not found');

  const cleared = await isMapFullyCleared(child.id, pack.id);
  if (!cleared) throw new Error('Map not fully cleared');

  const { firstClear } = await recordFinalBossClear(child.id, pack.id);
  if (!firstClear) {
    revalidatePath(`/play/${child.id}`);
    return { ok: true, cardGrants: [], trophies: [] };
  }

  const { card, trophies } = await grantMapChampionRewards(child.id, parsed.packSlug);
  revalidatePath(`/play/${child.id}`);
  revalidatePath(`/play/${child.id}/maps`);
  return { ok: true, cardGrants: card ? [card] : [], trophies };
}
```

- [ ] **Step 5: Run the test + typecheck**

Run: `pnpm vitest run tests/unit/actions/final-boss.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/final-boss.ts src/lib/db/final-boss.ts tests/unit/actions/final-boss.test.ts
git commit -m "feat(final-boss): finishFinalBossAction (anti-cheat + idempotent)"
```

---

### Task 11: Final-boss route + reveal wiring

**Files:**
- Create: `src/app/play/[childId]/final-boss/[packSlug]/page.tsx`
- Create: `src/components/scenes/FinalBossRunner.tsx` (client wrapper: scene → action → reveal)
- Test: `tests/unit/app/final-boss-route.test.tsx`

Context: the route must build the whole-map pool. Reuse `getCharactersWithDetailsForWeek(weekId)` per playable week of the pack and map each to `FinalBossCharacter`. Look at how the section page (`src/app/play/[childId]/level/[weekId]/[section]/page.tsx`) maps a `CharacterWithDetails` → the BossScene `CharacterDetail` shape and copy that mapper.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/app/final-boss-route.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireChild = vi.fn(async () => ({ parent: { id: 'p' }, child: { id: 'c1' } }));
vi.mock('@/lib/auth/guards', () => ({ requireChild: (...a: unknown[]) => requireChild(...a) }));
const redirect = vi.fn(() => { throw new Error('redirect'); });
const notFound = vi.fn(() => { throw new Error('notFound'); });
vi.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => redirect(...a), notFound: () => notFound() }));
const getPackBySlug = vi.fn(async () => ({ id: 'pk', slug: 'pirate-class-level-1' }));
vi.mock('@/lib/db/collections', () => ({ getPackBySlug: (...a: unknown[]) => getPackBySlug(...a) }));
const isMapFullyCleared = vi.fn();
vi.mock('@/lib/db/final-boss', () => ({ isMapFullyCleared: (...a: unknown[]) => isMapFullyCleared(...a) }));
vi.mock('@/lib/db/weeks', () => ({ listChildPlayableWeeks: vi.fn(async () => [{ id: 'w1', curriculumPackId: 'pk' }]) }));
vi.mock('@/lib/db/characters', () => ({ getCharactersWithDetailsForWeek: vi.fn(async () => [{ id: 'ch1', hanzi: '好', pinyinArray: ['hǎo'], meaningEn: 'good', meaningZh: null, imageHook: null, words: [], sentence: null }]) }));
vi.mock('@/lib/collections/packRegistry', () => ({ getPackMeta: () => ({ displayNameZh: '加勒比海', displayNameEn: 'Caribbean' }) }));
vi.mock('@/components/scenes/FinalBossRunner', () => ({ FinalBossRunner: () => <div data-testid="fb-runner" /> }));

import FinalBossPage from '@/app/play/[childId]/final-boss/[packSlug]/page';

beforeEach(() => { vi.clearAllMocks(); });

describe('final-boss route', () => {
  it('redirects to /maps when the map is not fully cleared', async () => {
    isMapFullyCleared.mockResolvedValue(false);
    await expect(FinalBossPage({ params: Promise.resolve({ childId: 'c1', packSlug: 'pirate-class-level-1' }) })).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenCalledWith('/play/c1/maps');
  });
  it('renders the runner when fully cleared', async () => {
    isMapFullyCleared.mockResolvedValue(true);
    const ui = await FinalBossPage({ params: Promise.resolve({ childId: 'c1', packSlug: 'pirate-class-level-1' }) });
    const { render, screen } = await import('@testing-library/react');
    render(ui);
    expect(screen.getByTestId('fb-runner')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/unit/app/final-boss-route.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `FinalBossRunner.tsx`** (client — runs the scene, calls the action, shows reveal)

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FinalBossScene } from './FinalBossScene';
import { CardChestReveal } from './fx/CardChestReveal';
import { TrophyToast } from '@/components/play/TrophyToast';
import { finishFinalBossAction } from '@/lib/actions/final-boss';
import type { FinalBossQuestion } from '@/lib/play/final-boss';
import type { RevealCard } from '@/lib/play/reveal-card';
import type { GrantedTrophy } from '@/lib/db/trophies';

interface Props {
  childId: string;
  packSlug: string;
  mapNameZh: string;
  mapNameEn: string;
  phases: FinalBossQuestion[][];
}

export function FinalBossRunner({ childId, packSlug, mapNameZh, mapNameEn, phases }: Props) {
  const router = useRouter();
  const [cards, setCards] = useState<RevealCard[]>([]);
  const [trophies, setTrophies] = useState<GrantedTrophy[]>([]);
  const [done, setDone] = useState(false);
  const [, start] = useTransition();

  const onComplete = (won: boolean) => {
    if (!won) return;
    start(async () => {
      const res = await finishFinalBossAction({ childId, packSlug });
      setCards(res.cardGrants);
      setTrophies(res.trophies);
      setDone(true);
    });
  };

  return (
    <>
      <FinalBossScene packSlug={packSlug} mapNameZh={mapNameZh} mapNameEn={mapNameEn} phases={phases} onComplete={onComplete} />
      {done && cards.length === 0 && trophies.length === 0 ? (
        // already-cleared replay: just bounce home after the victory beat
        <FinishRedirect onDone={() => router.push(`/play/${childId}`)} />
      ) : null}
      {cards.length > 0 ? <CardChestReveal cards={cards} onDone={() => { setCards([]); router.push(`/play/${childId}`); }} /> : null}
      <TrophyToast trophies={trophies} onDone={() => setTrophies([])} />
    </>
  );
}

function FinishRedirect({ onDone }: { onDone: () => void }) {
  // simple effect-based redirect after the scene's own victory screen
  if (typeof window !== 'undefined') setTimeout(onDone, 1500);
  return null;
}
```

> If the lint flags the inline `setTimeout` in `FinishRedirect`, convert it to a `useEffect`. Keep it minimal — the happy path is the reveal.

- [ ] **Step 4: Implement the route `src/app/play/[childId]/final-boss/[packSlug]/page.tsx`**

```tsx
import { notFound, redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getPackBySlug } from '@/lib/db/collections';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { isMapFullyCleared } from '@/lib/db/final-boss';
import { listChildPlayableWeeks } from '@/lib/db/weeks';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import { buildFinalBossPhases, type FinalBossCharacter } from '@/lib/play/final-boss';
import { FinalBossRunner } from '@/components/scenes/FinalBossRunner';

interface PageProps { params: Promise<{ childId: string; packSlug: string }> }

export default async function FinalBossPage({ params }: PageProps) {
  const { childId, packSlug } = await params;
  await requireChild(childId);

  const pack = await getPackBySlug(packSlug);
  const meta = getPackMeta(packSlug);
  if (!pack) notFound();

  if (!(await isMapFullyCleared(childId, pack.id))) {
    redirect(`/play/${childId}/maps`);
  }

  // Aggregate the whole map's characters.
  const weeks = (await listChildPlayableWeeks(childId)).filter((w) => w.curriculumPackId === pack.id);
  const perWeek = await Promise.all(weeks.map((w) => getCharactersWithDetailsForWeek(w.id)));
  const pool: FinalBossCharacter[] = perWeek.flat().map((c) => ({
    characterId: c.id,
    hanzi: c.hanzi,
    pinyinArray: c.pinyinArray,
    meaningEn: c.meaningEn,
    meaningZh: c.meaningZh,
    imageHook: c.imageHook,
    firstWord: c.words?.[0]?.text ?? null,
    sentence: c.sentence ? { id: c.sentence.id, text: c.sentence.text, translationEn: c.sentence.translationEn } : null,
  }));

  const phases = buildFinalBossPhases(pool);

  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <FinalBossRunner
        childId={childId}
        packSlug={packSlug}
        mapNameZh={meta?.displayNameZh ?? pack.name}
        mapNameEn={meta?.displayNameEn ?? pack.name}
        phases={phases}
      />
    </main>
  );
}
```

> Match the exact field names of `CharacterWithDetails` from `getCharactersWithDetailsForWeek` (open `src/lib/db/characters.ts` — the mapper to the boss `CharacterDetail` already exists in the section page; copy its field access for `pinyinArray`/`meaningEn`/`words[0]`/`sentence`). Adjust the mock in the test to match the real shape if needed.

- [ ] **Step 5: Run the test + typecheck**

Run: `pnpm vitest run tests/unit/app/final-boss-route.test.tsx && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/play/[childId]/final-boss/[packSlug]/page.tsx" src/components/scenes/FinalBossRunner.tsx tests/unit/app/final-boss-route.test.tsx
git commit -m "feat(final-boss): final-boss route + reveal runner"
```

---

### Task 12: Distribution-isolation guard

**Files:**
- Modify: `tests/unit/distribution-isolation-guard.test.ts`

- [ ] **Step 1: Add the assertion**

```ts
it('finishFinalBossAction is requireChild-gated', () => {
  const src = read('src/lib/actions/final-boss.ts');
  expect(src.trimStart()).toMatch(/^['"]use server['"]/);
  expect(src).toMatch(/requireChild\(/);
});
```

- [ ] **Step 2: Run + commit**

Run: `pnpm vitest run tests/unit/distribution-isolation-guard.test.ts`
Expected: PASS.

```bash
git add tests/unit/distribution-isolation-guard.test.ts
git commit -m "test(final-boss): isolation guard for finishFinalBossAction"
```

---

### Task 13: PR 1 four-green + open PR

- [ ] **Step 1: Run the full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. (`pnpm build` runs `scripts/migrate.ts` against prod first — it APPLIES migration 0032/`final_boss_clears` to prod. That's additive and unused until deploy; acceptable per the existing "local build applies migrations" landmine.)

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin feat/map-final-boss
gh pr create --title "feat(final-boss): map overlord battle + champion rewards (core)" --body "Core of the map final boss (spec: docs/superpowers/specs/2026-06-30-map-final-boss-design.md): final_boss_clears table, multi-phase FinalBossScene vs. the Ghost Galleon overlord, champion card pack + crown cosmetic + trophy, finishFinalBossAction (anti-cheat + idempotent), final-boss route. Gating + voyage lair node + title chip follow in PR 2. Post-merge: seed-champions-pack.ts, seed-trophies.ts, seed-festival-avatar-items.ts, champion card art.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

# PR 2 — Map gating + voyage lair node + home title chip

> Branch from updated `main` after PR 1 merges, OR stack on `feat/map-final-boss` (David's call at execution time — vocab packs were stacked).

### Task 14: `mapOrderIndex` pure helper

**Files:**
- Create: `src/lib/play/map-order.ts`
- Test: `tests/unit/map-order.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/map-order.test.ts
import { describe, expect, it } from 'vitest';
import { mapOrderIndex } from '@/lib/play/map-order';

describe('mapOrderIndex', () => {
  it('parses pirate-class-level-N', () => {
    expect(mapOrderIndex('pirate-class-level-1')).toBe(1);
    expect(mapOrderIndex('pirate-class-level-2')).toBe(2);
  });
  it('sorts non-conforming slugs last (large sentinel)', () => {
    expect(mapOrderIndex('school-custom')).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Run to verify it fails / Step 3: Implement**

```ts
// src/lib/play/map-order.ts
/** Linear map order from the slug convention `pirate-class-level-N`. Maps
 *  without a parseable level sort last (sentinel) and are never gated. */
export function mapOrderIndex(slug: string): number {
  const m = /-level-(\d+)$/.exec(slug);
  return m ? parseInt(m[1], 10) : 100000;
}
```

- [ ] **Step 4: Run to verify it passes / Step 5: Commit**

Run: `pnpm vitest run tests/unit/map-order.test.ts`

```bash
git add src/lib/play/map-order.ts tests/unit/map-order.test.ts
git commit -m "feat(final-boss): mapOrderIndex helper"
```

---

### Task 15: Gating in `listMapsForChild`

**Files:**
- Modify: `src/lib/db/maps.ts`
- Test: `tests/unit/maps-gating.test.ts`

Decision: `listMapsForChild` returns each map with a NEW `gated: boolean` field (locked specifically because the previous overlord isn't beaten, distinct from `isLocked` for 0-week). `isLocked` stays the broad "can't enter" flag = `weekCount === 0 || gated`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/maps-gating.test.ts
import { describe, expect, it } from 'vitest';
import { computeMapGating, type RawMap } from '@/lib/db/maps';

const maps: RawMap[] = [
  { packId: 'p1', slug: 'pirate-class-level-1', nameZh: '加勒比海', nameEn: 'Caribbean', name: 'c', weekCount: 10 },
  { packId: 'p2', slug: 'pirate-class-level-2', nameZh: '印度洋', nameEn: 'Indian', name: 'i', weekCount: 9 },
];

describe('computeMapGating', () => {
  it('map 1 is never gated; map 2 is gated until map 1 overlord beaten', () => {
    const out = computeMapGating(maps, new Set(), 'p1');
    expect(out.find((m) => m.packId === 'p1')!.gated).toBe(false);
    expect(out.find((m) => m.packId === 'p2')!.gated).toBe(true);
    expect(out.find((m) => m.packId === 'p2')!.isLocked).toBe(true);
  });
  it('beating map 1 ungates map 2', () => {
    const out = computeMapGating(maps, new Set(['p1']), 'p1');
    expect(out.find((m) => m.packId === 'p2')!.gated).toBe(false);
    expect(out.find((m) => m.packId === 'p2')!.isLocked).toBe(false);
  });
  it('a 0-week map stays locked even if ungated', () => {
    const zero: RawMap[] = [{ ...maps[0] }, { ...maps[1], weekCount: 0 }];
    const out = computeMapGating(zero, new Set(['p1']), 'p1');
    expect(out.find((m) => m.packId === 'p2')!.isLocked).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails / Step 3: Implement**

In `src/lib/db/maps.ts`: export a `RawMap` interface + a pure `computeMapGating`, add `gated` to `MapForChild`, and use `listFinalBossClears` in `listMapsForChild`.

```ts
import { mapOrderIndex } from '@/lib/play/map-order';
import { listFinalBossClears } from '@/lib/db/final-boss';

export interface RawMap {
  packId: string; slug: string; nameZh: string | null; nameEn: string | null; name: string; weekCount: number;
}

/** Pure gating core. A map (order>min) is `gated` until the IMMEDIATELY-previous
 *  map (by order) is in `clearedPackIds`. Map at the minimum order is never gated. */
export function computeMapGating(rows: RawMap[], clearedPackIds: Set<string>, currentPackId: string | null) {
  const ordered = [...rows].sort((a, b) => mapOrderIndex(a.slug) - mapOrderIndex(b.slug));
  return ordered.map((r, i) => {
    const prev = ordered[i - 1];
    const gated = i > 0 && prev ? !clearedPackIds.has(prev.packId) : false;
    return {
      packId: r.packId,
      slug: r.slug,
      nameZh: r.nameZh ?? r.name,
      nameEn: r.nameEn ?? r.name,
      weekCount: r.weekCount,
      clearedCount: 0,
      isCurrent: r.packId === currentPackId,
      gated,
      isLocked: r.weekCount === 0 || gated,
    };
  });
}
```

Update `MapForChild` to add `gated: boolean`, and rewrite the tail of `listMapsForChild` to:

```ts
  const clearedPackIds = new Set(await listFinalBossClears(childId));
  return computeMapGating(rows as RawMap[], clearedPackIds, currentPackId);
```

- [ ] **Step 4: Run to verify it passes / Step 5: Commit**

Run: `pnpm vitest run tests/unit/maps-gating.test.ts && pnpm typecheck`

```bash
git add src/lib/db/maps.ts tests/unit/maps-gating.test.ts
git commit -m "feat(final-boss): gate maps behind the previous overlord"
```

---

### Task 16: Reject gated map switch

**Files:**
- Modify: `src/lib/actions/maps.ts`
- Modify: `src/lib/errors/maps-errors.ts`
- Test: `tests/unit/actions/maps-switch-gated.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/actions/maps-switch-gated.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
vi.mock('@/lib/auth/guards', () => ({ requireChild: vi.fn(async (id: string) => ({ parent: { id: 'p' }, child: { id } })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const listMapsForChild = vi.fn();
const setCurrentPackForChild = vi.fn();
vi.mock('@/lib/db/maps', () => ({ listMapsForChild: (...a: unknown[]) => listMapsForChild(...a), setCurrentPackForChild: (...a: unknown[]) => setCurrentPackForChild(...a) }));
import { switchMapAction } from '@/lib/actions/maps';
import { MapLockedError } from '@/lib/errors/maps-errors';

beforeEach(() => vi.clearAllMocks());

describe('switchMapAction gating', () => {
  it('throws MapLockedError for a gated map', async () => {
    listMapsForChild.mockResolvedValue([{ packId: 'p2', isLocked: true, gated: true }]);
    await expect(switchMapAction('c1', 'p2')).rejects.toBeInstanceOf(MapLockedError);
    expect(setCurrentPackForChild).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails / Step 3: Implement**

`switchMapAction` already throws `MapLockedError` when `target.isLocked` — since `isLocked` now includes `gated`, the existing code already rejects gated maps. So this test should pass once `gated` exists on the returned shape. To make the message specific, give `MapLockedError` an optional `reason`:

In `src/lib/errors/maps-errors.ts`, extend the constructor:

```ts
export class MapLockedError extends Error {
  reason: 'no_weeks' | 'gated';
  constructor(reason: 'no_weeks' | 'gated' = 'no_weeks') {
    super(reason === 'gated' ? 'Defeat the previous overlord first' : 'Map has no weeks yet');
    this.name = 'MapLockedError';
    this.reason = reason;
  }
}
```

In `switchMapAction`, replace `throw new MapLockedError();` with:

```ts
  if (target.isLocked) {
    throw new MapLockedError(target.gated ? 'gated' : 'no_weeks');
  }
```

- [ ] **Step 4: Run to verify it passes / Step 5: Commit**

Run: `pnpm vitest run tests/unit/actions/maps-switch-gated.test.ts && pnpm typecheck`

```bash
git add src/lib/actions/maps.ts src/lib/errors/maps-errors.ts tests/unit/actions/maps-switch-gated.test.ts
git commit -m "feat(final-boss): reject switching into a gated map"
```

---

### Task 17: `MapCard` gated state

**Files:**
- Modify: `src/components/play/MapCard.tsx`
- Test: `tests/unit/components/play/MapCard.gated.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/play/MapCard.gated.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapCard } from '@/components/play/MapCard';

const base = { packId: 'p2', slug: 'pirate-class-level-2', nameZh: '印度洋', nameEn: 'Indian Ocean', weekCount: 9, clearedCount: 0, isCurrent: false };

describe('MapCard gated', () => {
  it('shows the overlord-gate hint when gated', () => {
    render(<MapCard childId="c1" map={{ ...base, gated: true, isLocked: true }} />);
    expect(screen.getByText(/先击败上一片海域的霸主|Defeat the previous overlord/)).toBeInTheDocument();
  });
});
```

> Match `MapCard`'s actual prop shape (open the file — it may take individual props, not a `map` object). Adjust the test + render call to the real signature; keep the ASSERTION (gated hint text renders).

- [ ] **Step 2–5:** Implement the gated branch in `MapCard.tsx` (a 🔒 state with the bilingual hint `先击败上一片海域的霸主 / Defeat the previous overlord first` when `gated`), distinct from the existing 0-week locked copy. Run the test, commit:

```bash
git add src/components/play/MapCard.tsx tests/unit/components/play/MapCard.gated.test.tsx
git commit -m "feat(final-boss): gated MapCard state"
```

---

### Task 18: Voyage lair node — layout + board

**Files:**
- Modify: `src/components/play/VoyageBoard.tsx`
- Test: `tests/unit/components/play/VoyageBoard.finalboss.test.tsx`

Decision: `VoyageBoard` gains an optional `finalBoss?: { unlocked: boolean; cleared: boolean }` prop. When present, it lays out `n + 1` nodes (`voyageLayout(n+1)` / `voyageLayoutHorizontal(n+1)`); stops use `pos[0..n-1]`, the lair uses `pos[n]`. The lair renders 🔒/⚔️/👑 and links to `/play/[childId]/final-boss/[packSlug]` when `unlocked`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/play/VoyageBoard.finalboss.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/lib/hooks/use-is-wide', () => ({ useIsWide: () => false }));
vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/lib/play/map-boards', () => ({ getVoyageMap: () => ({ nameZh: '加勒比海', nameEn: 'Caribbean', stops: [{ labelZh: '一', labelEn: 'One', emoji: '🏝️' }], imageUrl: null }) }));
import { VoyageBoard } from '@/components/play/VoyageBoard';

describe('VoyageBoard final-boss lair', () => {
  it('renders a locked lair node when finalBoss.unlocked is false', () => {
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={[{ weekId: 'w1', completionPercent: 100 }]} finalBoss={{ unlocked: false, cleared: false }} />);
    expect(screen.getByTestId('final-boss-node')).toBeInTheDocument();
    expect(screen.getByTestId('final-boss-node')).toHaveAttribute('data-state', 'locked');
  });
  it('links to the final-boss route when unlocked', () => {
    render(<VoyageBoard childId="c1" packSlug="pirate-class-level-1" islands={[{ weekId: 'w1', completionPercent: 100 }]} finalBoss={{ unlocked: true, cleared: false }} />);
    const node = screen.getByTestId('final-boss-node');
    expect(node).toHaveAttribute('data-state', 'ready');
    expect(node.querySelector('a')).toHaveAttribute('href', '/play/c1/final-boss/pirate-class-level-1');
  });
});
```

- [ ] **Step 2–4:** Add the `finalBoss` prop; compute `const slots = finalBoss ? n + 1 : n;` and `pos = wide ? voyageLayoutHorizontal(slots) : voyageLayout(slots);`. After the `{map.stops.map(...)}` block, render a `FinalBossNode` at `pos[n]` (a `data-testid="final-boss-node"` with `data-state` `locked|ready|cleared`; a `<Link href={`/play/${childId}/final-boss/${packSlug}`}>` only when `unlocked`; emoji 🔒/⚔️/👑; bilingual label 终极霸主 / Final Overlord). Run the test.

- [ ] **Step 5: Commit**

```bash
git add src/components/play/VoyageBoard.tsx tests/unit/components/play/VoyageBoard.finalboss.test.tsx
git commit -m "feat(final-boss): voyage board lair node"
```

---

### Task 19: Home page — wire finalBoss state + title chip

**Files:**
- Modify: `src/app/play/[childId]/page.tsx`
- Create: `src/components/play/ChampionTitleChip.tsx`
- Test: `tests/unit/components/play/ChampionTitleChip.test.tsx`

- [ ] **Step 1: Write the failing test (chip)**

```tsx
// tests/unit/components/play/ChampionTitleChip.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChampionTitleChip } from '@/components/play/ChampionTitleChip';

describe('ChampionTitleChip', () => {
  it('renders the bilingual title for the latest beaten map', () => {
    render(<ChampionTitleChip titleZh="加勒比海霸主" titleEn="Lord of the Caribbean" />);
    expect(screen.getByText(/加勒比海霸主/)).toBeInTheDocument();
    expect(screen.getByText(/Lord of the Caribbean/)).toBeInTheDocument();
  });
  it('renders nothing when no title', () => {
    const { container } = render(<ChampionTitleChip titleZh={null} titleEn={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2–3: Implement `ChampionTitleChip.tsx`**

```tsx
interface Props { titleZh: string | null; titleEn: string | null }
export function ChampionTitleChip({ titleZh, titleEn }: Props) {
  if (!titleZh || !titleEn) return null;
  return (
    <span data-testid="champion-title-chip" className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-900 shadow-sm">
      <span aria-hidden>👑</span>
      <span className="font-hanzi">{titleZh}</span>
      <span className="opacity-70">/ {titleEn}</span>
    </span>
  );
}
```

- [ ] **Step 4: Wire the home page** (`src/app/play/[childId]/page.tsx`)

Compute final-boss state for the CURRENT map and the latest champion title:
- Import `isMapFullyCleared`, `getFinalBossClear`, `listFinalBossClears` from `@/lib/db/final-boss`; `CHAMPION_TITLES` from `@/lib/collections/championsData`; `mapOrderIndex` from `@/lib/play/map-order`.
- After `currentMap` is known and the `voyage` branch:
  ```ts
  const finalBossState = currentMap
    ? { unlocked: await isMapFullyCleared(child.id, currentMap.packId), cleared: await getFinalBossClear(child.id, currentMap.packId) }
    : null;
  ```
- Pass `finalBoss={finalBossState}` to `<VoyageBoard>`.
- Latest title: from `listFinalBossClears(child.id)` mapped through the maps list to slugs, pick the highest `mapOrderIndex` whose slug has a `CHAMPION_TITLES` entry; render `<ChampionTitleChip titleZh=… titleEn=… />` next to `LevelBadge` in the header. (If you already loaded the maps list for the header, reuse it; else add a `listMapsForChild` call — it's cheap and already used on `/maps`.)

> Open the home page and place the chip inside the existing header `<div>` that holds `LevelBadge` (around the avatar/`MapHeaderPill` region). Keep it bilingual.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm vitest run tests/unit/components/play/ChampionTitleChip.test.tsx && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/play/[childId]/page.tsx" src/components/play/ChampionTitleChip.tsx tests/unit/components/play/ChampionTitleChip.test.tsx
git commit -m "feat(final-boss): home lair node wiring + champion title chip"
```

---

### Task 20: PR 2 four-green + open PR

- [ ] **Step 1: Run the full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. (No new migration in PR 2.)

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin feat/map-final-boss
gh pr create --title "feat(final-boss): map gating + voyage lair node + champion title" --body "PR 2 of the map final boss: linear map gating (印度洋 locked until 加勒比海's overlord falls), the 👑 lair node on the voyage board, the gated MapCard state, and the champion title chip on home. Post-merge ops (after PR 1's too): seed-champions-pack.ts · seed-trophies.ts · seed-festival-avatar-items.ts · champion card art.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review

**1. Spec coverage:**
- Multi-phase battle (3×6, 3 lives, full restart) → Task 9. ✓
- Runtime-built questions from whole-map pool → Tasks 3 + 11. ✓
- Per-map overlord (Ghost Galleon), generic registry → Task 8. ✓
- Reward bundle: champion card (Task 4), trophy (Task 6), crown cosmetic + title (Tasks 5 + 19), granted idempotently (Tasks 7 + 10). ✓
- `final_boss_clears` single source of truth → Task 1; reward idempotency → Task 10; gating → Task 15. ✓
- Next-map gating + switch guard + MapCard → Tasks 15, 16, 17. ✓
- Lair node on the voyage board → Task 18; unlock = all weeks cleared → Tasks 2 + 19. ✓
- Title chip derived (no equip system) → Tasks 19. ✓
- Anti-cheat (re-verify cleared) → Task 10. ✓
- Distribution-isolation guard → Task 12. ✓

**2. Placeholder scan:** No TBD/TODO. The migration number `0032` is assigned by `db:generate` at Task 1 (the actual filename is whatever drizzle emits — commit the generated file). Mock-chain shapes in Tasks 7/9/11 are explicitly flagged as "adjust to the real chain, keep the assertion," which is honest guidance, not a placeholder for missing code.

**3. Type consistency:** `FinalBossCharacter`/`FinalBossQuestion` defined in Task 3, consumed unchanged in Tasks 9 + 11. `RevealCard` (existing) used in Tasks 7, 10, 11. `MapChampionRewards { card, trophies }` (Task 7) consumed in Task 10. `MAP_TO_CHAMPION_CARD`/`CHAMPION_TITLES` defined Task 4, used Tasks 7 + 19. `MAP_TO_CHAMPION_TROPHY` defined Task 6, used Task 7. `computeMapGating`/`RawMap`/`gated` defined Task 15, used Tasks 16 (`target.gated`) + 17 + (home) 19. `getFinalBoss` defined Task 8, used Task 9. `finalBossClears` table (Task 1) used in Tasks 2, 7-impl, 10. `finishFinalBossAction` input `{childId, packSlug}` consistent across Tasks 10, 11, 12.

**Post-merge ops (run after BOTH PRs deploy, in order):** `pnpm tsx scripts/seed-champions-pack.ts` · `pnpm tsx scripts/seed-trophies.ts` · `pnpm tsx scripts/seed-festival-avatar-items.ts` · champion-card CF-flux art (add `champions-v1` + a Ghost-Galleon-crown subject to `generate-collectible-art-cloudflare.ts`, non-FORCE, ~1 image).
