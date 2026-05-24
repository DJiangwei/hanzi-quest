# PR #35 — Week Hub Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split each week's play flow into 3 separately-enterable sections (回顾 / 练习 / Boss战) accessed via a new hub page, remove pinyin practice, boost practice to ~12 scenes per 10-char week, and add stable upsert keys to `week_levels` so future recompiles preserve attempt history.

**Architecture:** New routes — `/play/[childId]/week/[weekId]` (hub) + `/play/[childId]/level/[weekId]/[section]` (section runner). Section ∈ `review | practice | boss`, derived in code from existing `sceneConfig.segment`. `weekLevels.level_key` text column (migration 0011) holds deterministic keys; `compileWeekIntoLevels` upserts by `(week_id, level_key)` instead of delete-then-insert. Boss gated until ≥ 6 / 12 practice scenes cleared.

**Tech Stack:** Next.js 16 App Router (server components for hub + section page), Drizzle (append-only migrations), React 19, Vitest + RTL, Tailwind. All tests mock `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`.

**Spec:** `docs/superpowers/specs/2026-05-24-pr35-week-hub-restructure-design.md`

**Branch:** `feat/pr35-week-hub-restructure` (already created, spec committed `d655c83`).

---

## File map

**New files:**
- `src/app/play/[childId]/week/[weekId]/page.tsx` — hub server page
- `src/components/play/WeekHub.tsx` — server component, 3 SectionCards
- `src/components/play/SectionCard.tsx` — primitive (4 states: idle / in-progress / cleared / locked)
- `src/app/play/[childId]/level/[weekId]/[section]/page.tsx` — section runner server page
- `scripts/disable-pinyin-pick.ts` — one-off ops script
- `drizzle/0011_<name>.sql` — Drizzle-generated migration (level_key column + constraint)
- Tests: `tests/unit/compile-week-pr35-structure.test.ts`, `tests/unit/compile-week-stable-keys.test.ts`, `tests/unit/week-hub-stats.test.ts`, `tests/unit/week-hub.test.tsx`, `tests/unit/section-route-guard.test.ts`, `tests/unit/scene-runner-exit-target.test.tsx`

**Modified files:**
- `src/db/schema/game.ts` — add `levelKey` text column on `weekLevels`
- `src/lib/scenes/compile-week.ts` — full rewrite (new structure, stable keys, pinyin removal)
- `src/lib/scenes/configs.ts` — add `BOSS_UNLOCK_PRACTICE_THRESHOLD = 6` export
- `src/lib/db/play.ts` — add `getSectionStatsForChild`, `countPracticeClearedForChild`, `getLevelsForSection`
- `src/app/play/[childId]/level/[weekId]/page.tsx` — body becomes a `redirect()` call
- `src/components/play/IslandMap.tsx` — link target switches from `/level/[weekId]` to `/week/[weekId]`
- `src/components/scenes/SceneRunner.tsx` — exit navigation target switches to the new hub URL

---

## Task 1: Schema — `level_key` column + unique constraint

**Files:**
- Modify: `src/db/schema/game.ts` (add `levelKey` column to weekLevels)
- Generate: `drizzle/0011_<name>.sql`

The migration needs three logical steps that Drizzle's `db:generate` won't produce out-of-the-box because the column starts NOT NULL on existing rows. We'll add the column nullable, backfill, then add the unique constraint + NOT NULL — handwriting the SQL after generation.

- [ ] **Step 1: Add the column to the schema (nullable to start)**

In `src/db/schema/game.ts`, in the `weekLevels` table definition, append `levelKey`:

```ts
export const weekLevels = pgTable(
  'week_levels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    sceneTemplateId: uuid('scene_template_id')
      .notNull()
      .references(() => sceneTemplates.id, { onDelete: 'restrict' }),
    sceneConfig: jsonb('scene_config').notNull().default({}),
    unlockedAfterPosition: smallint('unlocked_after_position'),
    levelKey: text('level_key').notNull(),   // NEW
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('week_levels_week_idx').on(t.weekId),
    index('week_levels_week_position_idx').on(t.weekId, t.position),
    uniqueIndex('week_levels_week_level_key_unique').on(t.weekId, t.levelKey),  // NEW
  ],
);
```

(Add `uniqueIndex` to the existing `import { ... } from 'drizzle-orm/pg-core'` if not present.)

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`

A new file `drizzle/0011_<name>.sql` is created. It will contain (roughly):
```sql
ALTER TABLE "week_levels" ADD COLUMN "level_key" text NOT NULL;
CREATE UNIQUE INDEX "week_levels_week_level_key_unique" ON "week_levels" USING btree ("week_id","level_key");
```

This migration will **fail on existing data** because the `NOT NULL` add can't backfill. We'll handwrite the SQL.

- [ ] **Step 3: Handwrite the migration SQL**

Open `drizzle/0011_<name>.sql` and replace the body with:

```sql
ALTER TABLE "week_levels" ADD COLUMN "level_key" text;--> statement-breakpoint
UPDATE "week_levels" SET "level_key" = "week_id"::text || ':' || "position"::text WHERE "level_key" IS NULL;--> statement-breakpoint
ALTER TABLE "week_levels" ALTER COLUMN "level_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "week_levels_week_level_key_unique" ON "week_levels" USING btree ("week_id","level_key");
```

The Drizzle metadata snapshot in `drizzle/meta/0011_snapshot.json` is unchanged by hand-editing the SQL — that's fine, drizzle tracks the schema state from `src/db/schema/*.ts`, not from the SQL.

- [ ] **Step 4: Apply locally**

Run: `pnpm tsx scripts/migrate.ts`

Expected: "Schema migrations applied". No errors. (Confirm via `psql` if curious that `level_key` exists and is NOT NULL.)

- [ ] **Step 5: Verify typecheck**

Run: `pnpm typecheck`

Expected: PASS. The new `levelKey` field on `$inferSelect` flows through to any code that does `.select().from(weekLevels)`.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/game.ts drizzle/0011_*.sql drizzle/meta/
git commit -m "feat(week-hub): week_levels.level_key column + unique (week_id, level_key)"
```

---

## Task 2: Compile rewrite — new structure + stable keys + pinyin removal

**Files:**
- Modify: `src/lib/scenes/compile-week.ts`
- Modify: `src/lib/scenes/configs.ts` (add threshold constant)
- Test: `tests/unit/compile-week-pr35-structure.test.ts`
- Test: `tests/unit/compile-week-stable-keys.test.ts`

This is the largest single task in the PR. It rewrites compile-week.ts end-to-end.

- [ ] **Step 1: Add the threshold constant**

In `src/lib/scenes/configs.ts`, append at the end of the file:

```ts
// Boss is gated behind partial practice completion. Tune by editing this
// constant; the WeekHub UI and the boss route guard both read it.
export const BOSS_UNLOCK_PRACTICE_THRESHOLD = 6;

// Total practice scenes per week for full-size (N ≥ 10 chars) weeks.
// Smaller-N weeks scale down per compile-week.ts.
export const PRACTICE_SCENE_COUNT = 12;
```

- [ ] **Step 2: Write the structure test (failing)**

Create `tests/unit/compile-week-pr35-structure.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
  })),
}));

const charsMock = vi.hoisted(() => ({
  getCharactersWithDetailsForWeek: vi.fn(),
}));

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@/lib/db/characters', () => ({
  getCharactersWithDetailsForWeek: charsMock.getCharactersWithDetailsForWeek,
}));

import { compileWeekIntoLevels } from '@/lib/scenes/compile-week';

function makeChar(i: number, overrides: Partial<{ imageHook: string; words: unknown[]; sentence: { id: string }; meaningEn: string }> = {}) {
  return {
    id: `c${i}`,
    hanzi: `字${i}`,
    pinyinArray: [`zì${i}`],
    meaningEn: overrides.meaningEn ?? `meaning-${i}`,
    imageHook: overrides.imageHook ?? null,
    words: overrides.words ?? [{ id: `w${i}`, text: `字${i}组词`, meaningEn: 'word' }],
    sentence: overrides.sentence ?? { id: `s${i}`, text: '一个例子' },
  };
}

beforeEach(() => {
  dbMock.select.mockReset();
  charsMock.getCharactersWithDetailsForWeek.mockReset();

  // Stub: list templates → return all known types with predictable ids
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([
        { id: 't-flashcard', type: 'flashcard' },
        { id: 't-audio_pick', type: 'audio_pick' },
        { id: 't-visual_pick', type: 'visual_pick' },
        { id: 't-image_pick', type: 'image_pick' },
        { id: 't-word_match', type: 'word_match' },
        { id: 't-translate_pick', type: 'translate_pick' },
        { id: 't-sentence_cloze', type: 'sentence_cloze' },
        { id: 't-boss', type: 'boss' },
        // note: no pinyin_pick template returned (simulating is_active=false)
      ]),
    }),
  });
});

describe('compileWeekIntoLevels — PR #35 structure', () => {
  it('10-char week produces 10 review + 12 practice + 1 boss = 23 levels', async () => {
    const chars = Array.from({ length: 10 }, (_, i) => makeChar(i + 1, { imageHook: 'an image' }));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: Array<{ sceneConfig: { segment: string }; sceneTemplateId: string; levelKey: string }> = [];
    dbMock.transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      await fn({
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((rows: typeof inserted) => {
            inserted.push(...rows);
            return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
          }),
        }),
      });
    });

    const count = await compileWeekIntoLevels('w-test');

    expect(count).toBe(23);
    const bySegment = inserted.reduce<Record<string, number>>((acc, r) => {
      acc[r.sceneConfig.segment] = (acc[r.sceneConfig.segment] ?? 0) + 1;
      return acc;
    }, {});
    expect(bySegment.review).toBe(10);
    expect(bySegment.sound + bySegment.sight + bySegment.meaning).toBe(12);
    expect(bySegment.boss).toBe(1);
  });

  it('omits boss when char count < 10', async () => {
    const chars = Array.from({ length: 5 }, (_, i) => makeChar(i + 1, { imageHook: 'x' }));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);
    const inserted: Array<{ sceneConfig: { segment: string } }> = [];
    dbMock.transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      await fn({
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((rows: typeof inserted) => {
            inserted.push(...rows);
            return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
          }),
        }),
      });
    });
    await compileWeekIntoLevels('w-test');
    const bossCount = inserted.filter((r) => r.sceneConfig.segment === 'boss').length;
    expect(bossCount).toBe(0);
  });

  it('no level uses pinyin_pick template', async () => {
    const chars = Array.from({ length: 10 }, (_, i) => makeChar(i + 1, { imageHook: 'x' }));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);
    const inserted: Array<{ sceneTemplateId: string }> = [];
    dbMock.transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      await fn({
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((rows: typeof inserted) => {
            inserted.push(...rows);
            return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
          }),
        }),
      });
    });
    await compileWeekIntoLevels('w-test');
    expect(inserted.every((r) => r.sceneTemplateId !== 't-pinyin_pick')).toBe(true);
  });

  it('boss question types are exactly 5, none pinyin_pick', async () => {
    const chars = Array.from({ length: 10 }, (_, i) => makeChar(i + 1, { imageHook: 'x' }));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);
    let bossConfig: { questionTypes: string[] } | undefined;
    dbMock.transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      await fn({
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((rows: Array<{ sceneConfig: { segment: string; questionTypes?: string[] } }>) => {
            const b = rows.find((r) => r.sceneConfig.segment === 'boss');
            if (b) bossConfig = b.sceneConfig as { questionTypes: string[] };
            return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
          }),
        }),
      });
    });
    await compileWeekIntoLevels('w-test');
    expect(bossConfig?.questionTypes).toHaveLength(5);
    expect(bossConfig?.questionTypes).not.toContain('pinyin_pick');
  });
});
```

- [ ] **Step 3: Run the structure test → FAIL**

Run: `pnpm test tests/unit/compile-week-pr35-structure.test.ts`

Expected: FAIL. Today's compile produces 17 levels (not 23), uses pinyin_pick, and has 6 boss question types.

- [ ] **Step 4: Write the stable-keys test (failing)**

Create `tests/unit/compile-week-stable-keys.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
}));
const charsMock = vi.hoisted(() => ({
  getCharactersWithDetailsForWeek: vi.fn(),
}));

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@/lib/db/characters', () => ({
  getCharactersWithDetailsForWeek: charsMock.getCharactersWithDetailsForWeek,
}));

import { compileWeekIntoLevels } from '@/lib/scenes/compile-week';

function setup() {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([
        { id: 't-flashcard', type: 'flashcard' },
        { id: 't-audio_pick', type: 'audio_pick' },
        { id: 't-visual_pick', type: 'visual_pick' },
        { id: 't-image_pick', type: 'image_pick' },
        { id: 't-word_match', type: 'word_match' },
        { id: 't-translate_pick', type: 'translate_pick' },
        { id: 't-sentence_cloze', type: 'sentence_cloze' },
        { id: 't-boss', type: 'boss' },
      ]),
    }),
  });
}

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.transaction.mockReset();
  charsMock.getCharactersWithDetailsForWeek.mockReset();
  setup();
});

describe('compileWeekIntoLevels — stable keys', () => {
  it('uses onConflictDoUpdate (upsert, not delete-then-insert) — and the level_key per row is deterministic', async () => {
    const chars = Array.from({ length: 3 }, (_, i) => ({
      id: `c${i + 1}`, hanzi: `字${i + 1}`, pinyinArray: ['x'],
      meaningEn: 'm', imageHook: 'x', words: [{ id: `w${i}`, text: 'w', meaningEn: 'w' }],
      sentence: { id: `s${i}`, text: 's' },
    }));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: Array<{ levelKey: string }> = [];
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    dbMock.transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      await fn({
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((rows: typeof inserted) => {
            inserted.push(...rows);
            return { onConflictDoUpdate };
          }),
        }),
      });
    });
    await compileWeekIntoLevels('w-test');

    // upsert path was taken
    expect(onConflictDoUpdate).toHaveBeenCalled();

    // Review keys are deterministic per character
    expect(inserted.some((r) => r.levelKey === 'review:flashcard:c1')).toBe(true);
    expect(inserted.some((r) => r.levelKey === 'review:flashcard:c2')).toBe(true);
    expect(inserted.some((r) => r.levelKey === 'review:flashcard:c3')).toBe(true);

    // Slot-based keys exist for practice scenes (we don't assert which char index — slots are stable, chars rotate)
    const slotKeyRegex = /^practice:(audio_pick|visual_pick|image_pick|word_match|translate_pick|sentence_cloze):\d+$/;
    const slotKeys = inserted.filter((r) => r.levelKey.startsWith('practice:'));
    expect(slotKeys.length).toBeGreaterThan(0);
    expect(slotKeys.every((r) => slotKeyRegex.test(r.levelKey))).toBe(true);

    // All keys distinct within a single compile
    const keys = inserted.map((r) => r.levelKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 5: Run stable-keys test → FAIL**

Run: `pnpm test tests/unit/compile-week-stable-keys.test.ts`

Expected: FAIL. Current code doesn't set `levelKey` and uses delete-then-insert (no onConflictDoUpdate).

- [ ] **Step 6: Rewrite compile-week.ts**

Replace `src/lib/scenes/compile-week.ts` entirely with:

```ts
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { sceneTemplates, weekLevels } from '@/db/schema';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import type {
  AudioPickConfig,
  BossConfig,
  FlashcardConfig,
  ImagePickConfig,
  Segment,
  SentenceClozeConfig,
  TranslatePickConfig,
  VisualPickConfig,
  WordMatchConfig,
} from './configs';
import { PRACTICE_SCENE_COUNT } from './configs';
import { shuffle } from './sample';

type AnyConfig =
  | FlashcardConfig
  | AudioPickConfig
  | VisualPickConfig
  | ImagePickConfig
  | WordMatchConfig
  | TranslatePickConfig
  | SentenceClozeConfig
  | BossConfig;

/**
 * Translate a published week's characters into `week_levels` rows.
 *
 * PR #35 shape:
 *   review:   N × flashcard           (one per character)
 *   sound:    K × audio_pick          (3 for full weeks, scaled down for smaller)
 *   sight:    1 × image_pick (or visual_pick fallback) + 1 × visual_pick (different char) + 1 × word_match
 *   meaning:  M × translate_pick + M × sentence_cloze   (alternating direction; cloze->translate fallback per char)
 *   boss:     1 × boss (only if N ≥ 10), 5 rotating question types (no pinyin_pick)
 *
 * Levels are upserted by (weekId, levelKey). Stable keys preserve
 * sceneAttempts.weekLevelId across recompiles. Keys whose row no longer
 * exists in the new compile are deleted at end-of-tx.
 *
 * pinyin_pick is intentionally absent — see spec PR #35 §3.3.
 */
export async function compileWeekIntoLevels(weekId: string): Promise<number> {
  const chars = await getCharactersWithDetailsForWeek(weekId);
  if (chars.length === 0) {
    throw new Error(`Week ${weekId} has no characters to compile`);
  }

  const templates = await db
    .select({ id: sceneTemplates.id, type: sceneTemplates.type })
    .from(sceneTemplates)
    .where(eq(sceneTemplates.isActive, true));
  const tmplByType = new Map(templates.map((t) => [t.type, t.id]));
  const flashcardId = tmplByType.get('flashcard');
  if (!flashcardId) {
    throw new Error('No active flashcard scene_template — run the seed migration');
  }

  type Row = {
    weekId: string;
    position: number;
    sceneTemplateId: string;
    sceneConfig: Record<string, unknown>;
    unlockedAfterPosition: number | null;
    levelKey: string;
  };
  const rows: Row[] = [];

  let position = 0;
  const push = (
    templateId: string,
    config: AnyConfig,
    segment: Segment,
    levelKey: string,
  ) => {
    rows.push({
      weekId,
      position: position++,
      sceneTemplateId: templateId,
      sceneConfig: { ...(config as Record<string, unknown>), segment },
      unlockedAfterPosition: null,
      levelKey,
    });
  };

  // ── REVIEW ──────────────────────────────────────────────────────────────
  for (const c of chars) {
    push(
      flashcardId,
      { characterId: c.id, hanzi: c.hanzi },
      'review',
      `review:flashcard:${c.id}`,
    );
  }

  // Practice quantity targets, scaled with char count.
  // Full size (PRACTICE_SCENE_COUNT = 12) at N ≥ 10.
  const N = chars.length;
  const sizing = computePracticeSizing(N);

  // ── SOUND (audio_pick × sizing.audio) ──────────────────────────────────
  if (sizing.audio > 0) {
    const audioId = tmplByType.get('audio_pick');
    if (audioId) {
      const audioChars = sampleN(chars, sizing.audio);
      audioChars.forEach((c, i) => {
        push(
          audioId,
          { characterId: c.id },
          'sound',
          `practice:audio_pick:${i}`,
        );
      });
    }
  }

  // ── SIGHT (image_pick + visual_pick + word_match) ──────────────────────
  if (sizing.sight > 0) {
    const imageId = tmplByType.get('image_pick');
    const visualId = tmplByType.get('visual_pick');
    const wordId = tmplByType.get('word_match');

    let sightSlot = 0;
    let usedCharIds = new Set<string>();

    // 1) image_pick if any char has imageHook
    const withHook = chars.filter((c) => Boolean(c.imageHook));
    if (sizing.sight >= 1 && imageId && withHook.length > 0) {
      const target = pickRandom(withHook);
      usedCharIds.add(target.id);
      push(
        imageId,
        { characterId: target.id },
        'sight',
        `practice:image_pick:${sightSlot++}`,
      );
    }

    // 2) visual_pick (different char from the image_pick)
    if (sizing.sight >= 2 && visualId) {
      const remaining = chars.filter((c) => !usedCharIds.has(c.id));
      if (remaining.length > 0) {
        const target = pickRandom(remaining);
        usedCharIds.add(target.id);
        push(
          visualId,
          { characterId: target.id },
          'sight',
          `practice:visual_pick:${sightSlot++ - 1}`, // visual slot index (0)
        );
      }
    }

    // 3) word_match — if ≥ 2 chars have words
    if (sizing.sight >= 3 && wordId) {
      const withWords = chars.filter((c) => c.words.length > 0);
      const sample = shuffle(withWords).slice(0, Math.min(4, withWords.length));
      if (sample.length >= 2) {
        push(
          wordId,
          { characterIds: sample.map((c) => c.id) },
          'sight',
          `practice:word_match:0`,
        );
      } else if (visualId) {
        // Fallback: another visual_pick
        const remaining = chars.filter((c) => !usedCharIds.has(c.id));
        const target = remaining.length > 0 ? pickRandom(remaining) : pickRandom(chars);
        push(
          visualId,
          { characterId: target.id },
          'sight',
          `practice:visual_pick:1`,
        );
      }
    }
  }

  // ── MEANING (translate_pick × M + sentence_cloze × M) ──────────────────
  if (sizing.meaning > 0) {
    const translateId = tmplByType.get('translate_pick');
    const clozeId = tmplByType.get('sentence_cloze');
    const withMeaning = chars.filter((c) => Boolean(c.meaningEn));
    const withSentence = chars.filter((c) => c.sentence !== null);

    const translateTarget = Math.ceil(sizing.meaning / 2);
    const clozeTarget = sizing.meaning - translateTarget;

    // translate_pick slots
    if (translateId) {
      for (let i = 0; i < translateTarget; i++) {
        const target = withMeaning[i % withMeaning.length] ?? null;
        if (!target) break;
        push(
          translateId,
          {
            characterId: target.id,
            direction: i % 2 === 0 ? 'cn_to_en' : 'en_to_cn',
          },
          'meaning',
          `practice:translate_pick:${i}`,
        );
      }
    }

    // sentence_cloze slots, with translate fallback if not enough sentences
    let clozeFilled = 0;
    if (clozeId && withSentence.length > 0) {
      const sentenceChars = shuffle(withSentence);
      for (let i = 0; i < clozeTarget && i < sentenceChars.length; i++) {
        const target = sentenceChars[i];
        push(
          clozeId,
          { characterId: target.id, sentenceId: target.sentence!.id },
          'meaning',
          `practice:sentence_cloze:${i}`,
        );
        clozeFilled++;
      }
    }
    // If we couldn't fill all cloze slots, top up with extra translate_pick
    if (clozeFilled < clozeTarget && translateId) {
      for (let i = clozeFilled; i < clozeTarget; i++) {
        const target = withMeaning[(translateTarget + i) % withMeaning.length] ?? null;
        if (!target) break;
        push(
          translateId,
          {
            characterId: target.id,
            direction: i % 2 === 0 ? 'en_to_cn' : 'cn_to_en',
          },
          'meaning',
          `practice:translate_pick:${translateTarget + i}`,
        );
      }
    }
  }

  // ── BOSS ────────────────────────────────────────────────────────────────
  const bossId = tmplByType.get('boss');
  if (bossId && N >= 10) {
    const shuffled = shuffle(chars).slice(0, 10);
    push(
      bossId,
      {
        characterIds: shuffled.map((c) => c.id),
        questionTypes: [
          'audio_pick',
          'visual_pick',
          'image_pick',
          'translate_pick',
          'sentence_cloze',
        ],
      },
      'boss',
      'boss:boss:0',
    );
  }

  // ── UPSERT + PRUNE ─────────────────────────────────────────────────────
  await db.transaction(async (tx) => {
    const keys = rows.map((r) => r.levelKey);
    if (rows.length > 0) {
      await tx
        .insert(weekLevels)
        .values(rows)
        .onConflictDoUpdate({
          target: [weekLevels.weekId, weekLevels.levelKey],
          set: {
            position: sql`excluded.position`,
            sceneTemplateId: sql`excluded.scene_template_id`,
            sceneConfig: sql`excluded.scene_config`,
            unlockedAfterPosition: sql`excluded.unlocked_after_position`,
          },
        });
    }
    // Delete levels whose key isn't in the new compile
    if (keys.length > 0) {
      await tx
        .delete(weekLevels)
        .where(
          and(eq(weekLevels.weekId, weekId), notInArray(weekLevels.levelKey, keys)),
        );
    } else {
      await tx.delete(weekLevels).where(eq(weekLevels.weekId, weekId));
    }
  });

  return rows.length;
}

interface PracticeSizing {
  audio: number;
  sight: number;
  meaning: number;
}

function computePracticeSizing(n: number): PracticeSizing {
  if (n < 2) return { audio: 0, sight: 0, meaning: 0 };
  if (n < 4) return { audio: 1, sight: 1, meaning: 4 };
  if (n < 10) return { audio: 2, sight: 2, meaning: 6 };
  return { audio: 3, sight: 3, meaning: 6 }; // sums to PRACTICE_SCENE_COUNT = 12
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleN<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return shuffle(arr);
  return shuffle(arr).slice(0, n);
}
```

(Note: `inArray` import isn't needed — only `notInArray`. Keep imports tidy.)

- [ ] **Step 7: Run both compile tests → PASS**

Run: `pnpm test tests/unit/compile-week`

Expected: PASS for both new tests. Note: some pre-existing compile tests may break because:
- The old `compile-week.test.ts` expected 17 levels for a 10-char week; it should be updated to 23, OR the old tests should be retired since they encode the PR #30 behavior we're replacing.
- The old test file is likely `tests/unit/compile-week.test.ts` and `tests/unit/compile-week-segments.test.ts` per `ls tests/unit/`.

For each existing compile-week test that fails because it asserts the old 17-level / pinyin-included shape, **update the assertions** to match the new shape OR mark it `it.skip` with a comment `// PR #30 shape, superseded by PR #35` and move it into a `.archive` subfolder. Prefer updating over skipping; archive only if the update is non-trivial.

- [ ] **Step 8: Run full test suite**

Run: `pnpm test`

Expected: all PASS. If any non-compile test fails (e.g. one that constructs a `weekLevels` row literal and now needs `levelKey`), update the test fixture.

- [ ] **Step 9: Lint + typecheck**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/scenes/compile-week.ts src/lib/scenes/configs.ts tests/unit/compile-week-pr35-structure.test.ts tests/unit/compile-week-stable-keys.test.ts tests/unit/compile-week*.test.ts
git commit -m "$(cat <<'EOF'
feat(compile): PR #35 — new structure + stable keys + pinyin removal

Practice quantity grows ~2× (5 → 12 scenes/full week): 3 audio_pick +
3 sight (image+visual+word_match) + 6 meaning (3 translate + 3 cloze).
pinyin_pick removed from compile entirely; boss question rotation
narrows from 6 → 5 types.

Stable upsert keys per level (review:flashcard:<charId>,
practice:<type>:<slot>, boss:boss:0) replace delete-then-insert. Future
recompiles preserve scene_attempts.week_level_id linkage.

PRACTICE_SCENE_COUNT + BOSS_UNLOCK_PRACTICE_THRESHOLD constants exposed
from configs.ts for tuning.
EOF
)"
```

---

## Task 3: DB query helpers — section stats + practice-cleared count

**Files:**
- Modify: `src/lib/db/play.ts` — add 3 functions
- Test: `tests/unit/week-hub-stats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/week-hub-stats.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock('@/db', () => ({ db: dbMock }));

import {
  getSectionStatsForChild,
  countPracticeClearedForChild,
} from '@/lib/db/play';

function makeQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      leftJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
        where: vi.fn().mockResolvedValue(rows),
      }),
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
        where: vi.fn().mockResolvedValue(rows),
      }),
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

beforeEach(() => { dbMock.select.mockReset(); });

describe('getSectionStatsForChild', () => {
  it('groups levels by section (derived from segment) and counts cleared (score ≥ 100)', async () => {
    // Stub: list of {levelId, segment, maxScore?} per level for this week+child.
    // The implementation should derive section from segment and count cleared.
    const rows = [
      { id: 'l1', segment: 'review', maxScore: 100 },
      { id: 'l2', segment: 'review', maxScore: 80 },     // not cleared
      { id: 'l3', segment: 'sound', maxScore: 100 },
      { id: 'l4', segment: 'sight', maxScore: null },    // never attempted
      { id: 'l5', segment: 'meaning', maxScore: 100 },
      { id: 'l6', segment: 'boss', maxScore: null },
    ];
    dbMock.select.mockReturnValueOnce(makeQuery(rows));

    const stats = await getSectionStatsForChild('c1', 'w1');
    expect(stats.review).toEqual({ done: 1, total: 2 });
    expect(stats.practice).toEqual({ done: 2, total: 3 }); // sound + sight + meaning
    expect(stats.boss).toEqual({ done: 0, total: 1 });
  });
});

describe('countPracticeClearedForChild', () => {
  it('returns count of distinct practice levels with at least one cleared attempt', async () => {
    const rows = [{ count: 5 }];
    dbMock.select.mockReturnValueOnce(makeQuery(rows));
    const count = await countPracticeClearedForChild('c1', 'w1');
    expect(count).toBe(5);
  });
});
```

- [ ] **Step 2: Add the helpers**

In `src/lib/db/play.ts`, append (preserve existing exports):

```ts
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { playSessions, sceneAttempts, weekLevels } from '@/db/schema';

export type WeekSection = 'review' | 'practice' | 'boss';

export interface SectionStat { done: number; total: number }
export interface SectionStats {
  review: SectionStat;
  practice: SectionStat;
  boss: SectionStat;
}

function segmentToSection(segment: string | undefined): WeekSection | null {
  if (segment === 'review') return 'review';
  if (segment === 'sound' || segment === 'sight' || segment === 'meaning') return 'practice';
  if (segment === 'boss') return 'boss';
  return null;
}

export async function getSectionStatsForChild(
  childId: string,
  weekId: string,
): Promise<SectionStats> {
  // One query: per level, max(score) by this child. NULL if never attempted.
  const rows = await db
    .select({
      id: weekLevels.id,
      segment: sql<string>`${weekLevels.sceneConfig}->>'segment'`.as('segment'),
      maxScore: sql<number | null>`MAX(${sceneAttempts.score})`.as('max_score'),
    })
    .from(weekLevels)
    .leftJoin(
      sceneAttempts,
      eq(sceneAttempts.weekLevelId, weekLevels.id),
    )
    .leftJoin(
      playSessions,
      and(
        eq(playSessions.id, sceneAttempts.sessionId),
        eq(playSessions.childId, childId),
      ),
    )
    .where(eq(weekLevels.weekId, weekId))
    .groupBy(weekLevels.id, sql`${weekLevels.sceneConfig}->>'segment'`);

  const stats: SectionStats = {
    review:   { done: 0, total: 0 },
    practice: { done: 0, total: 0 },
    boss:     { done: 0, total: 0 },
  };
  for (const row of rows) {
    const sec = segmentToSection(row.segment);
    if (!sec) continue;
    stats[sec].total += 1;
    if ((row.maxScore ?? 0) >= 100) stats[sec].done += 1;
  }
  return stats;
}

export async function countPracticeClearedForChild(
  childId: string,
  weekId: string,
): Promise<number> {
  const stats = await getSectionStatsForChild(childId, weekId);
  return stats.practice.done;
}

export async function getLevelsForSection(
  weekId: string,
  section: WeekSection,
): Promise<Array<typeof weekLevels.$inferSelect>> {
  const allowedSegments: string[] =
    section === 'review' ? ['review'] :
    section === 'boss'   ? ['boss']   :
                           ['sound', 'sight', 'meaning'];
  const rows = await db
    .select()
    .from(weekLevels)
    .where(
      and(
        eq(weekLevels.weekId, weekId),
        sql`${weekLevels.sceneConfig}->>'segment' = ANY(ARRAY[${sql.join(allowedSegments.map((s) => sql`${s}`), sql`, `)}]::text[])`,
      ),
    )
    .orderBy(weekLevels.position);
  return rows;
}
```

(The SQL `ANY(ARRAY[...]::text[])` form sidesteps a drizzle limitation when matching string-typed JSON values against a multi-value `IN`. If your test fixture for `getLevelsForSection` exists later, we'll keep it simple — the alternative is filtering in JS after a single `weekId` query, which is fine for 23-row weeks.)

- [ ] **Step 3: Run the test → PASS**

Run: `pnpm test tests/unit/week-hub-stats.test.ts`

Expected: PASS.

- [ ] **Step 4: Typecheck + lint + full tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/play.ts tests/unit/week-hub-stats.test.ts
git commit -m "feat(week-hub): DB helpers — getSectionStatsForChild, getLevelsForSection"
```

---

## Task 4: WeekHub UI — SectionCard + WeekHub + hub page

**Files:**
- Create: `src/components/play/SectionCard.tsx`
- Create: `src/components/play/WeekHub.tsx`
- Create: `src/app/play/[childId]/week/[weekId]/page.tsx`
- Test: `tests/unit/week-hub.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/week-hub.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekHub } from '@/components/play/WeekHub';

const baseProps = {
  childId: 'c1',
  week: { id: 'w1', weekNumber: 5, label: '装备齐 准备出航' },
};

describe('WeekHub', () => {
  it('renders 3 section cards', () => {
    render(
      <WeekHub
        {...baseProps}
        sections={{
          review:   { done: 0,  total: 10 },
          practice: { done: 0,  total: 12 },
          boss:     { done: 0,  total: 1, locked: true },
        }}
      />,
    );
    expect(screen.getByText(/回顾/)).toBeInTheDocument();
    expect(screen.getByText(/练习/)).toBeInTheDocument();
    expect(screen.getByText(/Boss/)).toBeInTheDocument();
  });

  it('boss card is locked when practice done < threshold', () => {
    render(
      <WeekHub
        {...baseProps}
        sections={{
          review:   { done: 10, total: 10 },
          practice: { done: 3,  total: 12 },
          boss:     { done: 0,  total: 1, locked: true },
        }}
      />,
    );
    expect(screen.getByText(/未解锁|Locked|解锁/)).toBeInTheDocument();
  });

  it('boss card is unlocked when locked=false', () => {
    render(
      <WeekHub
        {...baseProps}
        sections={{
          review:   { done: 10, total: 10 },
          practice: { done: 6,  total: 12 },
          boss:     { done: 0,  total: 1, locked: false },
        }}
      />,
    );
    const bossLink = screen.getByRole('link', { name: /Boss/ });
    expect(bossLink).toHaveAttribute('href', expect.stringMatching(/\/level\/w1\/boss$/));
  });

  it('cleared sections show ✨ chip', () => {
    render(
      <WeekHub
        {...baseProps}
        sections={{
          review:   { done: 10, total: 10 },
          practice: { done: 12, total: 12 },
          boss:     { done: 0,  total: 1, locked: false },
        }}
      />,
    );
    expect(screen.getAllByText(/✨/).length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test → FAIL**

Run: `pnpm test tests/unit/week-hub.test.tsx`

Expected: FAIL (module not found).

- [ ] **Step 3: Create SectionCard primitive**

Create `src/components/play/SectionCard.tsx`:

```tsx
import Link from 'next/link';

interface Props {
  href: string;
  emoji: string;
  titleZh: string;
  titleEn: string;
  progressText: string;
  state: 'idle' | 'in-progress' | 'cleared' | 'locked';
  lockedReason?: string;
}

const STATE_STYLES: Record<Props['state'], string> = {
  idle:         'border-amber-800/40 bg-amber-50 text-amber-900 hover:bg-amber-100',
  'in-progress':'border-amber-800/60 bg-amber-100 text-amber-950 hover:bg-amber-200',
  cleared:      'border-[var(--color-treasure-700)] bg-[var(--color-treasure-400)] text-[var(--color-treasure-700)] hover:bg-[var(--color-treasure-500)]',
  locked:       'border-gray-400 bg-gray-100 text-gray-500 cursor-not-allowed',
};

const CHIP: Record<Props['state'], string | null> = {
  idle: null,
  'in-progress': '🔥',
  cleared: '✨',
  locked: '🔒',
};

export function SectionCard({ href, emoji, titleZh, titleEn, progressText, state, lockedReason }: Props) {
  const chip = CHIP[state];
  const inner = (
    <div
      className={[
        'flex w-full items-center gap-4 rounded-2xl border-4 p-5 shadow-md transition',
        STATE_STYLES[state],
      ].join(' ')}
    >
      <div className="text-5xl" aria-hidden>{emoji}</div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="text-xl font-extrabold">{titleZh}</div>
        <div className="text-xs font-semibold opacity-80">{titleEn}</div>
        <div className="mt-1 text-sm font-bold">
          {progressText}
          {chip ? <span className="ml-1.5">{chip}</span> : null}
        </div>
        {state === 'locked' && lockedReason ? (
          <div className="text-xs">{lockedReason}</div>
        ) : null}
      </div>
    </div>
  );

  if (state === 'locked') {
    return <div aria-disabled className="block">{inner}</div>;
  }
  return (
    <Link href={href} className="block focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-sunset-400)] rounded-2xl">
      {inner}
    </Link>
  );
}
```

- [ ] **Step 4: Create WeekHub**

Create `src/components/play/WeekHub.tsx`:

```tsx
import Link from 'next/link';
import { SectionCard } from './SectionCard';
import { BOSS_UNLOCK_PRACTICE_THRESHOLD } from '@/lib/scenes/configs';

interface Stat { done: number; total: number }
interface BossStat extends Stat { locked: boolean }

interface Props {
  childId: string;
  week: { id: string; weekNumber: number; label: string };
  sections: {
    review: Stat;
    practice: Stat;
    boss: BossStat;
  };
}

function deriveState(done: number, total: number): 'idle' | 'in-progress' | 'cleared' {
  if (total === 0) return 'idle';
  if (done >= total) return 'cleared';
  if (done > 0) return 'in-progress';
  return 'idle';
}

export function WeekHub({ childId, week, sections }: Props) {
  const reviewState = deriveState(sections.review.done, sections.review.total);
  const practiceState = deriveState(sections.practice.done, sections.practice.total);
  const bossState = sections.boss.locked
    ? 'locked'
    : deriveState(sections.boss.done, sections.boss.total);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <Link
          href={`/play/${childId}`}
          className="rounded-lg border-2 border-amber-800/40 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100"
        >
          ← 航海图
        </Link>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-amber-900/70">
            Week {week.weekNumber}
          </div>
          <div className="text-base font-extrabold text-amber-950">{week.label}</div>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <SectionCard
          href={`/play/${childId}/level/${week.id}/review`}
          emoji="📖"
          titleZh="回顾"
          titleEn="Review"
          progressText={`${sections.review.done}/${sections.review.total}`}
          state={reviewState}
        />
        <SectionCard
          href={`/play/${childId}/level/${week.id}/practice`}
          emoji="✍️"
          titleZh="练习"
          titleEn="Practice"
          progressText={`${sections.practice.done}/${sections.practice.total}`}
          state={practiceState}
        />
        <SectionCard
          href={`/play/${childId}/level/${week.id}/boss`}
          emoji="🐙"
          titleZh="Boss 战"
          titleEn="Boss Battle"
          progressText={
            sections.boss.locked
              ? `未解锁 / Locked`
              : `${sections.boss.done}/${sections.boss.total}`
          }
          state={bossState}
          lockedReason={
            sections.boss.locked
              ? `完成 ${BOSS_UNLOCK_PRACTICE_THRESHOLD}/${sections.practice.total} 练习解锁 / Clear ${BOSS_UNLOCK_PRACTICE_THRESHOLD} practice scenes to unlock`
              : undefined
          }
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Create the hub page**

Create `src/app/play/[childId]/week/[weekId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getPlayableWeekForChild } from '@/lib/db/weeks';
import { getSectionStatsForChild } from '@/lib/db/play';
import { BOSS_UNLOCK_PRACTICE_THRESHOLD } from '@/lib/scenes/configs';
import { WeekHub } from '@/components/play/WeekHub';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

export default async function WeekHubPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  await requireChild(childId);

  const week = await getPlayableWeekForChild(childId, weekId);
  if (!week) notFound();

  const stats = await getSectionStatsForChild(childId, weekId);
  const bossLocked = stats.practice.done < BOSS_UNLOCK_PRACTICE_THRESHOLD;

  return (
    <WeekHub
      childId={childId}
      week={{ id: week.id, weekNumber: week.weekNumber, label: week.label }}
      sections={{
        review: stats.review,
        practice: stats.practice,
        boss: { ...stats.boss, locked: bossLocked },
      }}
    />
  );
}
```

- [ ] **Step 6: Run the test → PASS**

Run: `pnpm test tests/unit/week-hub.test.tsx`

Expected: PASS (4 tests).

- [ ] **Step 7: Typecheck + lint + full tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/play/\[childId\]/week src/components/play/WeekHub.tsx src/components/play/SectionCard.tsx tests/unit/week-hub.test.tsx
git commit -m "feat(week-hub): /week/[weekId] page + WeekHub + SectionCard primitive"
```

---

## Task 5: Section route + boss redirect guard

**Files:**
- Create: `src/app/play/[childId]/level/[weekId]/[section]/page.tsx`
- Test: `tests/unit/section-route-guard.test.ts`

- [ ] **Step 1: Read the existing level page**

Read `src/app/play/[childId]/level/[weekId]/page.tsx` first. The new section route mostly mirrors it but filters levels by section + redirects for locked boss.

- [ ] **Step 2: Write the route-guard test**

Create `tests/unit/section-route-guard.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireChild: vi.fn(),
  getPlayableWeekForChild: vi.fn(),
  getSectionStatsForChild: vi.fn(),
  getLevelsForSection: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NotFound'); }),
}));

vi.mock('@/lib/auth/guards', () => ({ requireChild: mocks.requireChild }));
vi.mock('@/lib/db/weeks', () => ({ getPlayableWeekForChild: mocks.getPlayableWeekForChild }));
vi.mock('@/lib/db/play', () => ({
  getSectionStatsForChild: mocks.getSectionStatsForChild,
  getLevelsForSection: mocks.getLevelsForSection,
}));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

import SectionPage from '@/app/play/[childId]/level/[weekId]/[section]/page';

beforeEach(() => {
  Object.values(mocks).forEach((m) => 'mockReset' in m && m.mockReset());
  mocks.requireChild.mockResolvedValue({ child: { id: 'c1' } });
  mocks.getPlayableWeekForChild.mockResolvedValue({
    id: 'w1', weekNumber: 5, label: 'Week 5',
  });
  mocks.getLevelsForSection.mockResolvedValue([]);
});

describe('SectionPage boss route guard', () => {
  it('redirects to hub when boss requested but practice cleared < threshold', async () => {
    mocks.getSectionStatsForChild.mockResolvedValue({
      review: { done: 10, total: 10 },
      practice: { done: 3, total: 12 },   // below threshold
      boss: { done: 0, total: 1 },
    });
    await SectionPage({
      params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'boss' }),
    });
    expect(mocks.redirect).toHaveBeenCalledWith('/play/c1/week/w1');
  });

  it('allows boss when practice cleared ≥ threshold', async () => {
    mocks.getSectionStatsForChild.mockResolvedValue({
      review: { done: 10, total: 10 },
      practice: { done: 6, total: 12 },   // at threshold
      boss: { done: 0, total: 1 },
    });
    await SectionPage({
      params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'boss' }),
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('allows review and practice unconditionally', async () => {
    mocks.getSectionStatsForChild.mockResolvedValue({
      review: { done: 0, total: 10 },
      practice: { done: 0, total: 12 },
      boss: { done: 0, total: 1 },
    });
    await SectionPage({
      params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'review' }),
    });
    expect(mocks.redirect).not.toHaveBeenCalled();

    await SectionPage({
      params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'practice' }),
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('returns notFound for invalid section', async () => {
    mocks.getSectionStatsForChild.mockResolvedValue({
      review: { done: 0, total: 0 },
      practice: { done: 0, total: 0 },
      boss: { done: 0, total: 0 },
    });
    await expect(
      SectionPage({
        params: Promise.resolve({ childId: 'c1', weekId: 'w1', section: 'invalid' as 'review' }),
      }),
    ).rejects.toThrow(/NotFound/);
  });
});
```

- [ ] **Step 3: Run test → FAIL**

Run: `pnpm test tests/unit/section-route-guard.test.ts`

Expected: FAIL (module doesn't exist).

- [ ] **Step 4: Create the section page**

Create `src/app/play/[childId]/level/[weekId]/[section]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getPlayableWeekForChild } from '@/lib/db/weeks';
import {
  getSectionStatsForChild,
  getLevelsForSection,
  type WeekSection,
} from '@/lib/db/play';
import { BOSS_UNLOCK_PRACTICE_THRESHOLD } from '@/lib/scenes/configs';
import { SceneRunner } from '@/components/scenes/SceneRunner';

const SECTIONS: WeekSection[] = ['review', 'practice', 'boss'];

interface PageProps {
  params: Promise<{ childId: string; weekId: string; section: string }>;
}

export default async function SectionPage({ params }: PageProps) {
  const { childId, weekId, section } = await params;

  if (!SECTIONS.includes(section as WeekSection)) {
    notFound();
  }
  const typedSection = section as WeekSection;

  await requireChild(childId);
  const week = await getPlayableWeekForChild(childId, weekId);
  if (!week) notFound();

  const stats = await getSectionStatsForChild(childId, weekId);
  if (
    typedSection === 'boss' &&
    stats.practice.done < BOSS_UNLOCK_PRACTICE_THRESHOLD
  ) {
    redirect(`/play/${childId}/week/${weekId}`);
  }

  const levels = await getLevelsForSection(weekId, typedSection);
  if (levels.length === 0) notFound();

  return (
    <SceneRunner
      childId={childId}
      week={{ id: week.id, weekNumber: week.weekNumber, label: week.label }}
      levels={levels}
      // After last level, return to the hub (not the island map)
      exitHref={`/play/${childId}/week/${weekId}`}
    />
  );
}
```

Note: this assumes `SceneRunner` accepts an `exitHref` prop. If it doesn't today, Task 7 adds it.

- [ ] **Step 5: Run test → PASS**

Run: `pnpm test tests/unit/section-route-guard.test.ts`

Expected: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS. If `SceneRunner` doesn't yet accept `exitHref`, typecheck may fail — that's fine, fix it in Task 7. For now you can temporarily comment out the `exitHref` line if needed to land Task 5 cleanly.

- [ ] **Step 7: Commit**

```bash
git add src/app/play/\[childId\]/level/\[weekId\]/\[section\] tests/unit/section-route-guard.test.ts
git commit -m "feat(week-hub): /level/[weekId]/[section] route + boss unlock guard"
```

---

## Task 6: Old route redirect + IslandMap link update

**Files:**
- Modify: `src/app/play/[childId]/level/[weekId]/page.tsx` — replace body with redirect
- Modify: `src/components/play/IslandMap.tsx` — change Link href

- [ ] **Step 1: Replace the legacy level page with a redirect**

Read `src/app/play/[childId]/level/[weekId]/page.tsx` first to confirm its current shape. Then replace the entire file with:

```tsx
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

export default async function LegacyLevelPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  redirect(`/play/${childId}/week/${weekId}`);
}
```

(Save the previous page body to your memory if it had unique imports — it'll be moved to the new `[section]/page.tsx` in Task 5 if not already there.)

- [ ] **Step 2: Update IslandMap link**

In `src/components/play/IslandMap.tsx`, find the `<Link href={...}>` for each island (around line 152):

```tsx
href={`/play/${childId}/level/${island.weekId}`}
```

Change to:

```tsx
href={`/play/${childId}/week/${island.weekId}`}
```

- [ ] **Step 3: Update any IslandMap test that asserts on the old href**

Run: `pnpm test tests/unit/island-map`

If any test fails, update the expected href from `/level/<id>` to `/week/<id>`.

- [ ] **Step 4: Typecheck + lint + full tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/play/\[childId\]/level/\[weekId\]/page.tsx src/components/play/IslandMap.tsx tests/unit/island-map*.test.tsx
git commit -m "feat(week-hub): island tap → /week/[weekId]; legacy /level/[weekId] redirects to hub"
```

---

## Task 7: SceneRunner exit target

**Files:**
- Modify: `src/components/scenes/SceneRunner.tsx`
- Test: `tests/unit/scene-runner-exit-target.test.tsx`

`SceneRunner` today navigates somewhere on completion (probably `/play/[childId]`). We want it to honor an `exitHref` prop and default to the play home for safety.

- [ ] **Step 1: Read SceneRunner**

Open `src/components/scenes/SceneRunner.tsx` and find where it navigates on completion/exit. Likely uses `router.push(...)` with a hardcoded path.

- [ ] **Step 2: Write a focused test**

Create `tests/unit/scene-runner-exit-target.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
// adjust the import to match SceneRunner's actual location
import { SceneRunner } from '@/components/scenes/SceneRunner';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

beforeEach(() => { pushMock.mockReset(); });

describe('SceneRunner exitHref', () => {
  it('default exitHref returns to /play/[childId] when prop not provided', () => {
    render(
      <SceneRunner
        childId="c1"
        week={{ id: 'w1', weekNumber: 1, label: 'Week 1' }}
        levels={[]}
      />,
    );
    // exitHref defaults to /play/c1; assert by triggering the back/exit nav
    // — actual UI invocation depends on how SceneRunner renders its exit button.
    // For the purposes of this PR, the test confirms `exitHref` prop is accepted
    // and defaults correctly. Adjust the assertion to read the exit Link's href
    // attribute or the router.push call site, whichever exists.
  });

  it('honors explicit exitHref prop', () => {
    render(
      <SceneRunner
        childId="c1"
        week={{ id: 'w1', weekNumber: 1, label: 'Week 1' }}
        levels={[]}
        exitHref="/play/c1/week/w1"
      />,
    );
    // assert via the Link rendered for exit, or via router.push payload
  });
});
```

**Note**: This test scaffold needs adaptation once you read SceneRunner. If SceneRunner uses a `Link` for exit, assert `href` via `screen.getByRole('link')`. If it uses `router.push`, assert via the `pushMock`. The implementer adapts the assertion to match the real UI.

- [ ] **Step 3: Add `exitHref` prop to SceneRunner**

In `src/components/scenes/SceneRunner.tsx`:

1. Add to the Props interface:
   ```ts
   exitHref?: string;
   ```
2. Destructure with a default:
   ```ts
   export function SceneRunner({ childId, week, levels, exitHref = `/play/${childId}`, ... }: Props) {
   ```
3. Wherever SceneRunner navigates on exit/complete (probably one or two `router.push(`/play/${childId}`)` calls or a `Link href={`/play/${childId}`}`), substitute `exitHref`.

The change is mechanical: find every place that hardcodes `/play/${childId}` *as an exit destination* and replace with `exitHref`. Do NOT change paths that aren't exits (e.g., trophy room nav, shop nav).

- [ ] **Step 4: Run the test → PASS**

Run: `pnpm test tests/unit/scene-runner-exit-target.test.tsx`

Expected: PASS once you've adapted the assertion to SceneRunner's actual exit UI.

- [ ] **Step 5: Full test + typecheck + lint**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/scenes/SceneRunner.tsx tests/unit/scene-runner-exit-target.test.tsx
git commit -m "feat(week-hub): SceneRunner accepts exitHref so section runner returns to hub"
```

---

## Task 8: Disable-pinyin-pick script + recompile-all-weeks

**Files:**
- Create: `scripts/disable-pinyin-pick.ts`

This task is mostly about running ops scripts; the script itself is tiny. The recompile-all-weeks script already exists from PR #30 — we'll just rerun it.

- [ ] **Step 1: Create the disable script**

Create `scripts/disable-pinyin-pick.ts`:

```ts
/**
 * One-off: flip the pinyin_pick scene_template row to is_active=false.
 * Idempotent — re-running is safe.
 *
 * Usage:
 *   pnpm tsx scripts/disable-pinyin-pick.ts
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

async function main() {
  const { db } = await import('../src/db');
  const { sceneTemplates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const result = await db
    .update(sceneTemplates)
    .set({ isActive: false })
    .where(eq(sceneTemplates.type, 'pinyin_pick'))
    .returning({ id: sceneTemplates.id, isActive: sceneTemplates.isActive });

  if (result.length === 0) {
    console.log('No pinyin_pick scene_template found — nothing to do.');
  } else {
    for (const r of result) {
      console.log(`  pinyin_pick template ${r.id} → is_active=${r.isActive}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Smoke-run locally**

Run: `pnpm tsx scripts/disable-pinyin-pick.ts`

Expected: prints the row that was updated (or "nothing to do" if pre-already-disabled).

- [ ] **Step 3: Recompile all weeks locally**

Run: `pnpm tsx scripts/recompile-all-weeks.ts`

Expected: each week recompiles. Look for any errors (e.g. weeks where the new structure can't be satisfied — should be none if test data follows the standard shape).

- [ ] **Step 4: Smoke-check via psql or a quick query**

If you have psql handy, run:
```sql
SELECT week_id, COUNT(*) AS levels, jsonb_path_query_array(jsonb_agg(scene_config), '$[*].segment') AS segments
FROM week_levels
GROUP BY week_id;
```

You should see each ≥10-char week has 23 levels with segments `[review × 10, sound × 3, sight × 3, meaning × 6, boss × 1]`.

- [ ] **Step 5: Commit**

```bash
git add scripts/disable-pinyin-pick.ts
git commit -m "chore(scripts): disable-pinyin-pick — one-off ops to flip template inactive"
```

Note: the recompile-all-weeks run isn't committed — it's a runtime ops step. Will be re-run against prod after merge.

---

## Task 9: 4-green gate + PR open

- [ ] **Step 1: Run the 4-green gate**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

All four must pass. Any failure → fix root cause; don't paper over.

- [ ] **Step 2: Manual smoke test**

```bash
pnpm dev
```

Then open `http://localhost:3000/play/<childId>` (use your dev seed) and verify:

1. Tap an island → lands on `/play/<childId>/week/<weekId>` showing 3 cards.
2. 回顾 → enters review (10 flashcards) → finish all → returns to hub → 回顾 shows ✨.
3. 练习 → enters practice (12 scenes) → finish 6 → return → boss is now unlocked.
4. Boss locked initially (practice < 6) → tapping boss card does nothing (button is `aria-disabled`).
5. Direct URL: `/play/<childId>/level/<weekId>/boss` while practice < 6 → redirects to hub.
6. Old URL: `/play/<childId>/level/<weekId>` → redirects to hub.
7. No pinyin_pick scene appears in any week.
8. Build prints all routes including `/play/[childId]/week/[weekId]` and `/play/[childId]/level/[weekId]/[section]`.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feat/pr35-week-hub-restructure
```

(SSH only.)

- [ ] **Step 4: Open the PR**

```bash
gh pr create --title "feat: PR #35 — week hub restructure + pinyin removal + practice 2×" --body "$(cat <<'EOF'
## Summary
- Each week splits into 3 separately-enterable sections: 回顾 / 练习 / Boss 战 via a new hub at `/play/[childId]/week/[weekId]`.
- Pinyin practice removed (`pinyin_pick` template flipped to inactive; component file retained for backwards compat). Boss question rotation narrows 6 → 5 types.
- Practice quantity ~doubled per 10-char week: 5 → 12 scenes (3 audio + 3 sight + 6 meaning).
- Boss locked until ≥ 6/12 practice scenes cleared (UI + server route guard).
- New `week_levels.level_key` column + unique constraint enables stable upsert keys; future compile changes preserve `scene_attempts.week_level_id` linkage. One-time reset accepted on first recompile post-merge.

## Test plan
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green locally
- [x] Migration 0011 applied to dev DB; recompile-all-weeks ran without error
- [ ] Tap island → hub page renders 3 cards
- [ ] Buy practice ≥6 → boss card unlocks
- [ ] Boss URL direct-access while locked → redirects to hub
- [ ] No pinyin_pick in any compiled week

## Spec & plan
- Spec: `docs/superpowers/specs/2026-05-24-pr35-week-hub-restructure-design.md`
- Plan: `docs/superpowers/plans/2026-05-24-pr35-week-hub-restructure.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Wait for CI, squash-merge**

```bash
gh pr checks <pr-number> --watch
gh pr merge <pr-number> --squash --delete-branch
```

- [ ] **Step 6: Run prod scripts post-merge**

After CI green + merge, sync main and run the ops scripts against prod (DATABASE_URL points at prod via shared Neon URL):

```bash
git checkout main && git pull --ff-only
pnpm tsx scripts/migrate.ts                       # applies 0011 to prod
pnpm tsx scripts/disable-pinyin-pick.ts           # flips template
pnpm tsx scripts/recompile-all-weeks.ts           # recompiles all prod weeks to new shape
```

- [ ] **Step 7: Update CLAUDE.md on main**

After the prod recompile is clean, append the PR #35 entry to CLAUDE.md (per the spec §10 wording) and commit on main:

```bash
git checkout main
# Edit CLAUDE.md: update "last refreshed" date, append PR #35 to Current state,
# append 2 new landmines per spec §10.
git add CLAUDE.md
git commit -m "docs(claude.md): record PR #35 (week hub + pinyin removal + stable keys)"
git push
```

(Branch protection on main may require a docs-only direct push to be allowed via admin bypass, same pattern as `5014e4c` (PR #33 docs) and `f1d7f64` (PR #34 docs).)

---

## Self-review notes (already applied to this plan)

**1. Spec coverage**: every section of the spec maps to a task:
- §3.1 (routing) → Task 4 + Task 5 + Task 6
- §3.2 (stable keys) → Task 1 + Task 2
- §3.3 (compile rewrite) → Task 2
- §3.4 (boss gating) → Task 2 (threshold const) + Task 4 (UI) + Task 5 (route guard)
- §3.5 (WeekHub UI) → Task 4
- §3.6 (SceneRunner filtering) → Task 5 + Task 7
- §3.7 (island tap) → Task 6
- §3.8 (old URL redirect) → Task 6
- §4 (data model) → Task 1
- §5 (UI components) → Tasks 4, 5, 6, 7
- §6 (tests) → distributed
- §7 (scripts) → Task 8
- §9 (verification) → Task 9
- §10 (CLAUDE.md update) → Task 9 Step 7

**2. Placeholder scan**: every code block is concrete. The one `// adjust the assertion to read...` comment in Task 7's test scaffold is annotated as such — that's an instruction to the implementer, not a placeholder for missing code.

**3. Type consistency**:
- `WeekSection` defined in Task 3, used by Task 5.
- `SectionStats` shape used identically by Task 3 (definition), Task 4 (Hub UI), Task 5 (route guard).
- `BOSS_UNLOCK_PRACTICE_THRESHOLD` defined in Task 2 step 1, consumed by Task 4 + Task 5.
- `levelKey` schema field defined in Task 1, used by Task 2's compile + upsert.
- `exitHref` SceneRunner prop introduced in Task 7, consumed by Task 5 (note in Task 5 says compile errors there are expected until Task 7 lands).

## Execution Handoff

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task with two-stage review. Same pattern shipped PRs #30–#34.
2. **Inline execution with checkpoints** — execute tasks in this session with pauses at natural boundaries (after Task 2, after Task 6).

Which approach?
