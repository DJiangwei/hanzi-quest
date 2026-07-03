# Answer Events + Flashcard Self-Assessment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write-only per-answer telemetry (`answer_events` table) fed by every MCQ/boss/homework/study answer, plus a 3-way self-assessment (认识/不确定/不认识) on review flashcards.

**Architecture:** A client-safe event type module is shared by scenes and actions. Scenes emit events via an optional `onAnswerEvent` callback; runners accumulate and flush them as an optional `events` field on the existing auth-gated finish actions; the server inserts them fire-and-forget after primary writes. No reads, no scoring change.

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon Postgres, zod v4, Vitest + RTL + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-03-answer-events-and-flashcard-self-assessment-design.md`

## Global Constraints

- All four gates green at PR open: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Migrations are append-only; generate with `pnpm db:generate`, never edit committed `drizzle/*.sql`. **Local `pnpm build` applies the new migration to PROD early** — additive/unused, acceptable, do it knowingly, once.
- Tests mock all external boundaries. Any test importing `@/lib/db/*` or `@/lib/actions/*` MUST `vi.mock('@/db', () => ({ db: {} }))` (fails only on CI otherwise).
- `'use server'` files export only async functions — types/schemas live elsewhere.
- New kid-facing labels are bilingual, ZH first (`认识 / Got it` etc.).
- Event logging must NEVER fail or slow the primary action result: guarded, inserted after primary writes.
- `source`/`scene_type`/`self_rating` are `text` columns (NOT pgEnum), validated app-side by zod.
- Scoring/reward behavior is UNCHANGED everywhere (flashcard still completes as success; MCQ flow untouched when `onResult` absent).
- Branch: `feat/answer-events` (already created; spec committed). Never push to main; SSH remote.

---

### Task 1: Client-safe event types + zod schema

**Files:**
- Create: `src/lib/play/answer-events.ts`
- Test: `tests/unit/answer-events-schema.test.ts`

**Interfaces:**
- Produces: `type SelfRating = 'got_it' | 'not_sure' | 'dont_know'`; `type AnswerSource = 'review' | 'practice' | 'boss' | 'homework' | 'study'`; `interface SceneAnswerEvent { sceneType: string; characterId?: string | null; wordId?: string | null; itemKey?: string | null; correct?: boolean | null; selfRating?: SelfRating | null; pickedKey?: string | null }`; `const SceneAnswerEventSchema` (zod, enforces exactly-one-of `correct`/`selfRating`); `const MAX_EVENTS_PER_CALL = 40`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/answer-events-schema.test.ts
import { describe, expect, it } from 'vitest';
import { SceneAnswerEventSchema, MAX_EVENTS_PER_CALL } from '@/lib/play/answer-events';

describe('SceneAnswerEventSchema', () => {
  it('accepts a graded MCQ event', () => {
    const r = SceneAnswerEventSchema.safeParse({
      sceneType: 'translate_pick',
      characterId: '4c9f0d5e-1111-2222-3333-444455556666',
      correct: false,
      pickedKey: 'some-char-id',
    });
    expect(r.success).toBe(true);
  });

  it('accepts a flashcard self-rating event (correct null)', () => {
    const r = SceneAnswerEventSchema.safeParse({
      sceneType: 'flashcard',
      characterId: '4c9f0d5e-1111-2222-3333-444455556666',
      selfRating: 'not_sure',
    });
    expect(r.success).toBe(true);
  });

  it('rejects an event with BOTH correct and selfRating', () => {
    const r = SceneAnswerEventSchema.safeParse({
      sceneType: 'flashcard',
      correct: true,
      selfRating: 'got_it',
    });
    expect(r.success).toBe(false);
  });

  it('rejects an event with NEITHER correct nor selfRating', () => {
    const r = SceneAnswerEventSchema.safeParse({ sceneType: 'audio_pick' });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown selfRating', () => {
    const r = SceneAnswerEventSchema.safeParse({
      sceneType: 'flashcard',
      selfRating: 'kinda',
    });
    expect(r.success).toBe(false);
  });

  it('exports the per-call cap', () => {
    expect(MAX_EVENTS_PER_CALL).toBe(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/answer-events-schema.test.ts`
Expected: FAIL — `Cannot find module '@/lib/play/answer-events'`.

- [ ] **Step 3: Write the module**

```ts
// src/lib/play/answer-events.ts
// Client-safe (no db imports): shared by scene components, runners, and actions.
import { z } from 'zod';

export const SELF_RATINGS = ['got_it', 'not_sure', 'dont_know'] as const;
export type SelfRating = (typeof SELF_RATINGS)[number];

export const ANSWER_SOURCES = ['review', 'practice', 'boss', 'homework', 'study'] as const;
export type AnswerSource = (typeof ANSWER_SOURCES)[number];

export const MAX_EVENTS_PER_CALL = 40;

/** One answered question. Exactly one of `correct` / `selfRating` must be set. */
export const SceneAnswerEventSchema = z
  .object({
    sceneType: z.string().min(1).max(64),
    characterId: z.string().uuid().nullish(),
    wordId: z.string().uuid().nullish(),
    itemKey: z.string().max(128).nullish(),
    correct: z.boolean().nullish(),
    selfRating: z.enum(SELF_RATINGS).nullish(),
    pickedKey: z.string().max(128).nullish(),
  })
  .refine((e) => (e.correct != null) !== (e.selfRating != null), {
    message: 'exactly one of correct/selfRating must be set',
  });

export type SceneAnswerEvent = z.infer<typeof SceneAnswerEventSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/answer-events-schema.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/play/answer-events.ts tests/unit/answer-events-schema.test.ts
git commit -m "feat(answer-events): client-safe event type + zod schema"
```

---

### Task 2: DB schema + migration + db layer

**Files:**
- Create: `src/db/schema/answer-events.ts`
- Modify: `src/db/schema/index.ts` (add `export * from './answer-events';`)
- Create: `src/lib/db/answer-events.ts`
- Create: `drizzle/0034_*.sql` via `pnpm db:generate` (do NOT hand-write)
- Test: `tests/unit/answer-events-db.test.ts`

**Interfaces:**
- Consumes: `SceneAnswerEvent`, `SceneAnswerEventSchema`, `AnswerSource`, `MAX_EVENTS_PER_CALL` from Task 1.
- Produces: `answerEvents` table object; `logAnswerEventsSafe(childId: string, weekId: string | null, source: AnswerSource, events: unknown[]): Promise<number>` — validates each element, drops invalid ones, batch-inserts, swallows ALL errors, returns inserted count (0 on failure).

- [ ] **Step 1: Write the schema file**

```ts
// src/db/schema/answer-events.ts
// Per-answer learning telemetry (write-only in v1). See spec 2026-07-03.
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { childProfiles } from './auth';
import { characters, weeks, words } from './content';

export const answerEvents = pgTable(
  'answer_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    weekId: uuid('week_id').references(() => weeks.id, { onDelete: 'set null' }),
    // 'review' | 'practice' | 'boss' | 'homework' | 'study' — text (not pgEnum),
    // validated app-side; future sources need no migration.
    source: text('source').notNull(),
    sceneType: text('scene_type').notNull(),
    characterId: uuid('character_id').references(() => characters.id, { onDelete: 'set null' }),
    wordId: uuid('word_id').references(() => words.id, { onDelete: 'set null' }),
    itemKey: text('item_key'),
    correct: boolean('correct'),
    selfRating: text('self_rating'),
    pickedKey: text('picked_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('answer_events_child_char_idx').on(t.childId, t.characterId),
    index('answer_events_child_time_idx').on(t.childId, t.createdAt),
  ],
);
```

Add to `src/db/schema/index.ts` (alphabetical spot near the top):

```ts
export * from './answer-events';
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `drizzle/0034_<name>.sql` containing only `CREATE TABLE "answer_events"` + 2 `CREATE INDEX` + FK constraints. Inspect it — it must NOT touch any existing table. Do NOT run `pnpm db:migrate` now.

- [ ] **Step 3: Write the failing db-layer test**

```ts
// tests/unit/answer-events-db.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const valuesMock = vi.fn().mockResolvedValue(undefined);
const insertMock = vi.fn(() => ({ values: valuesMock }));

vi.mock('@/db', () => ({ db: { insert: insertMock } }));

import { logAnswerEventsSafe } from '@/lib/db/answer-events';

const CHILD = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const WEEK = '11111111-2222-3333-4444-555555555555';
const CHAR = '99999999-8888-7777-6666-555555555555';

describe('logAnswerEventsSafe', () => {
  beforeEach(() => {
    insertMock.mockClear();
    valuesMock.mockClear();
    valuesMock.mockResolvedValue(undefined);
  });

  it('inserts one row per valid event with server-derived context', async () => {
    const n = await logAnswerEventsSafe(CHILD, WEEK, 'practice', [
      { sceneType: 'audio_pick', characterId: CHAR, correct: true },
      { sceneType: 'flashcard', characterId: CHAR, selfRating: 'dont_know' },
    ]);
    expect(n).toBe(2);
    expect(insertMock).toHaveBeenCalledTimes(1);
    const rows = valuesMock.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      childId: CHILD,
      weekId: WEEK,
      source: 'practice',
      sceneType: 'audio_pick',
      correct: true,
    });
    expect(rows[1]).toMatchObject({ selfRating: 'dont_know', correct: null });
  });

  it('drops invalid events individually and keeps valid ones', async () => {
    const n = await logAnswerEventsSafe(CHILD, null, 'study', [
      { sceneType: 'study_picture_to_word', itemKey: 'flag-fr', correct: false },
      { sceneType: 'bad', correct: true, selfRating: 'got_it' }, // violates exactly-one-of
      { nonsense: true },
    ]);
    expect(n).toBe(1);
    expect(valuesMock.mock.calls[0][0]).toHaveLength(1);
  });

  it('caps at MAX_EVENTS_PER_CALL', async () => {
    const many = Array.from({ length: 60 }, () => ({
      sceneType: 'audio_pick',
      characterId: CHAR,
      correct: true,
    }));
    const n = await logAnswerEventsSafe(CHILD, WEEK, 'practice', many);
    expect(n).toBe(40);
  });

  it('returns 0 and swallows when the insert throws', async () => {
    valuesMock.mockRejectedValueOnce(new Error('db down'));
    const n = await logAnswerEventsSafe(CHILD, WEEK, 'practice', [
      { sceneType: 'audio_pick', characterId: CHAR, correct: true },
    ]);
    expect(n).toBe(0);
  });

  it('does not insert at all for an empty/fully-invalid batch', async () => {
    const n = await logAnswerEventsSafe(CHILD, WEEK, 'practice', [{ junk: 1 }]);
    expect(n).toBe(0);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/answer-events-db.test.ts`
Expected: FAIL — `Cannot find module '@/lib/db/answer-events'`.

- [ ] **Step 5: Write the db layer**

```ts
// src/lib/db/answer-events.ts
import { db } from '@/db';
import { answerEvents } from '@/db/schema';
import {
  MAX_EVENTS_PER_CALL,
  SceneAnswerEventSchema,
  type AnswerSource,
} from '@/lib/play/answer-events';

/**
 * Batch-insert answer telemetry. NEVER throws (mirrors safeAwardXp /
 * tickQuestProgressSafe): invalid elements are dropped individually, any
 * db error is swallowed + logged. Returns the number of rows inserted.
 * childId/weekId/source come from the calling action's validated context —
 * never from per-event client data.
 */
export async function logAnswerEventsSafe(
  childId: string,
  weekId: string | null,
  source: AnswerSource,
  events: unknown[],
): Promise<number> {
  try {
    const rows = events
      .slice(0, MAX_EVENTS_PER_CALL)
      .map((e) => SceneAnswerEventSchema.safeParse(e))
      .filter((r) => r.success)
      .map((r) => ({
        childId,
        weekId,
        source,
        sceneType: r.data.sceneType,
        characterId: r.data.characterId ?? null,
        wordId: r.data.wordId ?? null,
        itemKey: r.data.itemKey ?? null,
        correct: r.data.correct ?? null,
        selfRating: r.data.selfRating ?? null,
        pickedKey: r.data.pickedKey ?? null,
      }));
    if (rows.length === 0) return 0;
    await db.insert(answerEvents).values(rows);
    return rows.length;
  } catch (err) {
    console.error('[answer-events] logAnswerEventsSafe error:', err);
    return 0;
  }
}
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm vitest run tests/unit/answer-events-db.test.ts && pnpm typecheck`
Expected: PASS (5 tests), clean typecheck.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema/answer-events.ts src/db/schema/index.ts src/lib/db/answer-events.ts drizzle/ tests/unit/answer-events-db.test.ts
git commit -m "feat(answer-events): answer_events table (migration 0034) + safe batched insert layer"
```

---

### Task 3: Piggyback `events` on the three finish actions

**Files:**
- Modify: `src/lib/actions/play.ts` (`FinishAttemptSchema` ~line 141 + `finishAttemptAction`)
- Modify: `src/lib/actions/homework.ts` (`FinishHomeworkSchema` ~line 26 + `finishHomeworkAction`)
- Modify: `src/lib/actions/study.ts` (`FinishStudySchema` ~line 19 + `finishStudyLessonAction`)
- Test: `tests/unit/answer-events-actions.test.ts`

**Interfaces:**
- Consumes: `logAnswerEventsSafe` (Task 2); `ANSWER_SOURCES`, `MAX_EVENTS_PER_CALL` (Task 1).
- Produces: each schema gains `events: z.array(z.unknown()).max(MAX_EVENTS_PER_CALL).optional()`; `FinishAttemptSchema` also gains `source: z.enum(ANSWER_SOURCES).optional()` (SceneRunner sends its `section`). Return types unchanged.

- [ ] **Step 1: Write the failing test**

Follow the existing action-test pattern (see `tests/unit/` neighbors for the full mock set each action file needs — `@/db`, `@clerk/nextjs/server` via `@/lib/auth/guards`, `next/cache`, plus per-import mocks like `@/lib/play/card-grants`, `@/lib/db/continent-rewards`). The essential new assertions:

```ts
// tests/unit/answer-events-actions.test.ts (core shape — reuse neighbor mocks)
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: {} }));
const logMock = vi.fn().mockResolvedValue(1);
vi.mock('@/lib/db/answer-events', () => ({ logAnswerEventsSafe: logMock }));
// …plus the standard mocks this action file already requires in existing tests:
// @/lib/auth/guards (requireChild → { child: { id: CHILD } }), @/lib/db/play,
// @/lib/db/coins, @/lib/db/streaks, @/lib/db/quests, @/lib/db/xp,
// @/lib/play/card-grants, @/lib/db/trophies, next/cache. Copy from the
// existing finishAttemptAction test file and keep return stubs identical.

import { finishAttemptAction } from '@/lib/actions/play';

describe('finishAttemptAction events piggyback', () => {
  beforeEach(() => logMock.mockClear());

  it('forwards events with server-derived child/week/source', async () => {
    await finishAttemptAction({
      sessionId: SESSION, weekLevelId: LEVEL, weekId: WEEK, childId: CHILD,
      correctCount: 1, totalCount: 1,
      source: 'practice',
      events: [{ sceneType: 'audio_pick', characterId: CHAR, correct: true }],
    });
    expect(logMock).toHaveBeenCalledWith(CHILD, WEEK, 'practice', [
      { sceneType: 'audio_pick', characterId: CHAR, correct: true },
    ]);
  });

  it('does not call the logger when events are absent', async () => {
    await finishAttemptAction({
      sessionId: SESSION, weekLevelId: LEVEL, weekId: WEEK, childId: CHILD,
      correctCount: 1, totalCount: 1,
    });
    expect(logMock).not.toHaveBeenCalled();
  });

  it('action result is unchanged when the logger rejects', async () => {
    logMock.mockRejectedValueOnce(new Error('boom'));
    const res = await finishAttemptAction({
      sessionId: SESSION, weekLevelId: LEVEL, weekId: WEEK, childId: CHILD,
      correctCount: 1, totalCount: 1,
      source: 'review',
      events: [{ sceneType: 'flashcard', characterId: CHAR, selfRating: 'got_it' }],
    });
    expect(res.coinsAwarded).toBeGreaterThanOrEqual(0); // action still returns normally
  });
});
```

Add two analogous `it` blocks for `finishHomeworkAction` (expects `logMock` called with `(CHILD, WEEK, 'homework', events)`) and `finishStudyLessonAction` (expects `(CHILD, null, 'study', events)`) — either in this file with that action's mock set, or appended to those actions' existing test files if adding mocks here gets heavy.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/answer-events-actions.test.ts`
Expected: FAIL — zod strips/rejects unknown `events` key or `logMock` not called.

- [ ] **Step 3: Implement the piggyback (same pattern ×3)**

In `src/lib/actions/play.ts`:

```ts
import { logAnswerEventsSafe } from '@/lib/db/answer-events';
import { ANSWER_SOURCES, MAX_EVENTS_PER_CALL } from '@/lib/play/answer-events';

const FinishAttemptSchema = z.object({
  // …existing fields unchanged…
  source: z.enum(ANSWER_SOURCES).optional(),
  events: z.array(z.unknown()).max(MAX_EVENTS_PER_CALL).optional(),
});
```

Then in `finishAttemptAction`, AFTER the primary writes (place next to the existing safe XP/quest ticks, before the return):

```ts
if (parsed.events?.length) {
  try {
    await logAnswerEventsSafe(child.id, parsed.weekId, parsed.source ?? 'practice', parsed.events);
  } catch (err) {
    console.error('[play] answer-event log failed:', err);
  }
}
```

In `finishHomeworkAction` (source is fixed): `await logAnswerEventsSafe(child.id, parsed.weekId, 'homework', parsed.events)` inside the same guarded block. In `finishStudyLessonAction`: `await logAnswerEventsSafe(child.id, null, 'study', parsed.events)`.

(The outer try/catch is belt-and-braces per spec — `logAnswerEventsSafe` already swallows.)

- [ ] **Step 4: Run tests to verify pass + no regressions**

Run: `pnpm vitest run tests/unit/answer-events-actions.test.ts && pnpm vitest run tests/unit --silent`
Expected: new tests PASS; full unit suite still green (existing action tests unaffected because `events` is optional).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/play.ts src/lib/actions/homework.ts src/lib/actions/study.ts tests/unit/answer-events-actions.test.ts
git commit -m "feat(answer-events): finish actions accept optional events batch (guarded fire-and-forget)"
```

---

### Task 4: `MultipleChoiceQuiz.onResult`

**Files:**
- Modify: `src/components/scenes/MultipleChoiceQuiz.tsx`
- Test: `tests/unit/mcq-onresult.test.tsx`

**Interfaces:**
- Produces: optional prop `onResult?: (r: { pickedKey: string; correct: boolean }) => void`, fired synchronously inside `handlePick` (before the auto-advance timeout). No behavior change when absent.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/mcq-onresult.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', () => ({ useCoinHud: () => ({ coinHudRef: { current: null } }) }));
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => vi.fn() }));

const choices = [
  { key: 'right', label: 'right', isCorrect: true },
  { key: 'wrong', label: 'wrong', isCorrect: false },
];

describe('MultipleChoiceQuiz onResult', () => {
  it('fires once with the tapped key + correctness', () => {
    const onResult = vi.fn();
    render(
      <MultipleChoiceQuiz prompt="p" stimulus={<span>s</span>} choices={choices}
        onComplete={vi.fn()} onResult={onResult} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'wrong' }));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ pickedKey: 'wrong', correct: false });
    // one-shot: a second tap is ignored
    fireEvent.click(screen.getByRole('button', { name: 'right' }));
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('works without onResult (no crash)', () => {
    render(
      <MultipleChoiceQuiz prompt="p" stimulus={<span>s</span>} choices={choices}
        onComplete={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'right' }));
    expect(screen.getByRole('button', { name: 'right' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/mcq-onresult.test.tsx`
Expected: FAIL — `onResult` never called (prop doesn't exist yet; TS may also error).

- [ ] **Step 3: Implement**

In `MultipleChoiceQuiz.tsx`: add to `Props` —

```ts
/** Telemetry: fired once at tap time with the picked choice key. */
onResult?: (r: { pickedKey: string; correct: boolean }) => void;
```

Destructure `onResult` and add inside `handlePick`, right after the `if (revealed || …) return;` guard line:

```ts
onResult?.({ pickedKey: key, correct: isCorrect });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/mcq-onresult.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/scenes/MultipleChoiceQuiz.tsx tests/unit/mcq-onresult.test.tsx
git commit -m "feat(answer-events): MultipleChoiceQuiz optional onResult telemetry callback"
```

---

### Task 5: MCQ scenes emit `onAnswerEvent`

**Files:**
- Modify: `src/components/scenes/AudioPickScene.tsx`, `ImagePickScene.tsx`, `ImageWordScene.tsx`, `TranslatePickScene.tsx`, `SentenceClozeScene.tsx`
- Test: `tests/unit/scene-answer-events.test.tsx`

**Interfaces:**
- Consumes: `MultipleChoiceQuiz.onResult` (Task 4); `SceneAnswerEvent` type (Task 1).
- Produces: each scene gains optional `onAnswerEvent?: (e: SceneAnswerEvent) => void` and passes `onResult` through to its `MultipleChoiceQuiz`, emitting a fully-formed event.

Per-scene event payloads (choice `key`s are already stable ids per the shuffle landmine):

| Scene | sceneType | characterId | wordId | pickedKey |
|---|---|---|---|---|
| AudioPickScene | `audio_pick` | `target.characterId` | — | picked choice key |
| ImagePickScene | `image_pick` | `target.characterId` | — | picked choice key |
| TranslatePickScene | `translate_pick` | `target.characterId` | — | picked choice key |
| SentenceClozeScene | `sentence_cloze` | `target.characterId` | — | picked choice key |
| ImageWordScene | `image_word` | — | `correctWord.wordId` | picked choice key |

- [ ] **Step 1: Write the failing test (one graded scene + the word-target scene)**

```tsx
// tests/unit/scene-answer-events.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TranslatePickScene } from '@/components/scenes/TranslatePickScene';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', () => ({ useCoinHud: () => ({ coinHudRef: { current: null } }) }));
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => vi.fn() }));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => false }));

const A = { characterId: 'aaaaaaaa-0000-0000-0000-000000000001', hanzi: '我', meaningEn: 'me', audioUrl: null };
const B = { characterId: 'aaaaaaaa-0000-0000-0000-000000000002', hanzi: '你', meaningEn: 'you', audioUrl: null };
const C = { characterId: 'aaaaaaaa-0000-0000-0000-000000000003', hanzi: '他', meaningEn: 'him', audioUrl: null };
const D = { characterId: 'aaaaaaaa-0000-0000-0000-000000000004', hanzi: '大', meaningEn: 'big', audioUrl: null };

describe('TranslatePickScene answer events', () => {
  it('emits a translate_pick event with target + picked key on a correct pick', () => {
    const onAnswerEvent = vi.fn();
    render(
      <TranslatePickScene target={A} pool={[A, B, C, D]} direction="cn_to_en"
        onComplete={vi.fn()} onAnswerEvent={onAnswerEvent} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'me' }));
    expect(onAnswerEvent).toHaveBeenCalledWith({
      sceneType: 'translate_pick',
      characterId: A.characterId,
      correct: true,
      pickedKey: A.characterId,
    });
  });
});
```

(If `ImageWordScene`'s existing tests make a second block cheap, add one asserting `wordId: correctWord.wordId` — mirror its existing test file's props/mocks. Otherwise the Task-5 pattern being identical across scenes + typecheck is sufficient coverage; the runner-level test in Task 7 covers integration.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/scene-answer-events.test.tsx`
Expected: FAIL — `onAnswerEvent` never called / unknown prop.

- [ ] **Step 3: Implement (repeat this exact pattern in all 5 scenes)**

For `TranslatePickScene.tsx` (others identical with their own sceneType/ids):

```ts
import type { SceneAnswerEvent } from '@/lib/play/answer-events';
// Props:
onAnswerEvent?: (e: SceneAnswerEvent) => void;
```

Pass to the quiz:

```tsx
<MultipleChoiceQuiz
  /* …existing props… */
  onResult={({ pickedKey, correct }) =>
    onAnswerEvent?.({
      sceneType: 'translate_pick',
      characterId: target.characterId,
      correct,
      pickedKey,
    })
  }
/>
```

`ImageWordScene` uses `sceneType: 'image_word'`, `wordId: correctWord.wordId` (no characterId). `SentenceClozeScene` uses `sceneType: 'sentence_cloze'`; `AudioPickScene` `'audio_pick'`; `ImagePickScene` `'image_pick'` — each with `characterId: target.characterId`.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm vitest run tests/unit/scene-answer-events.test.tsx && pnpm typecheck && pnpm vitest run tests/unit --silent`
Expected: all PASS (existing scene tests unaffected — prop optional).

- [ ] **Step 5: Commit**

```bash
git add src/components/scenes/AudioPickScene.tsx src/components/scenes/ImagePickScene.tsx src/components/scenes/ImageWordScene.tsx src/components/scenes/TranslatePickScene.tsx src/components/scenes/SentenceClozeScene.tsx tests/unit/scene-answer-events.test.tsx
git commit -m "feat(answer-events): MCQ scenes emit onAnswerEvent with target + picked key"
```

---

### Task 6: Flashcard 3-way self-assessment

**Files:**
- Modify: `src/components/scenes/FlashcardScene.tsx` (replace the single `Got it →` WoodSignButton, lines ~135-137; extend `FlashcardSceneData` with `characterId: string`)
- Test: `tests/unit/flashcard-self-assessment.test.tsx`

**Interfaces:**
- Consumes: `SceneAnswerEvent`, `SelfRating` (Task 1).
- Produces: `FlashcardScene` props gain `onAnswerEvent?: (e: SceneAnswerEvent) => void`; `data.characterId: string` (new required field — Task 7 threads it). `onComplete` behavior unchanged (every rating completes the scene).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/flashcard-self-assessment.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FlashcardScene } from '@/components/scenes/FlashcardScene';

vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => vi.fn() }));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => false }));

const CHAR = 'aaaaaaaa-0000-0000-0000-000000000009';
const data = {
  characterId: CHAR, hanzi: '船', hanziAudioUrl: null, pinyin: ['chuán'],
  meaningEn: 'boat', meaningZh: null, imageHook: null,
  firstWord: null, firstWordAudioUrl: null, firstSentence: null,
};

const CASES = [
  { zh: '认识', rating: 'got_it' },
  { zh: '不确定', rating: 'not_sure' },
  { zh: '不认识', rating: 'dont_know' },
] as const;

describe('FlashcardScene self-assessment', () => {
  it('renders three bilingual rating buttons', () => {
    render(<FlashcardScene data={data} onComplete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /认识 \/ Got it/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /不确定 \/ Not sure/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /不认识 \/ Don't know/ })).toBeTruthy();
  });

  for (const { zh, rating } of CASES) {
    it(`${zh} advances AND emits selfRating=${rating}`, () => {
      const onComplete = vi.fn();
      const onAnswerEvent = vi.fn();
      render(<FlashcardScene data={data} onComplete={onComplete} onAnswerEvent={onAnswerEvent} />);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(zh) }));
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onAnswerEvent).toHaveBeenCalledWith({
        sceneType: 'flashcard',
        characterId: CHAR,
        selfRating: rating,
      });
    });
  }
});
```

Note: the exact `认识` regex must not also match `不认识` — `getByRole` with `/^认识/` if needed; adjust to `name: /^认识/` for the first button.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/flashcard-self-assessment.test.tsx`
Expected: FAIL — only a `Got it →` button exists; `characterId` not in data type.

- [ ] **Step 3: Implement**

In `FlashcardScene.tsx`: add `characterId: string` to `FlashcardSceneData`; add `onAnswerEvent?: (e: SceneAnswerEvent) => void` to `Props`; replace the single `<WoodSignButton size="lg" onClick={onComplete}>Got it →</WoodSignButton>` with:

```tsx
<div className="flex w-full max-w-md flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
  {(
    [
      { rating: 'got_it', zh: '认识', en: 'Got it', cls: 'bg-emerald-500 hover:bg-emerald-600' },
      { rating: 'not_sure', zh: '不确定', en: 'Not sure', cls: 'bg-amber-500 hover:bg-amber-600' },
      { rating: 'dont_know', zh: '不认识', en: "Don't know", cls: 'bg-rose-500 hover:bg-rose-600' },
    ] as const
  ).map(({ rating, zh, en, cls }) => (
    <button
      key={rating}
      type="button"
      onClick={() => {
        onAnswerEvent?.({ sceneType: 'flashcard', characterId: data.characterId, selfRating: rating });
        onComplete();
      }}
      className={`min-h-11 flex-1 rounded-xl px-4 py-3 text-white shadow-md transition-transform active:scale-95 ${cls}`}
    >
      <span className="font-hanzi text-lg">{zh}</span>
      <span className="ml-1 text-sm opacity-90">/ {en}</span>
    </button>
  ))}
</div>
```

(Keep `WoodSignButton` import removal tidy if now unused. `min-h-11` = 44px tap target. Every rating calls `onComplete()` — score/reward unchanged by design.)

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/unit/flashcard-self-assessment.test.tsx && pnpm vitest run tests/unit --silent`
Expected: new PASS; any existing FlashcardScene tests still green (fix only if they asserted the old "Got it →" label — update those assertions to the new buttons).

- [ ] **Step 5: Commit**

```bash
git add src/components/scenes/FlashcardScene.tsx tests/unit/flashcard-self-assessment.test.tsx
git commit -m "feat(flashcard): 认识/不确定/不认识 self-assessment buttons (log-only, always advance)"
```

---

### Task 7: SceneRunner accumulation + BossScene events

**Files:**
- Modify: `src/components/scenes/SceneRunner.tsx` (eventsRef; thread `onAnswerEvent` + flashcard `characterId`; send `events` + `source` in `finishAttemptAction` ~line 199)
- Modify: `src/components/scenes/BossScene.tsx` (emit per-question events in `handleAnswer`)
- Test: `tests/unit/boss-answer-events.test.tsx` (+ extend existing SceneRunner test if present)

**Interfaces:**
- Consumes: scene `onAnswerEvent` props (Tasks 5-6); `finishAttemptAction` `events`/`source` fields (Task 3).
- Produces: `BossScene` props gain `onAnswerEvent?: (e: SceneAnswerEvent) => void` (emits `{ sceneType: 'boss_question', characterId: q.target.characterId, correct }` — no pickedKey; boss's inner question components aren't wired for it in v1, noted in spec §7 spirit).

- [ ] **Step 1: SceneRunner wiring (mechanical, no new test file needed — covered by boss test + existing runner tests)**

In `SceneRunner.tsx`:

```ts
import type { SceneAnswerEvent } from '@/lib/play/answer-events';
// near the other refs:
const eventsRef = useRef<SceneAnswerEvent[]>([]);
const pushEvent = (e: SceneAnswerEvent) => eventsRef.current.push(e);
```

In `advance`, include and clear the batch (capture BEFORE the async call so late pushes can't leak between levels):

```ts
const events = eventsRef.current;
eventsRef.current = [];
const result = await finishAttemptAction({
  /* …existing fields… */
  source: section,           // 'review' | 'practice' | 'boss'
  events,
});
```

In the `switch`: pass `onAnswerEvent={pushEvent}` to `FlashcardScene`, `AudioPickScene`, `ImagePickScene`, `ImageWordScene`, `TranslatePickScene`, `SentenceClozeScene`, and `BossScene`; add `characterId: c.characterId` to the flashcard `data` object (case `'flashcard'`, ~line 302).

- [ ] **Step 2: Write the failing BossScene test**

```tsx
// tests/unit/boss-answer-events.test.tsx — mirror mocks from tests/unit/boss-creatures.test.tsx / existing BossScene tests
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { BossScene } from '@/components/scenes/BossScene';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', () => ({ useCoinHud: () => ({ coinHudRef: { current: null } }) }));
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => vi.fn() }));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => false }));
vi.mock('@/lib/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

// Build a minimal 1-question boss: characterIds=[A.characterId], questionTypes=['translate_pick'],
// pool = 4 chars (A-D from Task 5's fixtures, but with the full CharacterDetail
// shape the existing BossScene tests use — copy their pool builder).

it('emits one boss_question event per answered question', async () => {
  vi.useFakeTimers();
  const onAnswerEvent = vi.fn();
  render(<BossScene weekNumber={1} characterIds={[A.characterId]} questionTypes={['translate_pick']}
    pool={POOL} onComplete={vi.fn()} onAnswerEvent={onAnswerEvent} />);
  act(() => vi.advanceTimersByTime(1300)); // intro → fighting
  fireEvent.click(await screen.findByRole('button', { name: 'me' })); // correct pick
  expect(onAnswerEvent).toHaveBeenCalledWith({
    sceneType: 'boss_question',
    characterId: A.characterId,
    correct: true,
  });
  vi.useRealTimers();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/boss-answer-events.test.tsx`
Expected: FAIL — unknown prop / not called.

- [ ] **Step 4: Implement BossScene emission**

In `BossScene.tsx`: add `onAnswerEvent?: (e: SceneAnswerEvent) => void` to `Props`; at the TOP of `handleAnswer(correct: boolean)` (before the branch — it must fire for wrong answers too):

```ts
const q = questions[currentIdx];
if (q) {
  onAnswerEvent?.({ sceneType: 'boss_question', characterId: q.target.characterId, correct });
}
```

- [ ] **Step 5: Run tests + full suite**

Run: `pnpm vitest run tests/unit/boss-answer-events.test.tsx && pnpm vitest run tests/unit --silent && pnpm typecheck`
Expected: all PASS. (If an existing SceneRunner test stubs `finishAttemptAction`, its mock now receives extra `source`/`events` keys — assertions using exact `toHaveBeenCalledWith` may need the two new fields added.)

- [ ] **Step 6: Commit**

```bash
git add src/components/scenes/SceneRunner.tsx src/components/scenes/BossScene.tsx tests/unit/boss-answer-events.test.tsx
git commit -m "feat(answer-events): SceneRunner batches events per level; boss emits per-question events"
```

---

### Task 8: Homework + Study runners

**Files:**
- Modify: `src/components/homework/HomeworkRunner.tsx` (build events in its `advance`, send with `finishHomeworkAction` ~line 52)
- Modify: `src/components/play/StudyRunner.tsx` (build events in `onAnswer`, send with `finishStudyLessonAction` ~line 44)
- Test: extend the existing HomeworkRunner/StudyRunner test files with one case each.

**Interfaces:**
- Consumes: `events` field on `finishHomeworkAction`/`finishStudyLessonAction` (Task 3).
- Produces: homework events `{ sceneType: 'homework_<config.type>', itemKey: item.id, correct }`; study events `{ sceneType: 'study_<q.type>', itemKey: q.target.slug, correct }`. No characterId/wordId (homework configs are free-text; study targets are collectible cards). No pickedKey in v1.

- [ ] **Step 1: Write the failing tests (append to existing runner test files, reusing their mocks)**

```tsx
// In the HomeworkRunner test file: mock finishHomeworkAction (already mocked there),
// answer all items, then:
expect(finishHomeworkActionMock).toHaveBeenCalledWith(
  expect.objectContaining({
    events: expect.arrayContaining([
      expect.objectContaining({ sceneType: expect.stringMatching(/^homework_/), itemKey: expect.any(String), correct: expect.any(Boolean) }),
    ]),
  }),
);

// In the StudyRunner test file, after finishing a lesson:
expect(finishStudyLessonActionMock).toHaveBeenCalledWith(
  expect.objectContaining({
    events: expect.arrayContaining([
      expect.objectContaining({ sceneType: expect.stringMatching(/^study_/), itemKey: expect.any(String), correct: expect.any(Boolean) }),
    ]),
  }),
);
```

- [ ] **Step 2: Run to verify both fail**

Run: `pnpm vitest run tests/unit --silent -t "events"` (or the two specific files)
Expected: FAIL — no `events` key sent.

- [ ] **Step 3: Implement**

Both runners: add `const eventsRef = useRef<SceneAnswerEvent[]>([]);`. In `HomeworkRunner`'s `advance(correct: boolean)` push before index bump:

```ts
eventsRef.current.push({
  sceneType: `homework_${item.config.type}`,
  itemKey: item.id,
  correct,
});
```

and pass `events: eventsRef.current` in the `finishHomeworkAction({ childId, weekId, events: eventsRef.current })` call. In `StudyRunner`'s `onAnswer(correct: boolean)`:

```ts
eventsRef.current.push({
  sceneType: `study_${q.type}`,
  itemKey: q.target.slug,
  correct,
});
```

and `finishStudyLessonAction({ childId, packSlug, score, events: eventsRef.current })`.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/unit --silent`
Expected: full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/homework/HomeworkRunner.tsx src/components/play/StudyRunner.tsx tests/unit/
git commit -m "feat(answer-events): homework + study runners send per-question events"
```

---

### Task 9: Gates, docs, PR

**Files:**
- Modify: `CLAUDE.md` (current-state entry + landmine), `docs/IMPROVEMENT-ROADMAP.md` (tick A1)

- [ ] **Step 1: Full gates**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. NOTE: `pnpm build` runs `scripts/migrate.ts` against PROD (`.env.local`) and will apply migration 0034 early — additive/unused table, acceptable per the established landmine; run it ONCE, knowingly.

- [ ] **Step 2: Update docs**

CLAUDE.md: add a shipped-entry paragraph (answer_events telemetry + flashcard self-assessment; table is write-only; ratings never affect score) + a landmine:

> **Landmine:** *`answer_events` is write-only telemetry — flashcard self-ratings must NEVER affect scoring/rewards.* All three rating buttons complete the scene as success (score 100); honesty is never punished. Events piggyback the finish actions (`events` optional field) and insert via `logAnswerEventsSafe` AFTER primary writes (guarded — a log failure can't fail a scene). `source`/`scene_type`/`self_rating` are text columns validated by zod in `src/lib/play/answer-events.ts` (client-safe module — no db imports). When adding a new answering surface, emit events through the same piggyback; never add a standalone public log action (PR #112 endpoint rule).

`docs/IMPROVEMENT-ROADMAP.md`: flip A1 to `[x]`.

- [ ] **Step 3: Push + open PR**

```bash
git add CLAUDE.md docs/IMPROVEMENT-ROADMAP.md
git commit -m "docs: answer-events telemetry shipped — CLAUDE.md + roadmap"
git push -u origin feat/answer-events   # SSH remote
gh pr create --title "feat: answer_events telemetry + flashcard self-assessment (A1)" --body "…summary + test plan…

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Expected: CI green (the four gates). No post-merge ops (no seed, no recompile).

---

## Self-review notes

- Spec coverage: §3→Task 2, §4→Task 3, §5→Tasks 4/5/7/8, §6→Task 6, §7 deferred items untouched, §8 tests distributed per task, §9→Task 9. ✔
- Boss pickedKey: spec table implies picked_key "usually" set; boss events deliberately omit it (inner question components would each need onResult threading — YAGNI for v1; the column is nullable). Documented in Task 7 Interfaces. ✔
- Type consistency: `SceneAnswerEvent`/`logAnswerEventsSafe`/`onAnswerEvent`/`onResult` names match across tasks. ✔
