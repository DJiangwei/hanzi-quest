# PR #48 — Story Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Yinuo-as-protagonist generative weekly narrative — one bilingual DeepSeek-generated story chapter per (child, week), boss-score-weighted tone, surfaced via a home page pill + a Story Library hall card in the Backpack, with browser-TTS audio.

**Architecture:** New `story_chapters` table (one row per child×week, UNIQUE-constrained). DeepSeek (`@ai-sdk/deepseek` + `generateObject` with Zod schema) called from a server action; eager fire-and-forget kicked off by `finishLevelAction` on boss-clear, with synchronous fallback at the chapter page. UI is server-component-rendered pages + a few `'use client'` islands (audio button, mark-as-read trigger). Pet/avatar in the hero card use existing `AvatarRender`. No AI image gen in v1.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (Postgres on Neon), `@ai-sdk/deepseek` + `ai` (`generateObject`), Clerk auth, Vitest + RTL + jsdom (mocks `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`), Tailwind, Web Speech API (browser).

**Spec:** `docs/superpowers/specs/2026-05-29-pr48-story-mode-design.md`

**Branch:** `feat/pr48-story-mode` (already created; spec already committed at HEAD)

---

## File map (decomposition lock-in)

### New files

| Path | Responsibility |
|---|---|
| `drizzle/0017_story_mode.sql` | Migration: `story_chapters` table + `story_tone` enum + extend `trophy_category` with `'story'` |
| `src/db/schema/story.ts` | Drizzle schema source for `story_chapters` + `storyTone` enum |
| `src/lib/errors/story-errors.ts` | Pure error classes — `StoryGenerationError`, `ChapterNotReadyError` |
| `src/lib/db/story.ts` | Postgres queries — `upsertStoryChapter`, `getStoryChapterByWeek`, `listStoryChaptersForChild`, `markChapterRead`, `getLatestUnreadChapter`, `getLatestBossScoreForChildWeek`, `getCharactersAvailableForChildWeek` |
| `src/lib/ai/deepseek-story.ts` | Prompt builder + Zod schema (`StoryChapterOutputSchema`) + `generateStoryChapterWithAI` |
| `src/lib/actions/story.ts` | `'use server'` — `generateStoryChapter`, `markChapterReadAction` (sync helpers — `getStoryChapterByWeek` etc. stay in `db/story.ts`) |
| `src/components/play/story/ChapterAudioButton.tsx` | `'use client'` — Web Speech API zh-CN wrapper |
| `src/components/play/story/ChapterBody.tsx` | Server-renderable — ZH text + audio button + EN text |
| `src/components/play/story/ChapterCard.tsx` | Server-renderable — hero card (avatar + pet + chapter heading) over treasure-map background |
| `src/components/play/story/StoryLibraryGrid.tsx` | Server-renderable — grid of chapter cards (Backpack archive view) |
| `src/components/play/LatestChapterPill.tsx` | Server-renderable — home page pill, links to latest unread chapter; renders null when none |
| `src/components/play/MarkChapterReadOnMount.tsx` | `'use client'` — fires `markChapterReadAction` once via `useEffect` |
| `src/app/play/[childId]/story/[weekId]/page.tsx` | Chapter view (RSC) |
| `src/app/play/[childId]/story/[weekId]/loading.tsx` | Suspense skeleton ("✨ Captain Yinuo's Log is being written...") |
| `src/app/play/[childId]/collection/story-library/page.tsx` | Story Library archive (RSC) |
| `tests/unit/lib/db/story.test.ts` | DB query tests |
| `tests/unit/lib/actions/story.test.ts` | Server action tests (incl. trophy grant + tone derivation + idempotency) |
| `tests/unit/lib/ai/deepseek-story.test.ts` | Prompt builder + parse tests |
| `tests/unit/components/play/story/ChapterAudioButton.test.tsx` | Web Speech API mock tests |
| `tests/unit/components/play/story/ChapterBody.test.tsx` | Body composition test |
| `tests/unit/components/play/story/ChapterCard.test.tsx` | Avatar + pet composition test |
| `tests/unit/components/play/story/StoryLibraryGrid.test.tsx` | Grid renders + sort order |
| `tests/unit/components/play/LatestChapterPill.test.tsx` | Hidden states + visible state |
| `tests/unit/app/story-page.test.tsx` | Chapter route renders / falls back to sync gen / error card |

### Modified files

| Path | Change |
|---|---|
| `src/db/schema/index.ts` | Re-export new story schema |
| `src/db/schema/trophies.ts` | Add `'story'` to `trophyCategory` enum |
| `src/lib/db/trophies.ts` | Extend `TrophyCheckContext` union with `{ kind: 'story-chapter-generated' }`; add switch case granting `first-chapter` |
| `src/lib/avatar/itemCatalog.tsx` | Add `narrativeHint: string` per item, plus a fallback resolver |
| `src/lib/actions/play.ts` | `finishLevelAction` boss-clear branch fires `generateStoryChapter` fire-and-forget |
| `src/components/play/AtlasHub.tsx` | Add Story Library hall card |
| `src/app/play/[childId]/page.tsx` (home) | Mount `<LatestChapterPill childId={...} />` between `<WeekStrip />` and the bottom nav |
| `src/app/play/[childId]/level/[weekId]/[section]/page.tsx` (boss section page) | Add "📖 Read your chapter" button to boss-complete UI when a chapter exists |
| `scripts/seed-trophies.ts` | Add `first-chapter` trophy row |

---

## Conventions used throughout

- **All tests mock external boundaries** per CLAUDE.md: `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`. Existing repo idiom is `vi.hoisted(() => ({...}))` to build chainable mock objects — follow that pattern. Do not import the real `@/db` from a test.
- **`'use server'` files** (`src/lib/actions/*.ts`) export ONLY async functions. Sync helpers go in `src/lib/db/*.ts` or `src/lib/errors/*.ts`.
- **Error classes** live in `src/lib/errors/` — client-safe, no postgres deps.
- **Schema source of truth** is TypeScript (`src/db/schema/*.ts`). Generate SQL with `pnpm db:generate` (NOT `drizzle:generate` — that's a common confusion). Then apply with `pnpm db:migrate` once locally to verify.
- **TDD discipline:** every code-producing task starts with a failing test, then minimal impl, then green. Commit at each green checkpoint.
- **Commit per task** unless explicitly noted; messages follow conventional commits (`feat:`, `test:`, `chore:`).
- **No emojis in code** unless they are user-visible (chapter card decoration, button glyphs).
- **No new dependencies** — `@ai-sdk/deepseek`, `ai`, `zod`, `drizzle-orm`, `clerk`, `vitest`, `@testing-library/react` all already installed.

---

## Verification gate (run before opening PR)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

All four must pass. Project policy from CLAUDE.md §"Hard rules" #2.

---

# Tasks

---

### Task 1: Schema source + migration 0017

Add `story_chapters` table, `story_tone` enum, and extend `trophy_category` with `'story'`.

**Files:**
- Create: `src/db/schema/story.ts`
- Modify: `src/db/schema/trophies.ts` (add `'story'` to `trophyCategory`)
- Modify: `src/db/schema/index.ts` (re-export new story schema)
- Generate: `drizzle/0017_*.sql` (generated, name will be a Drizzle-assigned slug)

- [ ] **Step 1: Create `src/db/schema/story.ts`**

```ts
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';
import { weeks } from './content';

export const storyTone = pgEnum('story_tone', [
  'triumphant',
  'standard',
  'narrow_escape',
]);

export const storyChapters = pgTable(
  'story_chapters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    bodyZh: text('body_zh').notNull(),
    bodyEn: text('body_en').notNull(),
    summaryForNext: text('summary_for_next').notNull(),
    tone: storyTone('tone').notNull(),
    bossScorePct: integer('boss_score_pct').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('story_chapters_child_week_uq').on(t.childId, t.weekId),
    index('story_chapters_child_created_idx').on(t.childId, t.createdAt),
    check(
      'story_chapters_boss_score_range',
      sql`${t.bossScorePct} BETWEEN 0 AND 100`,
    ),
  ],
);
```

- [ ] **Step 2: Modify `src/db/schema/trophies.ts` — add `'story'` to `trophyCategory`**

```ts
// Existing:
export const trophyCategory = pgEnum('trophy_category', [
  'mastery',
  'streak',
  'collection',
  'coins',
  'practice',
]);

// Change to:
export const trophyCategory = pgEnum('trophy_category', [
  'mastery',
  'streak',
  'collection',
  'coins',
  'practice',
  'story',
]);
```

- [ ] **Step 3: Re-export from `src/db/schema/index.ts`**

Locate the existing re-export block and add:

```ts
export * from './story';
```

- [ ] **Step 4: Generate migration**

Run: `pnpm db:generate`

Expected: a new file `drizzle/0017_<slug>.sql` appears containing `CREATE TYPE story_tone`, `CREATE TABLE story_chapters`, `ALTER TYPE trophy_category ADD VALUE 'story'`. Drizzle assigns the slug automatically — do not rename.

- [ ] **Step 5: Apply locally to verify migration is sane**

Run: `pnpm db:migrate`

Expected: completes without error. If it fails because Drizzle complains about the enum ALTER not being executable inside a transaction, you'll need to manually split the `ALTER TYPE trophy_category ADD VALUE 'story'` out into its own migration file — see Postgres docs on `ALTER TYPE … ADD VALUE`. The fix is: rename the generated file with the enum-add into `0017a_*.sql`, and put a follow-up `0017b_story_chapters.sql` for the CREATE TABLE. Drizzle's runner applies them in lexicographic order.

- [ ] **Step 6: Sanity-check the generated SQL**

Run: `cat drizzle/0017_*.sql`

Expected: contains `CREATE TYPE "public"."story_tone"`, `CREATE TABLE "story_chapters"`, `ALTER TYPE "public"."trophy_category" ADD VALUE 'story'`.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema/story.ts src/db/schema/trophies.ts src/db/schema/index.ts drizzle/0017_*.sql drizzle/meta/
git commit -m "feat(pr48): add story_chapters schema + migration 0017"
```

---

### Task 2: Pure error classes

Add `StoryGenerationError` and `ChapterNotReadyError` — client-safe, no postgres dep.

**Files:**
- Create: `src/lib/errors/story-errors.ts`
- Test: none (trivial)

- [ ] **Step 1: Create `src/lib/errors/story-errors.ts`**

```ts
export class StoryGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StoryGenerationError';
  }
}

export class ChapterNotReadyError extends Error {
  constructor(public readonly weekId: string) {
    super(`Chapter not ready for week ${weekId}`);
    this.name = 'ChapterNotReadyError';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/errors/story-errors.ts
git commit -m "feat(pr48): add story-mode pure error classes"
```

---

### Task 3: DB queries

Postgres queries for the story_chapters table + helpers for boss score + available characters.

**Files:**
- Create: `src/lib/db/story.ts`
- Test: `tests/unit/lib/db/story.test.ts`

- [ ] **Step 1: Write failing tests `tests/unit/lib/db/story.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbMock = vi.hoisted(() => {
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    values: vi.fn(() => chain),
    onConflictDoNothing: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
  };
  return { db: chain };
});

vi.mock('@/db', () => dbMock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('upsertStoryChapter', () => {
  it('inserts a new chapter and returns the row', async () => {
    const row = {
      id: 'c1',
      childId: 'k1',
      weekId: 'w1',
      bodyZh: '小帆船',
      bodyEn: 'Tiny sail.',
      summaryForNext: '- A',
      tone: 'standard',
      bossScorePct: 80,
      readAt: null,
      createdAt: new Date(),
    };
    dbMock.db.returning.mockResolvedValueOnce([row]);
    const { upsertStoryChapter } = await import('@/lib/db/story');
    const result = await upsertStoryChapter({
      childId: 'k1',
      weekId: 'w1',
      bodyZh: '小帆船',
      bodyEn: 'Tiny sail.',
      summaryForNext: '- A',
      tone: 'standard',
      bossScorePct: 80,
    });
    expect(result).toEqual(row);
    expect(dbMock.db.onConflictDoNothing).toHaveBeenCalled();
  });

  it('returns the existing chapter on conflict', async () => {
    const existing = {
      id: 'c0',
      childId: 'k1',
      weekId: 'w1',
      bodyZh: 'old',
      bodyEn: 'old',
      summaryForNext: '- old',
      tone: 'standard',
      bossScorePct: 70,
      readAt: null,
      createdAt: new Date(),
    };
    dbMock.db.returning.mockResolvedValueOnce([]);
    dbMock.db.limit.mockResolvedValueOnce([existing]);
    const { upsertStoryChapter } = await import('@/lib/db/story');
    const result = await upsertStoryChapter({
      childId: 'k1',
      weekId: 'w1',
      bodyZh: 'new',
      bodyEn: 'new',
      summaryForNext: '- new',
      tone: 'triumphant',
      bossScorePct: 100,
    });
    expect(result).toEqual(existing);
  });
});

describe('getStoryChapterByWeek', () => {
  it('returns the chapter for a child+week', async () => {
    const row = { id: 'c1', childId: 'k1', weekId: 'w1' };
    dbMock.db.limit.mockResolvedValueOnce([row]);
    const { getStoryChapterByWeek } = await import('@/lib/db/story');
    const result = await getStoryChapterByWeek('k1', 'w1');
    expect(result).toEqual(row);
  });

  it('returns null when none', async () => {
    dbMock.db.limit.mockResolvedValueOnce([]);
    const { getStoryChapterByWeek } = await import('@/lib/db/story');
    const result = await getStoryChapterByWeek('k1', 'w1');
    expect(result).toBeNull();
  });
});

describe('listStoryChaptersForChild', () => {
  it('returns chapters ordered newest-first', async () => {
    const rows = [
      { id: 'c2', createdAt: new Date('2026-05-25') },
      { id: 'c1', createdAt: new Date('2026-05-18') },
    ];
    dbMock.db.orderBy.mockReturnValueOnce(Promise.resolve(rows) as any);
    const { listStoryChaptersForChild } = await import('@/lib/db/story');
    const result = await listStoryChaptersForChild('k1');
    expect(result).toEqual(rows);
  });
});

describe('markChapterRead', () => {
  it('sets read_at for the matching chapter', async () => {
    dbMock.db.where.mockReturnValueOnce(Promise.resolve(undefined) as any);
    const { markChapterRead } = await import('@/lib/db/story');
    await markChapterRead('c1', 'k1');
    expect(dbMock.db.update).toHaveBeenCalled();
    expect(dbMock.db.set).toHaveBeenCalledWith(
      expect.objectContaining({ readAt: expect.any(Date) }),
    );
  });
});

describe('getLatestUnreadChapter', () => {
  it('returns the most recent unread chapter for the child', async () => {
    const row = { id: 'c2', readAt: null, createdAt: new Date() };
    dbMock.db.limit.mockResolvedValueOnce([row]);
    const { getLatestUnreadChapter } = await import('@/lib/db/story');
    const result = await getLatestUnreadChapter('k1');
    expect(result).toEqual(row);
  });

  it('returns null when nothing unread', async () => {
    dbMock.db.limit.mockResolvedValueOnce([]);
    const { getLatestUnreadChapter } = await import('@/lib/db/story');
    expect(await getLatestUnreadChapter('k1')).toBeNull();
  });
});

describe('getLatestBossScoreForChildWeek', () => {
  it('returns the score from the latest boss scene_attempts row', async () => {
    dbMock.db.limit.mockResolvedValueOnce([{ score: 83 }]);
    const { getLatestBossScoreForChildWeek } = await import('@/lib/db/story');
    expect(await getLatestBossScoreForChildWeek('k1', 'w1')).toBe(83);
  });

  it('returns 0 when no boss attempt exists', async () => {
    dbMock.db.limit.mockResolvedValueOnce([]);
    const { getLatestBossScoreForChildWeek } = await import('@/lib/db/story');
    expect(await getLatestBossScoreForChildWeek('k1', 'w1')).toBe(0);
  });
});

describe('getCharactersAvailableForChildWeek', () => {
  it('returns chars from the current week + all earlier weeks in the same pack', async () => {
    dbMock.db.limit.mockResolvedValueOnce([
      { sequenceIndex: 3, curriculumPackId: 'p1' },
    ]);
    dbMock.db.where.mockReturnValueOnce(
      Promise.resolve([{ text: '我' }, { text: '你' }, { text: '他' }]) as any,
    );
    const { getCharactersAvailableForChildWeek } = await import(
      '@/lib/db/story'
    );
    const result = await getCharactersAvailableForChildWeek('k1', 'w1');
    expect(result).toEqual(['我', '你', '他']);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/unit/lib/db/story.test.ts`

Expected: FAIL — `Cannot find module '@/lib/db/story'`.

- [ ] **Step 3: Create `src/lib/db/story.ts`**

```ts
import { and, desc, eq, isNull, lte } from 'drizzle-orm';
import { db } from '@/db';
import {
  characters,
  sceneAttempts,
  storyChapters,
  weekCharacters,
  weekLevels,
  weeks,
} from '@/db/schema';

export type StoryTone = 'triumphant' | 'standard' | 'narrow_escape';

export interface StoryChapterRow {
  id: string;
  childId: string;
  weekId: string;
  bodyZh: string;
  bodyEn: string;
  summaryForNext: string;
  tone: StoryTone;
  bossScorePct: number;
  readAt: Date | null;
  createdAt: Date;
}

interface UpsertStoryChapterInput {
  childId: string;
  weekId: string;
  bodyZh: string;
  bodyEn: string;
  summaryForNext: string;
  tone: StoryTone;
  bossScorePct: number;
}

/**
 * Insert a story chapter for (childId, weekId). If a row already exists
 * (UNIQUE constraint), return the existing row instead — concurrent eager +
 * sync fallback paths both call this and one must lose without surfacing
 * an error.
 */
export async function upsertStoryChapter(
  input: UpsertStoryChapterInput,
): Promise<StoryChapterRow> {
  const inserted = await db
    .insert(storyChapters)
    .values({
      childId: input.childId,
      weekId: input.weekId,
      bodyZh: input.bodyZh,
      bodyEn: input.bodyEn,
      summaryForNext: input.summaryForNext,
      tone: input.tone,
      bossScorePct: input.bossScorePct,
    })
    .onConflictDoNothing({
      target: [storyChapters.childId, storyChapters.weekId],
    })
    .returning();
  if (inserted.length > 0) return inserted[0] as StoryChapterRow;

  const existing = await db
    .select()
    .from(storyChapters)
    .where(
      and(
        eq(storyChapters.childId, input.childId),
        eq(storyChapters.weekId, input.weekId),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    throw new Error('upsertStoryChapter: insert returned empty and no existing row');
  }
  return existing[0] as StoryChapterRow;
}

export async function getStoryChapterByWeek(
  childId: string,
  weekId: string,
): Promise<StoryChapterRow | null> {
  const rows = await db
    .select()
    .from(storyChapters)
    .where(
      and(
        eq(storyChapters.childId, childId),
        eq(storyChapters.weekId, weekId),
      ),
    )
    .limit(1);
  return (rows[0] as StoryChapterRow | undefined) ?? null;
}

export async function listStoryChaptersForChild(
  childId: string,
): Promise<StoryChapterRow[]> {
  return db
    .select()
    .from(storyChapters)
    .where(eq(storyChapters.childId, childId))
    .orderBy(desc(storyChapters.createdAt)) as unknown as Promise<
    StoryChapterRow[]
  >;
}

export async function markChapterRead(
  chapterId: string,
  childId: string,
): Promise<void> {
  await db
    .update(storyChapters)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(storyChapters.id, chapterId),
        eq(storyChapters.childId, childId),
        isNull(storyChapters.readAt),
      ),
    );
}

export async function getLatestUnreadChapter(
  childId: string,
): Promise<StoryChapterRow | null> {
  const rows = await db
    .select()
    .from(storyChapters)
    .where(
      and(eq(storyChapters.childId, childId), isNull(storyChapters.readAt)),
    )
    .orderBy(desc(storyChapters.createdAt))
    .limit(1);
  return (rows[0] as StoryChapterRow | undefined) ?? null;
}

/**
 * Latest boss attempt score for a child+week. Returns 0 if no boss attempt
 * exists (caller should only call this after `finishLevelAction` with
 * `bossCleared=true`, so 0 means data drift).
 */
export async function getLatestBossScoreForChildWeek(
  childId: string,
  weekId: string,
): Promise<number> {
  const rows = await db
    .select({ score: sceneAttempts.score })
    .from(sceneAttempts)
    .innerJoin(weekLevels, eq(weekLevels.id, sceneAttempts.weekLevelId))
    .where(
      and(
        eq(sceneAttempts.childId, childId),
        eq(weekLevels.weekId, weekId),
        eq(weekLevels.sceneType, 'boss'),
      ),
    )
    .orderBy(desc(sceneAttempts.createdAt))
    .limit(1);
  return rows[0]?.score ?? 0;
}

/**
 * Characters available to the AI for story body_zh: every character in the
 * curriculum pack from sequence 1 through the current week's sequence.
 * Trusts curriculum order (weeks unlock sequentially).
 */
export async function getCharactersAvailableForChildWeek(
  childId: string,
  weekId: string,
): Promise<string[]> {
  const weekMeta = await db
    .select({
      sequenceIndex: weeks.sequenceIndex,
      curriculumPackId: weeks.curriculumPackId,
    })
    .from(weeks)
    .where(eq(weeks.id, weekId))
    .limit(1);
  if (weekMeta.length === 0) return [];
  const { sequenceIndex, curriculumPackId } = weekMeta[0]!;
  if (curriculumPackId === null) return [];

  const chars = await db
    .select({ text: characters.simplified })
    .from(characters)
    .innerJoin(weekCharacters, eq(weekCharacters.characterId, characters.id))
    .innerJoin(weeks, eq(weeks.id, weekCharacters.weekId))
    .where(
      and(
        eq(weeks.curriculumPackId, curriculumPackId),
        lte(weeks.sequenceIndex, sequenceIndex),
      ),
    );
  return chars.map((c) => c.text);
}
```

> **Note for implementer:** the exact column names on `sceneAttempts` (`childId` vs `userId`), `weekLevels` (`sceneType` vs `kind`), and `characters` (`simplified` vs `text`) depend on the existing schema. If the import names don't compile, `grep -n "pgTable.*scene_attempts\|pgTable.*week_levels\|pgTable.*characters\b" src/db/schema/*.ts` will show the actual field names. Adjust the property paths to match the real schema. The query *shape* (join scene_attempts → week_levels filter sceneType='boss', join characters → week_characters → weeks filter pack+sequence) is what matters.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/lib/db/story.test.ts`

Expected: PASS for all 7 describe blocks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/story.ts tests/unit/lib/db/story.test.ts
git commit -m "feat(pr48): db queries for story_chapters + helpers"
```

---

### Task 4: itemCatalog narrativeHint extension

Avatar/pet items need a short English description string the AI can fold into the hero's appearance line. Default to the item label when the field is missing.

**Files:**
- Modify: `src/lib/avatar/itemCatalog.tsx` (or `.ts` — match existing extension)
- Test: `tests/unit/lib/avatar/narrative-hint.test.ts`

- [ ] **Step 1: Inspect the existing catalog shape**

Run: `head -50 src/lib/avatar/itemCatalog.tsx`

Expected: shows a TypeScript object/map keyed by item id with `slot`, `label`, `svgComponent`, etc. Note the exact type name (likely `AvatarItem` or similar).

- [ ] **Step 2: Write failing test `tests/unit/lib/avatar/narrative-hint.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  ITEM_CATALOG,
  resolveNarrativeHint,
} from '@/lib/avatar/itemCatalog';

describe('itemCatalog narrativeHint', () => {
  it('every entry has a narrativeHint string', () => {
    for (const [id, item] of Object.entries(ITEM_CATALOG)) {
      expect(
        typeof item.narrativeHint,
        `${id} is missing narrativeHint`,
      ).toBe('string');
      expect(item.narrativeHint.length).toBeGreaterThan(0);
    }
  });

  it('resolveNarrativeHint returns the hint for a known id', () => {
    const firstId = Object.keys(ITEM_CATALOG)[0]!;
    expect(resolveNarrativeHint(firstId)).toBe(
      ITEM_CATALOG[firstId]!.narrativeHint,
    );
  });

  it('resolveNarrativeHint falls back to a placeholder for unknown id', () => {
    expect(resolveNarrativeHint('does-not-exist')).toBe('a pirate kid');
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `pnpm vitest run tests/unit/lib/avatar/narrative-hint.test.ts`

Expected: FAIL — `narrativeHint` field missing on items, or `resolveNarrativeHint` not exported.

- [ ] **Step 4: Extend `itemCatalog.tsx`**

Add `narrativeHint: string` to every catalog entry. Examples (adjust to actual ids):

```ts
'red-bandana':       { ...existing, narrativeHint: 'a red bandana' },
'striped-tee':       { ...existing, narrativeHint: 'a striped sailor shirt' },
'captain-coat':      { ...existing, narrativeHint: 'a navy captain\'s coat' },
'tricorn-hat':       { ...existing, narrativeHint: 'a black tricorn hat' },
'parrot-perch':      { ...existing, narrativeHint: 'a tiny parrot on her shoulder' },
'kid-default':       { ...existing, narrativeHint: 'a young pirate kid' },
'ocean-frame':       { ...existing, narrativeHint: 'wave-blue surroundings' },
// … fill in for every item id
```

Then export the resolver:

```ts
export function resolveNarrativeHint(itemId: string | null | undefined): string {
  if (!itemId) return 'a pirate kid';
  const item = ITEM_CATALOG[itemId];
  return item?.narrativeHint ?? 'a pirate kid';
}
```

Update the `AvatarItem` (or equivalently named) TS type to include `narrativeHint: string`.

- [ ] **Step 5: Run test to verify pass**

Run: `pnpm vitest run tests/unit/lib/avatar/narrative-hint.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/avatar/itemCatalog.tsx tests/unit/lib/avatar/narrative-hint.test.ts
git commit -m "feat(pr48): add narrativeHint to avatar items + resolver"
```

---

### Task 5: DeepSeek story prompt + caller

Build the prompt template, the Zod output schema, and the `generateStoryChapterWithAI` function that wraps `generateObject`.

**Files:**
- Create: `src/lib/ai/deepseek-story.ts`
- Test: `tests/unit/lib/ai/deepseek-story.test.ts`

- [ ] **Step 1: Write failing tests `tests/unit/lib/ai/deepseek-story.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const aiMock = vi.hoisted(() => ({
  generateObject: vi.fn(),
}));
vi.mock('ai', () => aiMock);

const deepseekMock = vi.hoisted(() => ({
  deepseek: vi.fn(() => 'deepseek-model-handle'),
}));
vi.mock('@ai-sdk/deepseek', () => deepseekMock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildStoryUserPrompt', () => {
  it('injects the heroAppearance narrative line', async () => {
    const { buildStoryUserPrompt } = await import('@/lib/ai/deepseek-story');
    const prompt = buildStoryUserPrompt({
      heroName: 'Yinuo',
      heroAppearance: 'a red bandana and a striped sailor shirt',
      petHint: 'a chatty parrot',
      availableChars: ['我', '你', '红'],
      newCharsThisWeek: ['红'],
      priorSummary: '- Last chapter ended on the docks.',
      tone: 'triumphant',
    });
    expect(prompt).toContain('Yinuo');
    expect(prompt).toContain('a red bandana');
    expect(prompt).toContain('a chatty parrot');
    expect(prompt).toContain('我, 你, 红');
    expect(prompt).toContain('红');
    expect(prompt).toContain('triumphant');
    expect(prompt).toContain('Last chapter ended');
  });

  it('uses the first-chapter fallback when priorSummary is empty', async () => {
    const { buildStoryUserPrompt } = await import('@/lib/ai/deepseek-story');
    const prompt = buildStoryUserPrompt({
      heroName: 'Yinuo',
      heroAppearance: 'a young pirate kid',
      petHint: null,
      availableChars: ['我'],
      newCharsThisWeek: ['我'],
      priorSummary: '',
      tone: 'standard',
    });
    expect(prompt).toContain('first chapter');
  });
});

describe('generateStoryChapterWithAI', () => {
  it('calls generateObject with the deepseek model + system + user prompts', async () => {
    aiMock.generateObject.mockResolvedValueOnce({
      object: {
        body_zh: '小红花开。',
        body_en: 'A small red flower bloomed.',
        summary_for_next: '- She picked the red flower.',
      },
    });
    const { generateStoryChapterWithAI } = await import(
      '@/lib/ai/deepseek-story'
    );
    const result = await generateStoryChapterWithAI({
      heroName: 'Yinuo',
      heroAppearance: 'a young pirate kid',
      petHint: null,
      availableChars: ['我', '红', '花'],
      newCharsThisWeek: ['红', '花'],
      priorSummary: '',
      tone: 'standard',
    });
    expect(result).toEqual({
      bodyZh: '小红花开。',
      bodyEn: 'A small red flower bloomed.',
      summaryForNext: '- She picked the red flower.',
    });
    expect(aiMock.generateObject).toHaveBeenCalledOnce();
    const call = aiMock.generateObject.mock.calls[0]![0];
    expect(call.model).toBe('deepseek-model-handle');
    expect(call.system).toContain("children's book author");
    expect(call.prompt).toContain('Yinuo');
  });

  it('throws StoryGenerationError on parse failure', async () => {
    aiMock.generateObject.mockRejectedValueOnce(new Error('schema mismatch'));
    const { generateStoryChapterWithAI } = await import(
      '@/lib/ai/deepseek-story'
    );
    const { StoryGenerationError } = await import(
      '@/lib/errors/story-errors'
    );
    await expect(
      generateStoryChapterWithAI({
        heroName: 'Yinuo',
        heroAppearance: 'a young pirate kid',
        petHint: null,
        availableChars: ['我'],
        newCharsThisWeek: ['我'],
        priorSummary: '',
        tone: 'standard',
      }),
    ).rejects.toThrow(StoryGenerationError);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/unit/lib/ai/deepseek-story.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/ai/deepseek-story.ts`**

```ts
import { deepseek } from '@ai-sdk/deepseek';
import { generateObject } from 'ai';
import { z } from 'zod';
import { StoryGenerationError } from '@/lib/errors/story-errors';

const MODEL_ID = 'deepseek-v4-pro';
const model = deepseek(MODEL_ID);

export const StoryChapterOutputSchema = z.object({
  body_zh: z.string().min(1),
  body_en: z.string().min(1),
  summary_for_next: z.string().min(1),
});

export type StoryToneLiteral = 'triumphant' | 'standard' | 'narrow_escape';

export interface BuildPromptInput {
  heroName: string;
  heroAppearance: string;
  petHint: string | null;
  availableChars: string[];
  newCharsThisWeek: string[];
  priorSummary: string;
  tone: StoryToneLiteral;
}

const SYSTEM_PROMPT = `You are a children's book author writing a bilingual pirate adventure chapter book for a 6-year-old English-native heritage learner of Mandarin Chinese. The hero is always the same child. Each chapter is a short scene in their ongoing adventure.

Output strict JSON with three fields:
- body_zh: Chinese text, 2-3 short sentences. Use only Chinese characters from the provided "available characters" list. Favor characters from "this week's new vocab" — they should appear at least once each. Sentences must be natural and readable at age-6 level.
- body_en: English text, 40-60 words. Tells the same scene as body_zh but with richer detail and warmth. Names characters and places by name. Conveys the requested tone strongly.
- summary_for_next: 2 bullets (each prefixed "- ") summarizing what just happened in this chapter, written so the next chapter's author can pick up the thread. Mention any objects, allies, or locations introduced.

Do not use any character outside the available list in body_zh. Do not write more than 3 sentences in body_zh.`;

const TONE_INSTRUCTIONS: Record<StoryToneLiteral, string> = {
  triumphant:
    'Yinuo crushed the boss with no mistakes. Write a victorious scene where she emerges in glory, the crew cheers, the treasure is rich.',
  standard:
    'Yinuo cleared the boss with a few stumbles. Write a satisfying scene where she finds what she\'s looking for through cleverness.',
  narrow_escape:
    'Yinuo barely cleared the boss. Write a scene where things went sideways but she scraped through with quick thinking. The treasure is modest but real.',
};

export function buildStoryUserPrompt(input: BuildPromptInput): string {
  const petLine = input.petHint
    ? `Her companion is ${input.petHint}.`
    : '';
  const priorLine = input.priorSummary.trim()
    ? `Previous chapter ended with:\n${input.priorSummary}`
    : 'Previous chapter ended with:\n[This is the first chapter — start the adventure on the docks of a sunny port town.]';
  return [
    `Hero name: ${input.heroName}`,
    `Hero appearance: ${input.heroAppearance}. ${petLine}`.trim(),
    '',
    'Available Chinese characters (use only these in body_zh):',
    input.availableChars.join(', '),
    '',
    "This week's new vocab (favor these in body_zh):",
    input.newCharsThisWeek.join(', '),
    '',
    priorLine,
    '',
    `Tone for this chapter: ${input.tone}`,
    TONE_INSTRUCTIONS[input.tone],
    '',
    'Output strict JSON only. No commentary.',
  ].join('\n');
}

export interface StoryChapterOutput {
  bodyZh: string;
  bodyEn: string;
  summaryForNext: string;
}

export async function generateStoryChapterWithAI(
  input: BuildPromptInput,
): Promise<StoryChapterOutput> {
  try {
    const { object } = await generateObject({
      model,
      schema: StoryChapterOutputSchema,
      system: SYSTEM_PROMPT,
      prompt: buildStoryUserPrompt(input),
    });
    return {
      bodyZh: object.body_zh,
      bodyEn: object.body_en,
      summaryForNext: object.summary_for_next,
    };
  } catch (err) {
    throw new StoryGenerationError(
      `DeepSeek story generation failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
      err,
    );
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/lib/ai/deepseek-story.test.ts`

Expected: PASS all describe blocks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/deepseek-story.ts tests/unit/lib/ai/deepseek-story.test.ts
git commit -m "feat(pr48): DeepSeek story prompt builder + caller"
```

---

### Task 6: `generateStoryChapter` server action + trophy grant integration

The orchestration action that pulls context, derives tone, calls DeepSeek, persists, and grants the trophy. Also extends `TrophyCheckContext` to support the new kind.

**Files:**
- Modify: `src/lib/db/trophies.ts` (add new kind to `TrophyCheckContext` + switch case)
- Modify: `scripts/seed-trophies.ts` (add `first-chapter` trophy + extend `Category` literal type)
- Create: `src/lib/actions/story.ts`
- Test: `tests/unit/lib/actions/story.test.ts`

- [ ] **Step 1: Extend `TrophyCheckContext` in `src/lib/db/trophies.ts`**

Update the discriminated union:

```ts
export type TrophyCheckContext =
  | { kind: 'boss-clear'; weekId: string }
  | { kind: 'perfect-week'; weekId: string }
  | { kind: 'level-complete' }
  | { kind: 'coin-award' }
  | { kind: 'pack-complete'; packSlug: string }
  | { kind: 'scene-clear'; sceneType: string; score: number }
  | { kind: 'sound-theme-equip'; slug: string | null }
  | { kind: 'decor-purchase' }
  | { kind: 'story-chapter-generated' };
```

Then in the `switch (context.kind)` block inside `checkAndGrantTrophies`, add:

```ts
case 'story-chapter-generated': {
  slugs.add('first-chapter');
  break;
}
```

Granting is idempotent at the DB layer (an existing `INSERT … ON CONFLICT DO NOTHING` upsert into `child_trophies`) — repeated calls won't double-grant.

- [ ] **Step 2: Add `first-chapter` to `scripts/seed-trophies.ts`**

First, extend the local `Category` literal type:

```ts
type Category = 'mastery' | 'streak' | 'collection' | 'coins' | 'practice' | 'story';
```

Then append to the `TROPHIES` array:

```ts
{
  slug: 'first-chapter',
  emoji: '📖',
  nameZh: '第一章',
  nameEn: 'First Chapter',
  descriptionZh: '解锁你的第一章故事',
  descriptionEn: 'Unlock your first story chapter',
  loreZh: '海盗日记的第一页翻开了。',
  loreEn: "Page one of your pirate's log is open.",
  category: 'story',
  displayOrder: 100,
},
```

- [ ] **Step 3: Write failing tests `tests/unit/lib/actions/story.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbStoryMock = vi.hoisted(() => ({
  upsertStoryChapter: vi.fn(),
  getStoryChapterByWeek: vi.fn(),
  getLatestBossScoreForChildWeek: vi.fn(),
  getCharactersAvailableForChildWeek: vi.fn(),
  markChapterRead: vi.fn(),
}));
vi.mock('@/lib/db/story', () => dbStoryMock);

const aiMock = vi.hoisted(() => ({
  generateStoryChapterWithAI: vi.fn(),
}));
vi.mock('@/lib/ai/deepseek-story', () => aiMock);

const trophiesMock = vi.hoisted(() => ({
  checkAndGrantTrophies: vi.fn(() => Promise.resolve([])),
}));
vi.mock('@/lib/db/trophies', () => trophiesMock);

const authMock = vi.hoisted(() => ({
  requireChild: vi.fn(),
}));
vi.mock('@/lib/auth', () => authMock);

const childDbMock = vi.hoisted(() => ({
  getEquippedAvatar: vi.fn(),
  getEquippedPet: vi.fn(),
}));
vi.mock('@/lib/db/shop', () => childDbMock);

const cacheMock = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));
vi.mock('next/cache', () => cacheMock);

const weeksDbMock = vi.hoisted(() => ({
  getWeekCharsForCompile: vi.fn(),
  getPlayableWeekForChild: vi.fn(),
}));
vi.mock('@/lib/db/weeks', () => weeksDbMock);

const charsDbMock = vi.hoisted(() => ({
  listCharsForWeek: vi.fn(),
}));
vi.mock('@/lib/db/characters', () => charsDbMock);

beforeEach(() => {
  vi.clearAllMocks();
  authMock.requireChild.mockResolvedValue({
    child: { id: 'k1', displayName: 'Yinuo' },
  });
  weeksDbMock.getPlayableWeekForChild.mockResolvedValue({ id: 'w1' });
  charsDbMock.listCharsForWeek.mockResolvedValue([{ simplified: '红' }]);
  dbStoryMock.getCharactersAvailableForChildWeek.mockResolvedValue([
    '我',
    '红',
  ]);
  childDbMock.getEquippedAvatar.mockResolvedValue({
    head: 'kid-default',
    hat: 'red-bandana',
    top: 'striped-tee',
    background: 'ocean-frame',
  });
  childDbMock.getEquippedPet.mockResolvedValue({ slug: 'parrot-perch' });
});

describe('generateStoryChapter', () => {
  it('returns existing chapter without re-calling AI', async () => {
    const existing = { id: 'c1', weekId: 'w1' };
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(existing);
    const { generateStoryChapter } = await import('@/lib/actions/story');
    const result = await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(result).toEqual(existing);
    expect(aiMock.generateStoryChapterWithAI).not.toHaveBeenCalled();
    expect(trophiesMock.checkAndGrantTrophies).not.toHaveBeenCalled();
  });

  it('derives tone=triumphant when boss score >= 95', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(100);
    aiMock.generateStoryChapterWithAI.mockResolvedValueOnce({
      bodyZh: 'x', bodyEn: 'y', summaryForNext: '- z',
    });
    dbStoryMock.upsertStoryChapter.mockResolvedValueOnce({ id: 'cN', tone: 'triumphant' });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(aiMock.generateStoryChapterWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'triumphant' }),
    );
    expect(dbStoryMock.upsertStoryChapter).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'triumphant', bossScorePct: 100 }),
    );
  });

  it('derives tone=narrow_escape when boss score < 67', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(50);
    aiMock.generateStoryChapterWithAI.mockResolvedValueOnce({
      bodyZh: 'x', bodyEn: 'y', summaryForNext: '- z',
    });
    dbStoryMock.upsertStoryChapter.mockResolvedValueOnce({ id: 'cN', tone: 'narrow_escape' });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(aiMock.generateStoryChapterWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'narrow_escape' }),
    );
  });

  it('uses tone=standard for mid-range scores (e.g. 80)', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(80);
    aiMock.generateStoryChapterWithAI.mockResolvedValueOnce({
      bodyZh: 'x', bodyEn: 'y', summaryForNext: '- z',
    });
    dbStoryMock.upsertStoryChapter.mockResolvedValueOnce({ id: 'cN', tone: 'standard' });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(aiMock.generateStoryChapterWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'standard' }),
    );
  });

  it('grants the first-chapter trophy after successful insert', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(80);
    aiMock.generateStoryChapterWithAI.mockResolvedValueOnce({
      bodyZh: 'x', bodyEn: 'y', summaryForNext: '- z',
    });
    dbStoryMock.upsertStoryChapter.mockResolvedValueOnce({ id: 'cN', tone: 'standard' });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(trophiesMock.checkAndGrantTrophies).toHaveBeenCalledWith('k1', {
      kind: 'story-chapter-generated',
    });
  });

  it('does NOT grant trophy when the chapter already existed', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce({ id: 'c1' });
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await generateStoryChapter({ childId: 'k1', weekId: 'w1' });
    expect(trophiesMock.checkAndGrantTrophies).not.toHaveBeenCalled();
  });

  it('throws StoryGenerationError when AI fails', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    dbStoryMock.getLatestBossScoreForChildWeek.mockResolvedValueOnce(80);
    const { StoryGenerationError } = await import('@/lib/errors/story-errors');
    aiMock.generateStoryChapterWithAI.mockRejectedValueOnce(
      new StoryGenerationError('boom'),
    );
    const { generateStoryChapter } = await import('@/lib/actions/story');
    await expect(
      generateStoryChapter({ childId: 'k1', weekId: 'w1' }),
    ).rejects.toThrow(StoryGenerationError);
    expect(dbStoryMock.upsertStoryChapter).not.toHaveBeenCalled();
  });
});

describe('markChapterReadAction', () => {
  it('calls markChapterRead and revalidates the home page', async () => {
    const { markChapterReadAction } = await import('@/lib/actions/story');
    await markChapterReadAction({ chapterId: 'c1', childId: 'k1' });
    expect(dbStoryMock.markChapterRead).toHaveBeenCalledWith('c1', 'k1');
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith('/play/k1');
  });
});
```

- [ ] **Step 4: Run tests to verify failure**

Run: `pnpm vitest run tests/unit/lib/actions/story.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 5: Create `src/lib/actions/story.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireChild } from '@/lib/auth';
import { generateStoryChapterWithAI } from '@/lib/ai/deepseek-story';
import { resolveNarrativeHint } from '@/lib/avatar/itemCatalog';
import { getEquippedAvatar, getEquippedPet } from '@/lib/db/shop';
import {
  getCharactersAvailableForChildWeek,
  getLatestBossScoreForChildWeek,
  getStoryChapterByWeek,
  markChapterRead,
  upsertStoryChapter,
  type StoryChapterRow,
  type StoryTone,
} from '@/lib/db/story';
import { checkAndGrantTrophies } from '@/lib/db/trophies';
import { listCharsForWeek } from '@/lib/db/characters';
import { getPlayableWeekForChild } from '@/lib/db/weeks';

const GenerateInputSchema = z.object({
  childId: z.string(),
  weekId: z.string(),
});

function toneFromScore(scorePct: number): StoryTone {
  if (scorePct >= 95) return 'triumphant';
  if (scorePct < 67) return 'narrow_escape';
  return 'standard';
}

async function buildHeroAppearance(childId: string): Promise<{
  heroAppearance: string;
  petHint: string | null;
}> {
  const equippedAvatar = await getEquippedAvatar(childId);
  const equippedPet = await getEquippedPet(childId);
  const parts: string[] = [];
  if (equippedAvatar?.hat) {
    parts.push(resolveNarrativeHint(equippedAvatar.hat));
  }
  if (equippedAvatar?.top) {
    parts.push(resolveNarrativeHint(equippedAvatar.top));
  }
  const heroAppearance =
    parts.length > 0 ? parts.join(' and ') : 'a young pirate kid';
  const petHint = equippedPet?.slug
    ? resolveNarrativeHint(equippedPet.slug)
    : null;
  return { heroAppearance, petHint };
}

async function getPriorChapterSummary(
  childId: string,
  weekId: string,
): Promise<string> {
  // The prior chapter is the most recent chapter that is NOT for this week.
  // Implementation: list chapters for child sorted newest-first; find the
  // first whose weekId !== current. Empty string when first chapter ever.
  const { listStoryChaptersForChild } = await import('@/lib/db/story');
  const chapters = await listStoryChaptersForChild(childId);
  const prior = chapters.find((c) => c.weekId !== weekId);
  return prior?.summaryForNext ?? '';
}

export async function generateStoryChapter(
  input: z.input<typeof GenerateInputSchema>,
): Promise<StoryChapterRow> {
  const parsed = GenerateInputSchema.parse(input);
  const { child } = await requireChild(parsed.childId);

  const existing = await getStoryChapterByWeek(child.id, parsed.weekId);
  if (existing) return existing;

  // Sanity: the week must be playable for this child. Throws if not.
  const week = await getPlayableWeekForChild(child.id, parsed.weekId);
  if (!week) throw new Error('generateStoryChapter: week not playable');

  const bossScorePct = await getLatestBossScoreForChildWeek(
    child.id,
    parsed.weekId,
  );
  const tone = toneFromScore(bossScorePct);

  const [availableChars, weekChars, hero, priorSummary] = await Promise.all([
    getCharactersAvailableForChildWeek(child.id, parsed.weekId),
    listCharsForWeek(parsed.weekId),
    buildHeroAppearance(child.id),
    getPriorChapterSummary(child.id, parsed.weekId),
  ]);

  const newCharsThisWeek = weekChars.map((c) => c.simplified ?? c.text);

  const ai = await generateStoryChapterWithAI({
    heroName: child.displayName ?? 'Yinuo',
    heroAppearance: hero.heroAppearance,
    petHint: hero.petHint,
    availableChars,
    newCharsThisWeek,
    priorSummary,
    tone,
  });

  const row = await upsertStoryChapter({
    childId: child.id,
    weekId: parsed.weekId,
    bodyZh: ai.bodyZh,
    bodyEn: ai.bodyEn,
    summaryForNext: ai.summaryForNext,
    tone,
    bossScorePct,
  });

  await checkAndGrantTrophies(child.id, { kind: 'story-chapter-generated' });
  return row;
}

const MarkReadSchema = z.object({
  chapterId: z.string(),
  childId: z.string(),
});

export async function markChapterReadAction(
  input: z.input<typeof MarkReadSchema>,
): Promise<{ ok: true }> {
  const parsed = MarkReadSchema.parse(input);
  const { child } = await requireChild(parsed.childId);
  await markChapterRead(parsed.chapterId, child.id);
  revalidatePath(`/play/${child.id}`);
  return { ok: true };
}
```

> **Note for implementer:** if `getEquippedAvatar` / `getEquippedPet` / `listCharsForWeek` / `getPlayableWeekForChild` / `requireChild` live at different import paths in the existing codebase, adjust the imports. The mock paths in the test file (`@/lib/db/shop`, `@/lib/db/characters`, `@/lib/db/weeks`, `@/lib/auth`) should match the real ones — update both the action's imports and the test's `vi.mock` paths together if you have to relocate.

- [ ] **Step 6: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/lib/actions/story.test.ts`

Expected: PASS all describe blocks.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/story.ts src/lib/db/trophies.ts scripts/seed-trophies.ts tests/unit/lib/actions/story.test.ts
git commit -m "feat(pr48): generateStoryChapter action + first-chapter trophy"
```

---

### Task 7: Wire eager generation into `finishLevelAction`

When the boss is cleared (and wasn't already cleared), fire-and-forget `generateStoryChapter` so the chapter is usually ready by the time Yinuo taps the button.

**Files:**
- Modify: `src/lib/actions/play.ts` (around the existing `if (bossCleared && !alreadyAwarded)` block at ~line 244)
- Test: `tests/unit/lib/actions/play.test.ts` — extend with one new test (or create a new test file if extending is risky)

- [ ] **Step 1: Locate the boss-cleared branch**

Run: `grep -n "if (bossCleared" src/lib/actions/play.ts`

Expected output shows a line like `if (bossCleared && !alreadyAwarded) {` — this is where to add the eager call.

- [ ] **Step 2: Add the fire-and-forget call**

Inside the `if (bossCleared && !alreadyAwarded)` block, at the end (after the coin award + perfect-week branch), add:

```ts
// Eager story generation — fire and forget. Boss completion MUST NOT
// depend on this; the story page synchronously regenerates if missing.
import('@/lib/actions/story')
  .then(({ generateStoryChapter }) =>
    generateStoryChapter({ childId: child.id, weekId: parsed.weekId }),
  )
  .catch((err) => {
    console.error('[finishLevelAction] eager story gen failed:', err);
  });
```

Dynamic `import()` is used (rather than a top-level static import) to keep `play.ts` from pulling in `story.ts` synchronously — the deferred load is fine since the call is already fire-and-forget.

- [ ] **Step 3: Write a test verifying eager-fire happens once on boss-clear**

If `tests/unit/lib/actions/play.test.ts` already exists, add a new `describe`. Otherwise create a new file `tests/unit/lib/actions/play-story-trigger.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

// All the existing finishLevelAction mocks (db, clerk, etc.) need to be
// here too — copy from the existing play action test file and extend with:

const storyMock = vi.hoisted(() => ({
  generateStoryChapter: vi.fn(() => Promise.resolve({})),
}));
vi.mock('@/lib/actions/story', () => storyMock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('finishLevelAction boss-clear story trigger', () => {
  it('fires generateStoryChapter once on first boss-clear', async () => {
    // Arrange: mock the play.ts dependencies to land in the bossCleared &&
    // !alreadyAwarded branch. See the existing play action test for the
    // exact setup; mirror it here.
    // … (full setup omitted — copy from existing test file)
    const { finishLevelAction } = await import('@/lib/actions/play');
    await finishLevelAction({
      childId: 'k1',
      weekId: 'w1',
      sessionId: 's1',
      totalScenesPassed: 14,
      totalScenesInWeek: 14,
      durationSeconds: 600,
    });
    // Allow the fire-and-forget microtask to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(storyMock.generateStoryChapter).toHaveBeenCalledWith({
      childId: 'k1',
      weekId: 'w1',
    });
  });

  it('does NOT fire generateStoryChapter on a re-clear (alreadyAwarded)', async () => {
    // Arrange: existing.bossCleared = true so alreadyAwarded === true
    // … (full setup omitted — copy from existing test file)
    const { finishLevelAction } = await import('@/lib/actions/play');
    await finishLevelAction({
      childId: 'k1',
      weekId: 'w1',
      sessionId: 's1',
      totalScenesPassed: 14,
      totalScenesInWeek: 14,
      durationSeconds: 600,
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(storyMock.generateStoryChapter).not.toHaveBeenCalled();
  });

  it('swallows story gen errors without breaking boss completion', async () => {
    storyMock.generateStoryChapter.mockRejectedValueOnce(new Error('boom'));
    // Arrange first-clear scenario as in test 1.
    const { finishLevelAction } = await import('@/lib/actions/play');
    const result = await finishLevelAction({
      childId: 'k1',
      weekId: 'w1',
      sessionId: 's1',
      totalScenesPassed: 14,
      totalScenesInWeek: 14,
      durationSeconds: 600,
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(result.ok).toBe(true);
    expect(result.bossCleared).toBe(true);
  });
});
```

> **Implementer note:** the existing `tests/unit/lib/actions/play.test.ts` file (if present) already has the full mock scaffolding for `finishLevelAction`. Use its setup as the template — the only difference is adding the `@/lib/actions/story` mock.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/lib/actions/play-story-trigger.test.ts`
(or the appropriate file name)

Expected: PASS all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/play.ts tests/unit/lib/actions/play-story-trigger.test.ts
git commit -m "feat(pr48): fire eager story gen on first boss-clear"
```

---

### Task 8: `ChapterAudioButton` (client component, Web Speech API)

A `'use client'` 🔊 button that calls `window.speechSynthesis.speak()` with zh-CN.

**Files:**
- Create: `src/components/play/story/ChapterAudioButton.tsx`
- Test: `tests/unit/components/play/story/ChapterAudioButton.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChapterAudioButton } from '@/components/play/story/ChapterAudioButton';

describe('ChapterAudioButton', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the audio button when speechSynthesis is available', () => {
    vi.stubGlobal('speechSynthesis', {
      speak: vi.fn(),
      cancel: vi.fn(),
    });
    render(<ChapterAudioButton text="你好" />);
    expect(
      screen.getByRole('button', { name: /read aloud|读/i }),
    ).toBeInTheDocument();
  });

  it('renders nothing when speechSynthesis is unavailable', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    const { container } = render(<ChapterAudioButton text="你好" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls speechSynthesis.speak with a zh-CN utterance on click', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string;
        lang = '';
        rate = 1;
        constructor(t: string) {
          this.text = t;
        }
      } as any,
    );
    render(<ChapterAudioButton text="你好" />);
    fireEvent.click(screen.getByRole('button'));
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledOnce();
    const utt = speak.mock.calls[0]![0] as any;
    expect(utt.text).toBe('你好');
    expect(utt.lang).toBe('zh-CN');
    expect(utt.rate).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/unit/components/play/story/ChapterAudioButton.test.tsx`

Expected: FAIL — component not found.

- [ ] **Step 3: Create the component**

```tsx
'use client';

import { useEffect, useState } from 'react';

export function ChapterAudioButton({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' && 'speechSynthesis' in window,
    );
  }, []);

  if (!supported) return null;

  const speak = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'zh-CN';
    utt.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  };

  return (
    <button
      type="button"
      onClick={speak}
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-200"
      aria-label="Read aloud"
    >
      <span aria-hidden>🔊</span>
      <span>Read aloud</span>
    </button>
  );
}
```

Note: this component intentionally renders `null` on the server (`supported=false` initially), then re-renders client-side once the effect runs. That avoids hydration mismatch flicker.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/components/play/story/ChapterAudioButton.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/play/story/ChapterAudioButton.tsx tests/unit/components/play/story/ChapterAudioButton.test.tsx
git commit -m "feat(pr48): ChapterAudioButton (web speech zh-CN)"
```

---

### Task 9: `ChapterBody` component

Renders ZH text, the audio button, and EN text in sequence.

**Files:**
- Create: `src/components/play/story/ChapterBody.tsx`
- Test: `tests/unit/components/play/story/ChapterBody.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChapterBody } from '@/components/play/story/ChapterBody';

describe('ChapterBody', () => {
  it('renders ZH text, audio button, and EN text', () => {
    render(
      <ChapterBody
        bodyZh="小红花。"
        bodyEn="A small red flower."
      />,
    );
    expect(screen.getByText('小红花。')).toBeInTheDocument();
    expect(screen.getByText('A small red flower.')).toBeInTheDocument();
  });

  it('ZH text appears before EN text in document order', () => {
    render(<ChapterBody bodyZh="一" bodyEn="One" />);
    const zh = screen.getByText('一');
    const en = screen.getByText('One');
    expect(zh.compareDocumentPosition(en)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/unit/components/play/story/ChapterBody.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/play/story/ChapterBody.tsx`**

```tsx
import { ChapterAudioButton } from './ChapterAudioButton';

interface ChapterBodyProps {
  bodyZh: string;
  bodyEn: string;
}

export function ChapterBody({ bodyZh, bodyEn }: ChapterBodyProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-amber-50/80 px-5 py-4 shadow-inner">
        <p className="text-2xl leading-relaxed text-amber-900">{bodyZh}</p>
        <div className="mt-3">
          <ChapterAudioButton text={bodyZh} />
        </div>
      </div>
      <div className="rounded-2xl bg-white/70 px-5 py-4">
        <p className="text-base leading-relaxed text-stone-700">{bodyEn}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/components/play/story/ChapterBody.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/play/story/ChapterBody.tsx tests/unit/components/play/story/ChapterBody.test.tsx
git commit -m "feat(pr48): ChapterBody (ZH text + audio + EN text)"
```

---

### Task 10: `ChapterCard` component

Hero card with `AvatarRender`, equipped pet, chapter number, and tone-specific border.

**Files:**
- Create: `src/components/play/story/ChapterCard.tsx`
- Test: `tests/unit/components/play/story/ChapterCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/play/AvatarRender', () => ({
  AvatarRender: ({ childId }: any) => (
    <div data-testid="avatar" data-child={childId} />
  ),
}));

vi.mock('@/components/play/pets/PetRender', () => ({
  PetRender: ({ slug }: any) => (
    <div data-testid="pet" data-slug={slug} />
  ),
}));

import { ChapterCard } from '@/components/play/story/ChapterCard';

describe('ChapterCard', () => {
  it('renders avatar + chapter number', () => {
    render(
      <ChapterCard
        childId="k1"
        chapterNumber={3}
        tone="standard"
        petSlug={null}
      />,
    );
    expect(screen.getByTestId('avatar')).toHaveAttribute('data-child', 'k1');
    expect(screen.getByText(/Chapter 3|第3章/)).toBeInTheDocument();
  });

  it('renders the pet when petSlug is set', () => {
    render(
      <ChapterCard
        childId="k1"
        chapterNumber={1}
        tone="standard"
        petSlug="parrot-perch"
      />,
    );
    expect(screen.getByTestId('pet')).toHaveAttribute(
      'data-slug',
      'parrot-perch',
    );
  });

  it('applies triumphant border class', () => {
    const { container } = render(
      <ChapterCard
        childId="k1"
        chapterNumber={1}
        tone="triumphant"
        petSlug={null}
      />,
    );
    expect(container.firstChild).toHaveClass('border-amber-400');
  });

  it('applies narrow_escape border class', () => {
    const { container } = render(
      <ChapterCard
        childId="k1"
        chapterNumber={1}
        tone="narrow_escape"
        petSlug={null}
      />,
    );
    expect(container.firstChild).toHaveClass('border-dashed');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/unit/components/play/story/ChapterCard.test.tsx`

Expected: FAIL — `ChapterCard` not found.

- [ ] **Step 3: Create `src/components/play/story/ChapterCard.tsx`**

```tsx
import { AvatarRender } from '@/components/play/AvatarRender';
import { PetRender } from '@/components/play/pets/PetRender';
import type { StoryTone } from '@/lib/db/story';

interface ChapterCardProps {
  childId: string;
  chapterNumber: number;
  tone: StoryTone;
  petSlug: string | null;
}

const TONE_BORDER: Record<StoryTone, string> = {
  triumphant: 'border-4 border-amber-400 shadow-lg shadow-amber-300/40',
  standard: 'border-2 border-stone-300',
  narrow_escape: 'border-2 border-dashed border-stone-400 opacity-95',
};

export function ChapterCard({
  childId,
  chapterNumber,
  tone,
  petSlug,
}: ChapterCardProps) {
  return (
    <div
      className={`relative flex flex-col items-center gap-3 rounded-3xl bg-amber-50 px-6 py-6 ${TONE_BORDER[tone]}`}
    >
      <div className="flex items-end gap-2">
        <div className="w-32">
          <AvatarRender childId={childId} />
        </div>
        {petSlug ? (
          <div className="w-16 -translate-y-1">
            <PetRender slug={petSlug} />
          </div>
        ) : null}
      </div>
      <h2 className="text-xl font-bold tracking-wide text-amber-900">
        ✨ 第{chapterNumber}章 / Chapter {chapterNumber} ✨
      </h2>
    </div>
  );
}
```

> **Implementer note:** `PetRender` may not exist as a standalone component yet. If a quick `grep -rn "PetRender\|equippedPet" src/components` shows the pet is rendered inline in IslandMap, you have two options: (a) extract a tiny `PetRender({slug})` component first, mirroring the inline render, or (b) inline the SVG directly here. Prefer (a) — it's a one-file refactor and makes ChapterCard reusable.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/components/play/story/ChapterCard.test.tsx`

Expected: PASS all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add src/components/play/story/ChapterCard.tsx tests/unit/components/play/story/ChapterCard.test.tsx
git commit -m "feat(pr48): ChapterCard (avatar + pet + tone border)"
```

---

### Task 11: Chapter view page + loading skeleton

Server-component route `/play/[childId]/story/[weekId]`. If chapter exists, renders. If not, calls `generateStoryChapter` synchronously inline (Suspense shows the loading skeleton).

**Files:**
- Create: `src/app/play/[childId]/story/[weekId]/page.tsx`
- Create: `src/app/play/[childId]/story/[weekId]/loading.tsx`
- Create: `src/components/play/MarkChapterReadOnMount.tsx`
- Test: `tests/unit/app/story-page.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const dbStoryMock = vi.hoisted(() => ({
  getStoryChapterByWeek: vi.fn(),
  listStoryChaptersForChild: vi.fn(() => Promise.resolve([])),
}));
vi.mock('@/lib/db/story', () => dbStoryMock);

const actionMock = vi.hoisted(() => ({
  generateStoryChapter: vi.fn(),
  markChapterReadAction: vi.fn(),
}));
vi.mock('@/lib/actions/story', () => actionMock);

const authMock = vi.hoisted(() => ({
  requireChild: vi.fn(() =>
    Promise.resolve({ child: { id: 'k1', displayName: 'Yinuo' } }),
  ),
}));
vi.mock('@/lib/auth', () => authMock);

const petMock = vi.hoisted(() => ({
  getEquippedPet: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/lib/db/shop', () => petMock);

vi.mock('@/components/play/story/ChapterCard', () => ({
  ChapterCard: ({ chapterNumber }: any) => (
    <div data-testid="card">Chapter {chapterNumber}</div>
  ),
}));
vi.mock('@/components/play/story/ChapterBody', () => ({
  ChapterBody: ({ bodyZh, bodyEn }: any) => (
    <div data-testid="body">
      {bodyZh}|{bodyEn}
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Chapter view page', () => {
  it('renders the existing chapter without re-calling generate', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce({
      id: 'c1',
      weekId: 'w1',
      bodyZh: '哈',
      bodyEn: 'Ha',
      tone: 'standard',
      createdAt: new Date(),
    });
    const Page = (await import('@/app/play/[childId]/story/[weekId]/page'))
      .default;
    const ui = await Page({
      params: Promise.resolve({ childId: 'k1', weekId: 'w1' }),
    });
    render(ui);
    expect(screen.getByTestId('body')).toHaveTextContent('哈|Ha');
    expect(actionMock.generateStoryChapter).not.toHaveBeenCalled();
  });

  it('falls back to synchronous generation when chapter is missing', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    actionMock.generateStoryChapter.mockResolvedValueOnce({
      id: 'c1',
      weekId: 'w1',
      bodyZh: 'X',
      bodyEn: 'Y',
      tone: 'standard',
      createdAt: new Date(),
    });
    const Page = (await import('@/app/play/[childId]/story/[weekId]/page'))
      .default;
    const ui = await Page({
      params: Promise.resolve({ childId: 'k1', weekId: 'w1' }),
    });
    render(ui);
    expect(actionMock.generateStoryChapter).toHaveBeenCalledWith({
      childId: 'k1',
      weekId: 'w1',
    });
    expect(screen.getByTestId('body')).toHaveTextContent('X|Y');
  });

  it('renders an error UI when generation throws', async () => {
    dbStoryMock.getStoryChapterByWeek.mockResolvedValueOnce(null);
    actionMock.generateStoryChapter.mockRejectedValueOnce(
      new Error('deepseek down'),
    );
    const Page = (await import('@/app/play/[childId]/story/[weekId]/page'))
      .default;
    const ui = await Page({
      params: Promise.resolve({ childId: 'k1', weekId: 'w1' }),
    });
    render(ui);
    expect(screen.getByText(/try again|再试一次/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/unit/app/story-page.test.tsx`

Expected: FAIL — page not found.

- [ ] **Step 3: Create `src/app/play/[childId]/story/[weekId]/loading.tsx`**

```tsx
export default function StoryLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-4xl">✨</div>
      <p className="text-lg font-medium text-amber-900">
        Captain Yinuo&apos;s Log is being written…
      </p>
      <p className="text-sm text-stone-600">⏳ 故事正在写...</p>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/play/MarkChapterReadOnMount.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { markChapterReadAction } from '@/lib/actions/story';

interface Props {
  chapterId: string;
  childId: string;
  shouldMark: boolean;
}

export function MarkChapterReadOnMount({
  chapterId,
  childId,
  shouldMark,
}: Props) {
  useEffect(() => {
    if (!shouldMark) return;
    markChapterReadAction({ chapterId, childId }).catch(() => {
      // Non-fatal — pill will simply remain on next load.
    });
  }, [chapterId, childId, shouldMark]);
  return null;
}
```

- [ ] **Step 5: Create `src/app/play/[childId]/story/[weekId]/page.tsx`**

```tsx
import Link from 'next/link';
import { requireChild } from '@/lib/auth';
import { generateStoryChapter } from '@/lib/actions/story';
import {
  getStoryChapterByWeek,
  listStoryChaptersForChild,
  type StoryChapterRow,
} from '@/lib/db/story';
import { getEquippedPet } from '@/lib/db/shop';
import { ChapterCard } from '@/components/play/story/ChapterCard';
import { ChapterBody } from '@/components/play/story/ChapterBody';
import { MarkChapterReadOnMount } from '@/components/play/MarkChapterReadOnMount';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

async function loadChapter(
  childId: string,
  weekId: string,
): Promise<{ chapter: StoryChapterRow } | { error: string }> {
  const existing = await getStoryChapterByWeek(childId, weekId);
  if (existing) return { chapter: existing };
  try {
    const chapter = await generateStoryChapter({ childId, weekId });
    return { chapter };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : 'Story generation failed.',
    };
  }
}

export default async function StoryChapterPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  const { child } = await requireChild(childId);

  const result = await loadChapter(child.id, weekId);

  if ('error' in result) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-8 text-center">
        <Link
          href={`/play/${child.id}`}
          className="self-start text-sm text-stone-600 hover:text-stone-900"
        >
          ← 回家
        </Link>
        <div className="rounded-3xl bg-rose-50 px-6 py-6">
          <p className="text-lg font-medium text-rose-800">
            📖 Story could not be written this time.
          </p>
          <p className="mt-2 text-sm text-rose-700">{result.error}</p>
          <Link
            href={`/play/${child.id}/story/${weekId}`}
            className="mt-4 inline-block rounded-full bg-rose-600 px-4 py-2 text-white"
          >
            再试一次 / Try again
          </Link>
        </div>
      </main>
    );
  }

  const { chapter } = result;
  const allChapters = await listStoryChaptersForChild(child.id);
  const chapterNumber =
    allChapters.findIndex((c) => c.id === chapter.id) === -1
      ? allChapters.length + 1
      : allChapters.length - allChapters.findIndex((c) => c.id === chapter.id);

  const equippedPet = await getEquippedPet(child.id);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
      <Link
        href={`/play/${child.id}`}
        className="self-start text-sm text-stone-600 hover:text-stone-900"
      >
        ← 回家
      </Link>
      <ChapterCard
        childId={child.id}
        chapterNumber={chapterNumber}
        tone={chapter.tone}
        petSlug={equippedPet?.slug ?? null}
      />
      <ChapterBody bodyZh={chapter.bodyZh} bodyEn={chapter.bodyEn} />
      <Link
        href={`/play/${child.id}`}
        className="self-center rounded-full bg-amber-600 px-6 py-2 text-white shadow"
      >
        回家
      </Link>
      <MarkChapterReadOnMount
        chapterId={chapter.id}
        childId={child.id}
        shouldMark={chapter.readAt === null}
      />
    </main>
  );
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/app/story-page.test.tsx`

Expected: PASS all 3 cases.

- [ ] **Step 7: Commit**

```bash
git add src/app/play/[childId]/story/[weekId]/page.tsx src/app/play/[childId]/story/[weekId]/loading.tsx src/components/play/MarkChapterReadOnMount.tsx tests/unit/app/story-page.test.tsx
git commit -m "feat(pr48): chapter view page + sync-fallback gen + mark-read"
```

---

### Task 12: `LatestChapterPill` component

Renders a home page pill linking to the most recent unread chapter. Hides when no unread chapter exists.

**Files:**
- Create: `src/components/play/LatestChapterPill.tsx`
- Test: `tests/unit/components/play/LatestChapterPill.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const dbStoryMock = vi.hoisted(() => ({
  getLatestUnreadChapter: vi.fn(),
}));
vi.mock('@/lib/db/story', () => dbStoryMock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LatestChapterPill', () => {
  it('renders nothing when no unread chapter', async () => {
    dbStoryMock.getLatestUnreadChapter.mockResolvedValueOnce(null);
    const { LatestChapterPill } = await import(
      '@/components/play/LatestChapterPill'
    );
    const ui = await LatestChapterPill({ childId: 'k1' });
    const { container } = render(ui ?? <></>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a link to the latest unread chapter', async () => {
    dbStoryMock.getLatestUnreadChapter.mockResolvedValueOnce({
      id: 'c1',
      weekId: 'w1',
      readAt: null,
    });
    const { LatestChapterPill } = await import(
      '@/components/play/LatestChapterPill'
    );
    const ui = await LatestChapterPill({ childId: 'k1' });
    render(ui ?? <></>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/play/k1/story/w1');
    expect(link).toHaveTextContent(/你最新的故事|latest chapter/i);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/unit/components/play/LatestChapterPill.test.tsx`

Expected: FAIL — component not found.

- [ ] **Step 3: Create the component**

```tsx
import Link from 'next/link';
import { getLatestUnreadChapter } from '@/lib/db/story';

interface Props {
  childId: string;
}

export async function LatestChapterPill({ childId }: Props) {
  const chapter = await getLatestUnreadChapter(childId);
  if (!chapter) return null;
  return (
    <Link
      href={`/play/${childId}/story/${chapter.weekId}`}
      className="block rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-md transition hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-900">
            📖 你最新的故事
          </p>
          <p className="text-xs text-amber-800/80">
            Captain Yinuo&apos;s latest chapter
          </p>
        </div>
        <span aria-hidden className="text-2xl">
          →
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/components/play/LatestChapterPill.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/play/LatestChapterPill.tsx tests/unit/components/play/LatestChapterPill.test.tsx
git commit -m "feat(pr48): LatestChapterPill (home page)"
```

---

### Task 13: Wire `LatestChapterPill` into home page

Mount the pill on `/play/[childId]` between the `WeekStrip` and the `KidNavBar`.

**Files:**
- Modify: `src/app/play/[childId]/page.tsx`

- [ ] **Step 1: Locate the home page layout**

Run: `grep -n "WeekStrip\|KidNavBar\|<main" src/app/play/[childId]/page.tsx`

Expected: shows where `<WeekStrip />` is rendered; that's the insertion point.

- [ ] **Step 2: Add the import and component**

Near the existing imports, add:

```ts
import { LatestChapterPill } from '@/components/play/LatestChapterPill';
```

Inside the JSX, after the `<WeekStrip />` (or equivalently named component) but before any nav rendering, add:

```tsx
<LatestChapterPill childId={child.id} />
```

The pill renders `null` when no unread chapter exists, so there is no need for a conditional wrapper.

- [ ] **Step 3: Run typecheck + tests**

Run: `pnpm typecheck && pnpm vitest run tests/unit/components/play/LatestChapterPill.test.tsx tests/unit/app/`

Expected: both pass; no regressions in any existing home page tests.

- [ ] **Step 4: Commit**

```bash
git add src/app/play/[childId]/page.tsx
git commit -m "feat(pr48): mount LatestChapterPill on home"
```

---

### Task 14: `StoryLibraryGrid` + Story Library page + AtlasHub hall card

The Backpack archive view. New 6th hall card on AtlasHub.

**Files:**
- Create: `src/components/play/story/StoryLibraryGrid.tsx`
- Create: `src/app/play/[childId]/collection/story-library/page.tsx`
- Modify: `src/components/play/AtlasHub.tsx`
- Test: `tests/unit/components/play/story/StoryLibraryGrid.test.tsx`

- [ ] **Step 1: Write failing tests for the grid**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/play/story/ChapterCard', () => ({
  ChapterCard: ({ chapterNumber }: any) => (
    <div data-testid="card">Chapter {chapterNumber}</div>
  ),
}));

import { StoryLibraryGrid } from '@/components/play/story/StoryLibraryGrid';

describe('StoryLibraryGrid', () => {
  it('renders cards newest-first', () => {
    const chapters = [
      { id: 'c3', weekId: 'w3', tone: 'standard', bodyZh: 'c', createdAt: new Date('2026-05-29') },
      { id: 'c2', weekId: 'w2', tone: 'triumphant', bodyZh: 'b', createdAt: new Date('2026-05-22') },
      { id: 'c1', weekId: 'w1', tone: 'narrow_escape', bodyZh: 'a', createdAt: new Date('2026-05-15') },
    ];
    render(
      <StoryLibraryGrid childId="k1" chapters={chapters as any} />,
    );
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(3);
    // First card should be most recent → chapter 3
    expect(cards[0]).toHaveTextContent('Chapter 3');
    expect(cards[2]).toHaveTextContent('Chapter 1');
  });

  it('renders an empty state when no chapters', () => {
    render(<StoryLibraryGrid childId="k1" chapters={[]} />);
    expect(screen.getByText(/no chapters yet|还没有故事/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/unit/components/play/story/StoryLibraryGrid.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Create `src/components/play/story/StoryLibraryGrid.tsx`**

```tsx
import Link from 'next/link';
import { ChapterCard } from './ChapterCard';
import type { StoryChapterRow } from '@/lib/db/story';

interface Props {
  childId: string;
  chapters: StoryChapterRow[];
}

export function StoryLibraryGrid({ childId, chapters }: Props) {
  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl bg-stone-50 px-6 py-12 text-center">
        <p className="text-4xl">📖</p>
        <p className="text-base text-stone-700">还没有故事 / No chapters yet</p>
        <p className="text-sm text-stone-500">
          Clear a week&apos;s boss to write your first chapter.
        </p>
      </div>
    );
  }

  // Chapters arrive newest-first from listStoryChaptersForChild; reverse-index
  // so each card shows the correct in-saga chapter number.
  const total = chapters.length;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {chapters.map((c, idx) => (
        <Link
          key={c.id}
          href={`/play/${childId}/story/${c.weekId}`}
          className="block"
        >
          <ChapterCard
            childId={childId}
            chapterNumber={total - idx}
            tone={c.tone}
            petSlug={null}
          />
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/components/play/story/StoryLibraryGrid.test.tsx`

Expected: PASS both cases.

- [ ] **Step 5: Create `src/app/play/[childId]/collection/story-library/page.tsx`**

```tsx
import Link from 'next/link';
import { requireChild } from '@/lib/auth';
import { listStoryChaptersForChild } from '@/lib/db/story';
import { StoryLibraryGrid } from '@/components/play/story/StoryLibraryGrid';

export default async function StoryLibraryPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const { child } = await requireChild(childId);
  const chapters = await listStoryChaptersForChild(child.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={`/play/${child.id}/collection`}
        className="text-sm text-stone-600 hover:text-stone-900"
      >
        ← 背包
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-amber-900">
        📖 Story Library / 故事书
      </h1>
      <p className="text-sm text-stone-600">
        每周通关 boss 都会写下新的一章。
      </p>
      <div className="mt-6">
        <StoryLibraryGrid childId={child.id} chapters={chapters} />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Add a hall card to `AtlasHub`**

Open `src/components/play/AtlasHub.tsx`. Locate the array/list of hall cards (it'll be a grid of `<AtlasHallCard>` rendering). Add a new card alongside the existing ones:

```tsx
<AtlasHallCard
  href={`/play/${childId}/collection/story-library`}
  emoji="📖"
  nameZh="故事书"
  nameEn="Story Library"
  description="Captain Yinuo's chapters"
/>
```

(Match the actual props of the existing `AtlasHallCard` — if it takes a single `pack` object, follow that pattern instead with a hand-built object.)

- [ ] **Step 7: Run typecheck + tests**

Run: `pnpm typecheck && pnpm vitest run tests/unit/components/play/story/StoryLibraryGrid.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/play/story/StoryLibraryGrid.tsx src/app/play/[childId]/collection/story-library/page.tsx src/components/play/AtlasHub.tsx tests/unit/components/play/story/StoryLibraryGrid.test.tsx
git commit -m "feat(pr48): Story Library page + AtlasHub hall card"
```

---

### Task 15: "📖 Read your chapter" button on boss-complete UI

When the boss section page renders boss-cleared state, expose a button linking to the chapter view.

**Files:**
- Modify: `src/app/play/[childId]/level/[weekId]/[section]/page.tsx`

- [ ] **Step 1: Find the boss-cleared rendering**

Run: `grep -n "section.*boss\|sceneType.*boss\|bossCleared\|return.*boss" src/app/play/[childId]/level/[weekId]/[section]/page.tsx`

Expected: the file routes section ∈ `review | practice | boss`. The boss branch renders a `SceneRunner` (or similar) which fires `finishLevelAction` on completion. The completion UI may live in `SceneRunner` or be rendered server-side after a redirect.

If completion lives client-side inside `SceneRunner`, you'll need to surface the chapter button there. The simplest approach: inside the boss section page, render a "read your chapter" `<Link>` *unconditionally when the boss has been cleared this session*. The session signal is harder to pull server-side, so the cleanest path is:

- After completion, `SceneRunner` already navigates somewhere (likely back to the week hub or the home page). Have it route to `/play/[childId]/story/[weekId]` instead, conditionally on `bossCleared === true`.

Open `src/app/play/[childId]/level/[weekId]/[section]/page.tsx`. Identify where `SceneRunner` is mounted with the boss configuration. Pass a new prop (or set a conditional `nextHref`) so the post-boss destination is the story page.

Concrete change (adjust to fit existing SceneRunner props):

```tsx
// At the boss-section render, where SceneRunner is mounted:
<SceneRunner
  // … existing props …
  postCompletionHref={`/play/${childId}/story/${weekId}`}
/>
```

If `SceneRunner` doesn't accept a `postCompletionHref` prop yet, add one and have it `router.push(postCompletionHref ?? defaultHref)` when complete. Keep the default behavior (redirect to home/week hub) when the prop is omitted.

- [ ] **Step 2: Add a fallback link rendered on the boss section page itself**

If wiring through `SceneRunner` is too invasive, an alternative: render a static link element under the SceneRunner that becomes visible only when the boss is mid-celebration (CSS `:has` or a `useState` in a small client component). The simpler version that always works: render a permanently-visible secondary "📖 Read your latest chapter" link near the bottom of the boss section page that just routes to `/play/[childId]/story/[weekId]`. Yinuo can also reach it from the home pill, so this is a redundant entry point — not a problem.

```tsx
import Link from 'next/link';

// At the bottom of the boss section page render:
<Link
  href={`/play/${childId}/story/${weekId}`}
  className="mt-4 inline-block rounded-full bg-amber-500 px-5 py-2 text-white shadow"
>
  📖 Read your chapter
</Link>
```

- [ ] **Step 3: Manual verification**

This task does not need a new test — its purpose is wiring. Verify with:

```bash
pnpm typecheck
```

Expected: no type errors after the change.

- [ ] **Step 4: Commit**

```bash
git add src/app/play/[childId]/level/[weekId]/[section]/page.tsx
git commit -m "feat(pr48): boss section links to chapter page on clear"
```

---

### Task 16: Final integration verification

End-to-end manual + automated sweep. Catches anything the per-task tests missed.

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `pnpm test`

Expected: ALL tests green. Test count should have grown by ~12 from the baseline 542 → ~554+ (exact count depends on how many sub-cases the implementer wrote per describe).

- [ ] **Step 2: Typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`

Expected: all green. The four-green gate per CLAUDE.md hard rule #2.

- [ ] **Step 3: Manual smoke test via `pnpm dev`**

Start: `pnpm dev`

Walk through (using Clerk test child):
1. Visit `/play/<childId>/story/<weekId>` for a week with no existing chapter → loading skeleton → chapter renders
2. Refresh → chapter renders instantly (cached)
3. Home page → pill renders linking to that chapter; tap it → land on the chapter → return home → pill is gone
4. 🔊 button on iOS Safari (or desktop Chrome): zh-CN voice reads the chapter audibly
5. Backpack → Story Library hall card → grid shows the chapter; tap → re-renders
6. Force-set the latest scene_attempts boss row score to 100 → trigger another week's boss-clear via `finishLevelAction` → chapter for that week generates with `tone='triumphant'` → gold border visible
7. Force-set the latest boss score to 50 → narrow_escape tone → dashed border visible
8. `prefers-reduced-motion` enabled in DevTools → no pill animation, no card animations
9. Trophy 第一章 / First Chapter appears in `/play/<childId>/trophies` after first chapter generation
10. Delete a `story_chapters` row from DB via psql → revisit page → regenerates fresh

- [ ] **Step 4: Update CLAUDE.md current state + landmines**

Open `CLAUDE.md`. In the "Current state" section, add a one-line summary of PR #48. In the "Landmines" section, add the new entries from spec §16:

- DeepSeek structured output can return ZH text with chars outside the "allowed list" — accepted as best-effort; logged but not retried. Don't try to enforce strictly.
- Story Library bypasses `packRegistry` — pattern established for future non-collectible library surfaces.
- Eager generation in `finishLevelAction` is fire-and-forget — boss completion must not depend on it. Preserve the try/catch.
- Chapter `read_at` drives the home pill — `markChapterReadAction` calls `revalidatePath('/play/[childId]')` to keep server-component cache fresh.

Update the "last refreshed" date at the top.

- [ ] **Step 5: Commit CLAUDE.md update**

```bash
git add CLAUDE.md
git commit -m "docs(pr48): record Story Mode in CLAUDE.md (current state + landmines)"
```

- [ ] **Step 6: Open PR**

```bash
git push -u origin feat/pr48-story-mode
gh pr create --title "feat(pr48): Story Mode — Yinuo-as-protagonist generative narrative" --body "$(cat <<'EOF'
## Summary
- New `story_chapters` table; one DeepSeek-generated bilingual chapter per (child, week)
- Boss-score-weighted tone (triumphant / standard / narrow_escape)
- Home page "📖 latest chapter" pill (auto-hides when read)
- Backpack adds Story Library hall card; archive at `/play/[childId]/collection/story-library`
- Web Speech API (zh-CN) audio button on every chapter — free, no infra
- Hero card composes existing `AvatarRender` + equipped pet; no AI image gen in v1
- 1 new trophy (`first-chapter`) + new `story` category

## Test plan
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
- [ ] Smoke: chapter page renders / falls back to sync gen
- [ ] Smoke: 🔊 button plays zh-CN audibly on iOS Safari
- [ ] Smoke: home pill appears + disappears across read state
- [ ] Smoke: Story Library archive accessible from Backpack
- [ ] Smoke: tone correctness across 100 / 80 / 50 boss scores
- [ ] Smoke: reduced-motion preference suppresses animations

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Verify CI is green on the PR**

Wait for CI; confirm all checks pass; do not merge until reviewer approves.

---

## Self-review notes

**Spec coverage check:**

| Spec section | Implementing task(s) |
|---|---|
| §3 In-v1 scope: bilingual chapter per child per week | Task 1, 3, 5, 6 |
| §3 Boss-score tone | Task 6 |
| §3 Rolling memory | Task 5 (`buildStoryUserPrompt` injects priorSummary), Task 6 (`getPriorChapterSummary`) |
| §3 Hero card from avatar + pet | Task 10 |
| §3 Web Speech audio | Task 8 |
| §3 Home pill | Task 12, 13 |
| §3 Backpack Story Library hall card | Task 14 |
| §3 first-chapter trophy + story category | Task 1 (enum), 6 (grant + seed) |
| §3 No AI scene illustration | Implicitly observed — no image-gen call exists in this plan |
| §3 DeepSeek V2 schema extension | Task 5 (`StoryChapterOutputSchema`) |
| §4 Eager fire-and-forget + sync fallback | Task 7 (eager), Task 11 (sync) |
| §5 Schema | Task 1 |
| §5 Generation pipeline | Task 5, 6 |
| §5 Surfaces | Task 11, 12, 13, 14, 15 |
| §6 UI shape | Task 10 (card), 9 (body), 11 (page), 12 (pill) |
| §7 Prompt | Task 5 |
| §8 Audio | Task 8 |
| §9 Error handling | Task 11 (page error UI), Task 7 (eager swallow) |
| §10 Trophy | Task 1, 6 |
| §11 Story Library bypasses packRegistry | Task 14 |
| §12 Tests | every code task ships its own tests |
| §16 Landmines into CLAUDE.md | Task 16 step 4 |

**Placeholder scan:** No "TBD" / "TODO" / "implement appropriately" in the task bodies. Two implementer-note callouts flag fields whose exact names depend on the existing schema (sceneAttempts column, PetRender existence) — those are explicit "verify-then-adjust" instructions, not placeholders.

**Type consistency:** `StoryTone` literal type is the same across `src/lib/db/story.ts` (defined), `src/lib/ai/deepseek-story.ts` (re-aliased as `StoryToneLiteral`), `src/components/play/story/ChapterCard.tsx` (imported), `src/lib/actions/story.ts` (imported). `StoryChapterRow` interface defined in `src/lib/db/story.ts` is imported wherever needed. Function signatures align: `upsertStoryChapter` input matches what `generateStoryChapter` passes; `generateStoryChapterWithAI` `BuildPromptInput` matches what `generateStoryChapter` constructs.

---

## Open follow-ups (post-merge)

- Voice quality check on iOS Safari with the youngest user before declaring done; if robotic, plan a recorded-voice fallback (separate PR).
- If multi-child profile lands, Story Library page may need a child-picker.
- After 5+ chapters in a saga, decide whether to limit prior-summary chain length (currently always picks the single most recent chapter — no growth risk).
