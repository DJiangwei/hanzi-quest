# PR #36 — Image-Prompted Word Formation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `image_word` scene type rendered as a stylized "description card" (DeepSeek-generated `imageHook` per 词) + base 字 chip + 4 word choices. 2 slots per full-week practice; practice grows 12 → 14; boss-unlock threshold bumps 6 → 7. Real image generation is **deferred to PR #37** — this PR sets up the schema + scene + AI-pipeline plumbing so PR #37 is a ~5-line stimulus swap.

**Architecture:** AI scene-gen pipeline (DeepSeek V4 Pro via Vercel AI SDK v6) extends from V1 to V2 — each 词 now carries an `imageHook` field. New `words.image_hook` column + `image_word` value in `scene_type` enum (migration 0012). Scene component reads imageHook + base char + distractors, delegates to `MultipleChoiceQuiz`. Compile-week emits 2 image_word slots in the sight segment with graceful `visual_pick` fallback when no eligible words exist.

**Tech Stack:** Next.js 16 App Router (server components for pages), React 19, Drizzle (append-only migrations + two-phase enum), Vercel AI SDK v6 + `@ai-sdk/deepseek` (existing), Vitest + RTL + jsdom. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-24-pr36-image-word-formation-design.md`

**Branch:** `feat/pr36-image-word-formation` (already created; spec committed `9cb31bf`).

---

## File map

**New files:**
- `src/components/scenes/ImageWordScene.tsx` — client component, description card + 4 choices
- `scripts/backfill-word-image-hooks.ts` — one-off ops script
- Tests: `tests/unit/image-word-scene.test.tsx`, `tests/unit/configs-image-word.test.ts`, `tests/unit/compile-week-image-word.test.ts`, `tests/unit/replace-character-words-image-hook.test.ts`
- `drizzle/0012_<name>.sql` — handwritten (enum ADD VALUE + column + scene_template seed in two phases)

**Modified files:**
- `src/db/schema/content.ts` — add `imageHook` column to `words` table
- `src/db/schema/game.ts` — add `'image_word'` to `sceneType` enum
- `scripts/migrate.ts` — extend second-phase seed to include image_word scene_template
- `src/lib/ai/schemas.ts` — extend `Word` schema with `imageHook` field; rename `WeekContentSchemaV1` → `WeekContentSchemaV2`
- `src/lib/ai/prompts/generate-week-v1.ts` — extend system prompt with per-word imageHook guidance + 2 examples; bump `PROMPT_VERSION`
- `src/lib/ai/generate-content.ts` — pass `imageHook` through `replaceCharacterWords`
- `src/lib/db/characters.ts` — `replaceCharacterWords` accepts + persists `imageHook`; `getCharactersWithDetailsForWeek` returns `imageHook` per word
- `src/lib/scenes/configs.ts` — `ImageWordConfigSchema` + bump `BOSS_UNLOCK_PRACTICE_THRESHOLD = 7`
- `src/lib/scenes/compile-week.ts` — `PracticeSizing.imageWord` field + image_word slot emission + fallback
- `src/components/scenes/SceneRunner.tsx` — extend `SceneType` union + `CharacterDetail.words[]` + switch case for `image_word`
- `src/app/play/[childId]/level/[weekId]/[section]/page.tsx` — extend pool with `words[]` (preserve `firstWord` for word_match back-compat)

---

## Task 1: Schema — `words.image_hook` + `'image_word'` scene_type enum + migration 0012

**Files:**
- Modify: `src/db/schema/content.ts` (words table)
- Modify: `src/db/schema/game.ts` (sceneType enum)
- Modify: `scripts/migrate.ts` (second-phase seed for `image_word` scene_template)
- Generate + handwrite: `drizzle/0012_*.sql`

- [ ] **Step 1: Add `imageHook` to the `words` schema**

In `src/db/schema/content.ts`, in the `words` table definition, append:

```ts
export const words = pgTable('words', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  script: scriptKind('script').notNull().default('simplified'),
  pinyinArray: text('pinyin_array').array().notNull(),
  meaningEn: text('meaning_en'),
  audioUrl: text('audio_url'),
  imageHook: text('image_hook'),     // NEW (nullable)
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

Nullable — no backfill needed at the DB level; NULL = "no imageHook generated yet". The backfill script handles existing rows separately.

- [ ] **Step 2: Add `image_word` to `sceneType` enum**

In `src/db/schema/game.ts`, append `'image_word'` to the existing array:

```ts
export const sceneType = pgEnum('scene_type', [
  'flashcard',
  'audio_pick',
  'visual_pick',
  'image_pick',
  'word_match',
  'tracing',
  'boss',
  'pinyin_pick',
  'translate_pick',
  'sentence_cloze',
  'image_word',         // NEW
]);
```

- [ ] **Step 3: Generate migration**

Run: `pnpm db:generate`

A new file `drizzle/0012_<random_name>.sql` appears. Auto-generated SQL will likely be:
```sql
ALTER TYPE "public"."scene_type" ADD VALUE 'image_word';
ALTER TABLE "words" ADD COLUMN "image_hook" text;
```

Drizzle metadata files in `drizzle/meta/` are also updated.

- [ ] **Step 4: Verify the SQL is safe to apply**

Read `drizzle/0012_*.sql`. It should contain exactly the two `ALTER` statements above with a `--> statement-breakpoint` separator between them (Drizzle inserts this for enum-changes-in-same-tx-as-DDL-using-it). If breakpoint is missing, add it:

```sql
ALTER TYPE "public"."scene_type" ADD VALUE 'image_word';--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "image_hook" text;
```

The enum-add must commit before the scene_template seed (in step 5) can reference it.

- [ ] **Step 5: Extend `scripts/migrate.ts` second-phase seed**

In `scripts/migrate.ts`, find the existing scene-type seed block (around line 33-43) that inserts pinyin_pick / translate_pick / sentence_cloze. Append `image_word` to the VALUES list:

```ts
await sql`
  INSERT INTO scene_templates (type, version, default_config, is_active)
  SELECT * FROM (VALUES
      ('pinyin_pick'::scene_type,    1::smallint, '{}'::jsonb, true),
      ('translate_pick'::scene_type, 1::smallint, '{}'::jsonb, true),
      ('sentence_cloze'::scene_type, 1::smallint, '{}'::jsonb, true),
      ('image_word'::scene_type,     1::smallint, '{}'::jsonb, true)
  ) AS new_rows(t, v, c, a)
  WHERE NOT EXISTS (
      SELECT 1 FROM scene_templates st
      WHERE st.type = new_rows.t AND st.version = new_rows.v
  )
`;
console.log('Scene-type seed applied (pinyin_pick / translate_pick / sentence_cloze / image_word)');
```

- [ ] **Step 6: Apply locally**

Run: `pnpm tsx scripts/migrate.ts`

Expected output ends with "Scene-type seed applied (pinyin_pick / translate_pick / sentence_cloze / image_word)" — no errors.

- [ ] **Step 7: 4-green check**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: all PASS. If any test inserts a `words` row literal and now needs `imageHook`, update its fixture (defaults to `null` is fine).

- [ ] **Step 8: Commit**

```bash
git add src/db/schema/content.ts src/db/schema/game.ts scripts/migrate.ts drizzle/0012_*.sql drizzle/meta/ tests/unit/
git commit -m "feat(image-word): schema — words.image_hook + 'image_word' scene_type + scene_template seed"
```

(Only include `tests/unit/` if a fixture needed updating.)

---

## Task 2: AI pipeline V2 — per-word `imageHook` in WeekContent

**Files:**
- Modify: `src/lib/ai/schemas.ts` — add `imageHook` to `Word`; bump V1 → V2
- Modify: `src/lib/ai/prompts/generate-week-v1.ts` (rename file → `generate-week-v2.ts` OR keep filename + bump `PROMPT_VERSION`; recommended: keep filename to avoid churn, bump `PROMPT_VERSION = 2`)
- Modify: `src/lib/db/characters.ts` — `replaceCharacterWords` accepts `imageHook`; `getCharactersWithDetailsForWeek` returns it
- Modify: `src/lib/ai/generate-content.ts` — pass `imageHook` through
- Test: `tests/unit/replace-character-words-image-hook.test.ts`

- [ ] **Step 1: Write the failing test for word persistence**

Create `tests/unit/replace-character-words-image-hook.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = vi.hoisted(() => ({
  delete: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/db', () => ({ db: { transaction: vi.fn() } }));

import { replaceCharacterWords } from '@/lib/db/characters';

beforeEach(() => {
  txMock.delete.mockReset();
  txMock.insert.mockReset();

  txMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  txMock.insert.mockImplementation(() => ({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'w-stub', imageHook: null }]),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }),
  }));
});

describe('replaceCharacterWords', () => {
  it('persists per-word imageHook when provided', async () => {
    const insertCalls: Array<Record<string, unknown>> = [];
    txMock.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((row) => {
        insertCalls.push(row as Record<string, unknown>);
        return {
          returning: vi.fn().mockResolvedValue([{ id: 'w-stub', text: (row as { text?: string }).text ?? null }]),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }));

    await replaceCharacterWords(txMock as unknown as Parameters<typeof replaceCharacterWords>[0], 'c1', [
      { text: '大人', pinyinArray: ['dà', 'rén'], meaningEn: 'adult', imageHook: 'a smiling adult next to a child' },
      { text: '老人', pinyinArray: ['lǎo', 'rén'], meaningEn: 'elder', imageHook: 'a grey-haired elder sitting on a bench' },
    ]);

    const wordsInsertCalls = insertCalls.filter((c) => 'text' in c && 'pinyinArray' in c);
    expect(wordsInsertCalls).toHaveLength(2);
    expect(wordsInsertCalls[0]).toMatchObject({ imageHook: 'a smiling adult next to a child' });
    expect(wordsInsertCalls[1]).toMatchObject({ imageHook: 'a grey-haired elder sitting on a bench' });
  });

  it('accepts inputs without imageHook (back-compat with V1)', async () => {
    await expect(
      replaceCharacterWords(txMock as unknown as Parameters<typeof replaceCharacterWords>[0], 'c1', [
        { text: '大人', pinyinArray: ['dà', 'rén'], meaningEn: 'adult' },
      ]),
    ).resolves.not.toThrow();
  });
});
```

Run: `pnpm test tests/unit/replace-character-words-image-hook.test.ts` → FAIL (current impl doesn't accept `imageHook`).

- [ ] **Step 2: Extend `replaceCharacterWords` to accept + persist `imageHook`**

In `src/lib/db/characters.ts`, find `replaceCharacterWords` (line ~61). Update its signature and insert call:

```ts
export async function replaceCharacterWords(
  tx: Tx,
  characterId: string,
  inputs: Array<{
    text: string;
    pinyinArray: string[];
    meaningEn: string;
    imageHook?: string;                       // NEW (optional for V1 back-compat)
  }>,
): Promise<WordRow[]> {
  await tx
    .delete(characterWord)
    .where(eq(characterWord.characterId, characterId));

  const created: WordRow[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const w = inputs[i];
    const [wordRow] = await tx
      .insert(words)
      .values({
        text: w.text,
        script: 'simplified',
        pinyinArray: w.pinyinArray,
        meaningEn: w.meaningEn,
        imageHook: w.imageHook ?? null,        // NEW
      })
      .returning();
    await tx
      .insert(characterWord)
      .values({
        characterId,
        wordId: wordRow.id,
        position: i,
      })
      .onConflictDoNothing();
    created.push(wordRow);
  }
  return created;
}
```

`WordRow` type is `typeof words.$inferSelect` which auto-picks up the new column from Task 1's schema change — no manual type widening needed.

- [ ] **Step 3: Update `getCharactersWithDetailsForWeek` to include imageHook in returned words**

In `src/lib/db/characters.ts`, the function already returns full `WordRow` per `words[]` (via `select({ word: words })`). Since `WordRow` includes the new `imageHook` column automatically, no change needed in the query — only verify in the result shape:

```ts
// Verify the returned type matches what we need by reading the existing implementation.
// If the result type strips fields, add imageHook explicitly.
```

If you read the function and find that words are returned untouched (full row), this step is a no-op verification. If a subset is selected, add `imageHook` to the projection.

- [ ] **Step 4: Bump AI schemas V1 → V2**

In `src/lib/ai/schemas.ts`, extend `Word`:

```ts
export const Word = z.object({
  text: z.string().min(1).max(8),
  pinyin: PinyinArray,
  meaningEn: z.string().min(1).max(80),
  imageHook: z.string().min(3).max(120).describe(
    'A child-friendly, single-subject visual description of this word\'s meaning. ' +
    'Vivid and concrete; like a caption you\'d write under a picture. ' +
    'No proper nouns, no text in scene. e.g. for 大人: ' +
    '"a smiling adult standing next to a small child"; ' +
    'for 亮晶晶: "tiny stars sparkling in the night sky".',
  ),
});
```

Add `WeekContentSchemaV2`:

```ts
export const WeekContentSchemaV2 = z.object({
  perCharacter: z.array(PerCharacterSchema),
});

// Re-export legacy V1 alias for any test fixtures that need it; new code uses V2.
export const WeekContentSchemaV1 = WeekContentSchemaV2;

export type WeekContent = z.infer<typeof WeekContentSchemaV2>;
```

(Since `Word` is referenced by `PerCharacterSchema.words`, the change cascades up automatically. V1/V2 are structurally identical post-change; the rename is purely declarative.)

- [ ] **Step 5: Update the prompt + PROMPT_VERSION**

In `src/lib/ai/prompts/generate-week-v1.ts`, bump:

```ts
export const PROMPT_VERSION = 2;
```

Add a paragraph to `GENERATE_WEEK_SYSTEM_PROMPT` explaining per-word imageHook:

```
For each WORD, also generate a child-friendly imageHook — a vivid, concrete
visual description of that word's meaning. Single subject. No proper nouns.
No text in scene. Examples:
  - 大人 → "a smiling adult standing next to a small child"
  - 亮晶晶 → "tiny stars sparkling in the night sky"
  - 跑步 → "a child running across a green field"
The imageHook will later prompt an image generator; treat it as a caption.
```

Place this paragraph near the existing character-level `imageHook` guidance for stylistic consistency.

- [ ] **Step 6: Thread `imageHook` through `generate-content.ts`**

In `src/lib/ai/generate-content.ts`, find the word-persistence block (likely inside the per-character loop after AI returns). The current code probably builds an inputs array for `replaceCharacterWords`. Extend it:

```ts
const wordsInputs = perChar.words.map((w) => ({
  text: w.text,
  pinyinArray: w.pinyin,
  meaningEn: w.meaningEn,
  imageHook: w.imageHook,        // NEW (V2 field)
}));
await replaceCharacterWords(tx, characterId, wordsInputs);
```

Locate the exact line by reading `generate-content.ts`; the pattern should mirror sentence/character persistence.

- [ ] **Step 7: Run the failing test → PASS**

Run: `pnpm test tests/unit/replace-character-words-image-hook.test.ts`

Expected: PASS (2 tests).

- [ ] **Step 8: Run full suite + typecheck + lint**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: all PASS. If `ai-schemas.test.ts` or existing `generate-content` tests fail because their fixtures don't supply `imageHook`, **either** update the fixtures **or** mark the imageHook field as optional in V2 zod schema. Recommended: keep imageHook required in V2 (DeepSeek MUST produce it) and update test fixtures to include it.

- [ ] **Step 9: Commit**

```bash
git add src/lib/ai/schemas.ts src/lib/ai/prompts/generate-week-v1.ts src/lib/ai/generate-content.ts src/lib/db/characters.ts tests/unit/replace-character-words-image-hook.test.ts tests/unit/
git commit -m "feat(image-word): AI pipeline V2 — per-word imageHook in WeekContent + persistence"
```

---

## Task 3: `ImageWordScene` component + config schema

**Files:**
- Modify: `src/lib/scenes/configs.ts` — add `ImageWordConfigSchema`
- Create: `src/components/scenes/ImageWordScene.tsx`
- Test: `tests/unit/configs-image-word.test.ts`
- Test: `tests/unit/image-word-scene.test.tsx`

- [ ] **Step 1: Write the config test**

Create `tests/unit/configs-image-word.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ImageWordConfigSchema } from '@/lib/scenes/configs';

describe('ImageWordConfigSchema', () => {
  const validConfig = {
    characterId: '11111111-1111-1111-1111-111111111111',
    wordId: '22222222-2222-2222-2222-222222222222',
    distractorWordIds: [
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
    ],
    segment: 'sight',
  };

  it('parses a valid config', () => {
    expect(() => ImageWordConfigSchema.parse(validConfig)).not.toThrow();
  });

  it('rejects when distractorWordIds is missing', () => {
    const { distractorWordIds: _omit, ...rest } = validConfig;
    expect(() => ImageWordConfigSchema.parse(rest)).toThrow();
  });

  it('rejects when distractorWordIds length != 3', () => {
    expect(() =>
      ImageWordConfigSchema.parse({ ...validConfig, distractorWordIds: validConfig.distractorWordIds.slice(0, 2) }),
    ).toThrow();
    expect(() =>
      ImageWordConfigSchema.parse({
        ...validConfig,
        distractorWordIds: [...validConfig.distractorWordIds, '66666666-6666-6666-6666-666666666666'],
      }),
    ).toThrow();
  });
});
```

Run: `pnpm test tests/unit/configs-image-word.test.ts` → FAIL (schema doesn't exist).

- [ ] **Step 2: Add `ImageWordConfigSchema` to configs.ts**

In `src/lib/scenes/configs.ts`, after the existing schemas (after `SentenceClozeConfigSchema`), append:

```ts
export const ImageWordConfigSchema = z.object({
  characterId: z.string().uuid(),
  wordId: z.string().uuid(),
  distractorWordIds: z.array(z.string().uuid()).length(3),
  ...withSegment,
});
export type ImageWordConfig = z.infer<typeof ImageWordConfigSchema>;
```

Also bump `BOSS_UNLOCK_PRACTICE_THRESHOLD` from 6 → 7:

```ts
export const BOSS_UNLOCK_PRACTICE_THRESHOLD = 7;
```

- [ ] **Step 3: Run config test → PASS**

Run: `pnpm test tests/unit/configs-image-word.test.ts`

Expected: PASS (3 tests).

- [ ] **Step 4: Write the scene component test**

Create `tests/unit/image-word-scene.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ImageWordScene } from '@/components/scenes/ImageWordScene';

const baseChar = { characterId: 'c1', hanzi: '人' };
const correctWord = {
  wordId: 'w-correct',
  text: '大人',
  imageHook: 'a smiling adult standing next to a small child',
  meaningEn: 'adult',
};
const distractors = [
  { wordId: 'w-d1', text: '主人', imageHook: null, meaningEn: 'master' },
  { wordId: 'w-d2', text: '人民', imageHook: null, meaningEn: 'people' },
  { wordId: 'w-d3', text: '老人', imageHook: null, meaningEn: 'elder' },
];

describe('ImageWordScene', () => {
  it('renders the description card with imageHook text', () => {
    render(
      <ImageWordScene
        baseChar={baseChar}
        correctWord={correctWord}
        distractors={distractors}
        onComplete={() => {}}
      />,
    );
    expect(screen.getByText(/a smiling adult/)).toBeInTheDocument();
  });

  it('renders the base 字 chip', () => {
    render(
      <ImageWordScene
        baseChar={baseChar}
        correctWord={correctWord}
        distractors={distractors}
        onComplete={() => {}}
      />,
    );
    // The chip shows the hanzi 人
    expect(screen.getByText('人')).toBeInTheDocument();
  });

  it('renders 4 choice buttons; correct word click → onComplete(true)', () => {
    const onComplete = vi.fn();
    render(
      <ImageWordScene
        baseChar={baseChar}
        correctWord={correctWord}
        distractors={distractors}
        onComplete={onComplete}
      />,
    );
    const correctBtn = screen.getByRole('button', { name: '大人' });
    fireEvent.click(correctBtn);
    // MultipleChoiceQuiz's contract: invokes onComplete after a small delay or
    // immediately depending on its impl. Verify by polling or asserting on the
    // call. If the existing MCQ delays, use vi.useFakeTimers() or wait.
    // Conservative assertion: onComplete eventually called with true.
    // If MCQ has a "next" button after the pick, this test needs that click too.
    // Read MultipleChoiceQuiz before writing the assertion below — it may
    // need an additional .click() on a "Next" / "Continue" button before
    // onComplete fires.
    expect(onComplete).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('distractor click → onComplete(false)', () => {
    const onComplete = vi.fn();
    render(
      <ImageWordScene
        baseChar={baseChar}
        correctWord={correctWord}
        distractors={distractors}
        onComplete={onComplete}
      />,
    );
    const distractorBtn = screen.getByRole('button', { name: '主人' });
    fireEvent.click(distractorBtn);
    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it('falls back to meaningEn when imageHook is null', () => {
    render(
      <ImageWordScene
        baseChar={baseChar}
        correctWord={{ ...correctWord, imageHook: null }}
        distractors={distractors}
        onComplete={() => {}}
      />,
    );
    expect(screen.getByText('adult')).toBeInTheDocument();
  });
});
```

Run: `pnpm test tests/unit/image-word-scene.test.tsx` → FAIL (component doesn't exist).

**Note on MultipleChoiceQuiz behavior**: read `src/components/scenes/MultipleChoiceQuiz.tsx` before finalizing the test. If it requires a "next" button click after the pick before `onComplete` fires, add that step. If it triggers on the first click directly, the assertion above is correct.

- [ ] **Step 5: Create `ImageWordScene`**

Create `src/components/scenes/ImageWordScene.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';
import { shuffle } from '@/lib/scenes/sample';

interface WordOption {
  wordId: string;
  text: string;
  imageHook: string | null;
  meaningEn: string | null;
}
interface BaseChar {
  characterId: string;
  hanzi: string;
}

interface Props {
  baseChar: BaseChar;
  correctWord: WordOption;
  distractors: WordOption[];
  onComplete: (correct: boolean) => void;
}

export function ImageWordScene({ baseChar, correctWord, distractors, onComplete }: Props) {
  const choices = useMemo(
    () =>
      shuffle([correctWord, ...distractors]).map((w) => ({
        key: w.wordId,
        label: <span className="text-3xl font-extrabold">{w.text}</span>,
        isCorrect: w.wordId === correctWord.wordId,
      })),
    [correctWord, distractors],
  );

  const stimulusText = correctWord.imageHook ?? correctWord.meaningEn ?? correctWord.text;

  return (
    <MultipleChoiceQuiz
      prompt={
        <span>
          看图选词 / Pick the word with{' '}
          <span className="ml-1 rounded-md bg-amber-200 px-2 py-0.5 text-2xl font-extrabold text-amber-900">
            {baseChar.hanzi}
          </span>
        </span>
      }
      stimulus={
        <div className="flex h-48 w-72 items-center justify-center rounded-2xl border-4 border-amber-800/30 bg-gradient-to-br from-amber-50 via-sky-50 to-amber-50 p-5 text-center shadow-lg">
          <span className="mr-2 shrink-0 text-3xl" aria-hidden>
            ✨
          </span>
          <p className="text-base font-semibold leading-snug text-amber-950">
            {stimulusText}
          </p>
        </div>
      }
      choices={choices}
      onComplete={onComplete}
    />
  );
}
```

- [ ] **Step 6: Run the scene test → PASS**

Run: `pnpm test tests/unit/image-word-scene.test.tsx`

Expected: PASS (5 tests). If MultipleChoiceQuiz requires an extra click before `onComplete` fires, update the test (not the component) — the component is correct.

- [ ] **Step 7: 4-green**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/scenes/configs.ts src/components/scenes/ImageWordScene.tsx tests/unit/configs-image-word.test.ts tests/unit/image-word-scene.test.tsx
git commit -m "feat(image-word): ImageWordScene component + config schema + threshold bump to 7"
```

---

## Task 4: SceneRunner integration + pool extension

**Files:**
- Modify: `src/components/scenes/SceneRunner.tsx` — extend `SceneType` + `CharacterDetail.words[]` + add `case 'image_word'`
- Modify: `src/app/play/[childId]/level/[weekId]/[section]/page.tsx` — extend pool mapping to include `words[]`

- [ ] **Step 1: Read SceneRunner.tsx to find the switch case + CharacterDetail**

Open `src/components/scenes/SceneRunner.tsx`. Find:
- `SceneType` discriminated union (around line 30-50)
- `CharacterDetail` interface (around line 35-45) — currently has `firstWord: string | null`
- The big `switch (level.sceneType)` block that maps scene types to components (around line 140-200)

- [ ] **Step 2: Extend `SceneType` to include `'image_word'`**

In SceneRunner.tsx, find where `SceneType` is exported (or defined). It's a string-literal union. Add `'image_word'`:

```ts
export type SceneType =
  | 'flashcard'
  | 'audio_pick'
  | 'visual_pick'
  | 'image_pick'
  | 'word_match'
  | 'pinyin_pick'           // (already kept for backwards compat)
  | 'translate_pick'
  | 'sentence_cloze'
  | 'image_word'             // NEW
  | 'boss';
```

- [ ] **Step 3: Extend `CharacterDetail.words[]`**

Find `interface CharacterDetail`. Add a `words` field (KEEP `firstWord` for word_match back-compat — don't remove it):

```ts
interface CharacterWord {
  id: string;
  text: string;
  imageHook: string | null;
  meaningEn: string | null;
}

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;        // existing — char-level
  firstWord: string | null;        // KEEP — word_match uses it
  words: CharacterWord[];           // NEW — image_word reads this
  sentence: { id: string; text: string; translationEn: string | null } | null;
}
```

- [ ] **Step 4: Add the switch case for `image_word`**

Locate the existing `switch (level.sceneType)` in the rendered scene block. After the `'sentence_cloze'` case, add:

```ts
case 'image_word': {
  const config = level.config as {
    characterId: string;
    wordId: string;
    distractorWordIds: string[];
  };
  const baseCharDetail = charactersById[config.characterId];
  if (!baseCharDetail) return null;

  // Resolve correctWord + distractors from the pool's words map
  // (pool is flat; build a wordId -> CharacterWord lookup once)
  const allWords = new Map<string, CharacterWord>();
  for (const c of pool) {
    for (const w of c.words) allWords.set(w.id, w);
  }
  const correctWord = allWords.get(config.wordId);
  const distractors = config.distractorWordIds
    .map((id) => allWords.get(id))
    .filter((w): w is CharacterWord => w !== undefined);
  if (!correctWord || distractors.length !== 3) return null;

  return (
    <ImageWordScene
      baseChar={{ characterId: baseCharDetail.characterId, hanzi: baseCharDetail.hanzi }}
      correctWord={{
        wordId: correctWord.id,
        text: correctWord.text,
        imageHook: correctWord.imageHook,
        meaningEn: correctWord.meaningEn,
      }}
      distractors={distractors.map((w) => ({
        wordId: w.id,
        text: w.text,
        imageHook: w.imageHook,
        meaningEn: w.meaningEn,
      }))}
      onComplete={advance}
    />
  );
}
```

Add the import at the top of `SceneRunner.tsx`:

```ts
import { ImageWordScene } from './ImageWordScene';
```

- [ ] **Step 5: Extend pool mapping in both level pages**

In `src/app/play/[childId]/level/[weekId]/[section]/page.tsx`, find the `pool = characters.map((c) => (...))` block. Extend it to include `words[]`:

```ts
const pool = characters.map((c) => ({
  characterId: c.id,
  hanzi: c.hanzi,
  pinyinArray: c.pinyinArray ?? [],
  meaningEn: c.meaningEn ?? null,
  meaningZh: c.meaningZh ?? null,
  imageHook: c.imageHook ?? null,
  firstWord: c.words[0]?.text ?? null,            // KEEP for word_match
  words: c.words.map((w) => ({                    // NEW
    id: w.id,
    text: w.text,
    imageHook: w.imageHook ?? null,
    meaningEn: w.meaningEn ?? null,
  })),
  sentence: c.sentence
    ? {
        id: c.sentence.id,
        text: c.sentence.text,
        translationEn: c.sentence.meaningEn ?? null,
      }
    : null,
}));
```

(The legacy `src/app/play/[childId]/level/[weekId]/page.tsx` is just a `redirect()` per PR #35, so it doesn't need this change. Only the `[section]/page.tsx` runs SceneRunner.)

- [ ] **Step 6: 4-green**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: all PASS. Some existing tests may need `words: []` added to their `pool` fixtures. Update minimally.

- [ ] **Step 7: Commit**

```bash
git add src/components/scenes/SceneRunner.tsx src/app/play/\[childId\]/level/\[weekId\]/\[section\]/page.tsx tests/unit/
git commit -m "feat(image-word): wire image_word into SceneRunner + extend pool with words[]"
```

---

## Task 5: Compile-week integration

**Files:**
- Modify: `src/lib/scenes/compile-week.ts` — extend `PracticeSizing` + add image_word slot emission + fallback
- Test: `tests/unit/compile-week-image-word.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/compile-week-image-word.test.ts`:

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

function setupTemplates(includeImageWord = true) {
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
        ...(includeImageWord ? [{ id: 't-image_word', type: 'image_word' }] : []),
      ]),
    }),
  });
}

interface RowCaptured {
  sceneTemplateId: string;
  sceneConfig: { segment: string; wordId?: string; distractorWordIds?: string[] };
  levelKey: string;
}

function captureRows(inserted: RowCaptured[]) {
  dbMock.transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
    await fn({
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((rows: RowCaptured[]) => {
          inserted.push(...rows);
          return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
        }),
      }),
    });
  });
}

function makeChar(i: number, withImageHook: boolean) {
  return {
    id: `c${i}`,
    hanzi: `字${i}`,
    pinyinArray: [`zì${i}`],
    meaningEn: `meaning-${i}`,
    imageHook: 'a-hook',
    words: [
      { id: `w${i}-1`, text: `${i}组词1`, meaningEn: 'wm1', imageHook: withImageHook ? 'hook' : null },
      { id: `w${i}-2`, text: `${i}组词2`, meaningEn: 'wm2', imageHook: withImageHook ? 'hook' : null },
    ],
    sentence: { id: `s${i}`, text: '一个例子' },
  };
}

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.transaction.mockReset();
  charsMock.getCharactersWithDetailsForWeek.mockReset();
});

describe('compileWeekIntoLevels — image_word', () => {
  it('10-char week with all words having imageHook → 2 image_word slots', async () => {
    setupTemplates();
    const chars = Array.from({ length: 10 }, (_, i) => makeChar(i + 1, true));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: RowCaptured[] = [];
    captureRows(inserted);

    const count = await compileWeekIntoLevels('w-test');
    expect(count).toBe(25);     // 10 review + 14 practice + 1 boss
    const imageWordRows = inserted.filter((r) => r.sceneTemplateId === 't-image_word');
    expect(imageWordRows).toHaveLength(2);
    for (const r of imageWordRows) {
      expect(r.sceneConfig.segment).toBe('sight');
      expect(r.sceneConfig.distractorWordIds).toHaveLength(3);
    }
  });

  it('10-char week with 0 words having imageHook → 0 image_word + 2 extra visual_pick fallback', async () => {
    setupTemplates();
    const chars = Array.from({ length: 10 }, (_, i) => makeChar(i + 1, false));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: RowCaptured[] = [];
    captureRows(inserted);

    const count = await compileWeekIntoLevels('w-test');
    expect(count).toBe(25);     // still 25 because fallback visual_picks fill the slots
    const imageWordRows = inserted.filter((r) => r.sceneTemplateId === 't-image_word');
    expect(imageWordRows).toHaveLength(0);
    const visualRows = inserted.filter((r) => r.sceneTemplateId === 't-visual_pick' && r.sceneConfig.segment === 'sight');
    // Expected: 1 normal visual_pick + 2 fallback = 3
    expect(visualRows.length).toBeGreaterThanOrEqual(3);
  });

  it('5-char week → 1 image_word slot', async () => {
    setupTemplates();
    const chars = Array.from({ length: 5 }, (_, i) => makeChar(i + 1, true));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: RowCaptured[] = [];
    captureRows(inserted);

    await compileWeekIntoLevels('w-test');
    const imageWordRows = inserted.filter((r) => r.sceneTemplateId === 't-image_word');
    expect(imageWordRows).toHaveLength(1);
  });

  it('does nothing if image_word scene_template is missing', async () => {
    setupTemplates(false);
    const chars = Array.from({ length: 10 }, (_, i) => makeChar(i + 1, true));
    charsMock.getCharactersWithDetailsForWeek.mockResolvedValue(chars);

    const inserted: RowCaptured[] = [];
    captureRows(inserted);

    await compileWeekIntoLevels('w-test');
    const imageWordRows = inserted.filter((r) => r.sceneTemplateId === 't-image_word');
    expect(imageWordRows).toHaveLength(0);
  });
});
```

Run: `pnpm test tests/unit/compile-week-image-word.test.ts` → FAIL (compile doesn't know about image_word yet).

- [ ] **Step 2: Extend `PracticeSizing` and emission**

In `src/lib/scenes/compile-week.ts`:

Update `PracticeSizing` interface + `computePracticeSizing`:

```ts
interface PracticeSizing {
  audio: number;
  sight: number;
  imageWord: number;       // NEW
  meaning: number;
}

function computePracticeSizing(n: number): PracticeSizing {
  if (n < 2)  return { audio: 0, sight: 0, imageWord: 0, meaning: 0 };
  if (n < 4)  return { audio: 1, sight: 1, imageWord: 1, meaning: 4 };  // 7
  if (n < 10) return { audio: 2, sight: 2, imageWord: 1, meaning: 6 };  // 11
  return { audio: 3, sight: 3, imageWord: 2, meaning: 6 };              // 14
}
```

In the sight segment emission (after the existing word_match block, before the meaning segment), append the image_word emission:

```ts
// ── SIGHT: image_word slots ─────────────────────────────────────────────
const imageWordId = tmplByType.get('image_word');
if (imageWordId && sizing.imageWord > 0) {
  const eligibleChars = chars.filter((c) =>
    c.words.some((w) => w.imageHook !== null),
  );
  const visualId = tmplByType.get('visual_pick');
  let emitted = 0;
  for (let slot = 0; slot < sizing.imageWord; slot++) {
    if (eligibleChars.length === 0) break;
    const target = pickRandom(eligibleChars);
    const eligibleWords = target.words.filter((w) => w.imageHook !== null);
    const correctWord = pickRandom(eligibleWords);
    const allOtherWords = chars
      .flatMap((c) => c.words.filter((w) => w.id !== correctWord.id))
      .map((w) => w.id);
    if (allOtherWords.length < 3) break;
    const distractors = shuffle(allOtherWords).slice(0, 3);
    push(
      imageWordId,
      { characterId: target.id, wordId: correctWord.id, distractorWordIds: distractors },
      'sight',
      `practice:image_word:${slot}`,
    );
    emitted++;
  }
  // Fallback: unfilled image_word slots become extra visual_pick
  if (emitted < sizing.imageWord && visualId) {
    for (let i = emitted; i < sizing.imageWord; i++) {
      const target = pickRandom(chars);
      push(
        visualId,
        { characterId: target.id },
        'sight',
        `practice:visual_pick:fallback-${i}`,
      );
    }
  }
}
```

(If you fit the eligibility check, distractor pool building, and key naming exactly as above, the test should pass.)

- [ ] **Step 3: Run the compile test → PASS**

Run: `pnpm test tests/unit/compile-week-image-word.test.ts`

Expected: PASS (4 tests).

- [ ] **Step 4: Update existing compile tests for the new totals**

Run: `pnpm test tests/unit/compile-week`

Expected: existing tests may break:
- `compile-week-pr35-structure.test.ts` expects 23 levels for 10-char week — now 25. Update.
- `compile-week-segments.test.ts` similar updates.
- Boss-related tests unchanged.

Update the affected assertions to the new totals: 10-char = 25 levels, 5-char = 16 (5 review + 11 practice), etc.

- [ ] **Step 5: Run full suite + typecheck + lint**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scenes/compile-week.ts tests/unit/compile-week-image-word.test.ts tests/unit/compile-week*.test.ts
git commit -m "feat(image-word): compile emits 2 image_word slots; practice 12→14; threshold 6→7"
```

---

## Task 6: Backfill script — `scripts/backfill-word-image-hooks.ts`

**Files:**
- Create: `scripts/backfill-word-image-hooks.ts`

- [ ] **Step 1: Create the script**

Create `scripts/backfill-word-image-hooks.ts`:

```ts
/**
 * Backfill words.image_hook for words where image_hook IS NULL.
 *
 * For each word: ask DeepSeek for a kid-friendly visual description, then
 * UPDATE words SET image_hook = ... WHERE id = ... AND image_hook IS NULL.
 *
 * Idempotent — skips words that already have image_hook set.
 * Re-runnable after partial failure (only retries NULLs).
 *
 * Usage: pnpm tsx scripts/backfill-word-image-hooks.ts
 * Cost: ~$0.0003 per word via DeepSeek V4 Pro = ~$0.10 total for ~300 words.
 * Wall time: ~30s at concurrency=10.
 *
 * CAUTION: writes to prod via shared DATABASE_URL on Neon free tier.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('DEEPSEEK_API_KEY not set');
  process.exit(2);
}

const SYSTEM_PROMPT = `You generate kid-friendly, single-subject visual descriptions for Chinese words.

Output format: a JSON object {"imageHook": "..."} where imageHook is a vivid
visual description (max 120 characters) of the word's meaning. No proper
nouns, no text in scene. Examples:
  - 大人 → "a smiling adult standing next to a small child"
  - 亮晶晶 → "tiny stars sparkling in the night sky"
  - 跑步 → "a child running across a green field"`;

async function generateOne(word: { text: string; meaningEn: string | null }): Promise<string> {
  const { deepseek } = await import('@ai-sdk/deepseek');
  const { generateObject } = await import('ai');
  const { z } = await import('zod');

  const result = await generateObject({
    model: deepseek('deepseek-v4-pro'),
    schema: z.object({ imageHook: z.string().min(3).max(120) }),
    schemaName: 'WordImageHook',
    system: SYSTEM_PROMPT,
    prompt: `Word: ${word.text}\nMeaning: ${word.meaningEn ?? '(no English meaning available)'}`,
    temperature: 0.5,
  });
  return result.object.imageHook;
}

async function main() {
  const { db } = await import('../src/db');
  const { words } = await import('../src/db/schema');
  const { eq, isNull, sql } = await import('drizzle-orm');

  const rows = await db
    .select({ id: words.id, text: words.text, meaningEn: words.meaningEn })
    .from(words)
    .where(isNull(words.imageHook));

  console.log(`Found ${rows.length} words without image_hook.`);
  if (rows.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let succeeded = 0;
  let failed = 0;
  const CONCURRENCY = 10;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (w) => {
        try {
          const hook = await generateOne(w);
          await db
            .update(words)
            .set({ imageHook: hook })
            .where(eq(words.id, w.id));
          return { ok: true, word: w };
        } catch (e) {
          return { ok: false, word: w, error: e instanceof Error ? e.message : 'unknown' };
        }
      }),
    );
    for (const r of results) {
      if (r.ok) {
        succeeded++;
        process.stdout.write('.');
      } else {
        failed++;
        console.error(`\n  FAIL ${r.word.text}: ${r.error}`);
      }
    }
  }

  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`);
  // Keep process alive briefly so any in-flight logs flush
  await new Promise((r) => setTimeout(r, 100));
  void sql; // silence unused import (drizzle sometimes is)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

- [ ] **Step 2: Smoke-run locally (will hit prod if DATABASE_URL points there)**

Run: `pnpm tsx scripts/backfill-word-image-hooks.ts`

Expected: prints progress dots, then "Done. N succeeded, 0 failed." for the ~300 prod words. Should take ~30s.

If you see significant failures (>5%), check the DeepSeek response shape — adjust the schema or temperature if needed.

- [ ] **Step 3: Spot-check 3 random words**

Use psql or any DB tool:
```sql
SELECT text, image_hook FROM words WHERE image_hook IS NOT NULL ORDER BY random() LIMIT 3;
```

Confirm the imageHooks are kid-friendly + single-subject + no text. If most are good, ship it. If many are mediocre, refine the system prompt + re-run (it'll skip already-populated rows).

- [ ] **Step 4: 4-green check** (no compile change here, just confirming nothing broke)

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-word-image-hooks.ts
git commit -m "chore(scripts): backfill-word-image-hooks — one-off DeepSeek-only filler for words.image_hook"
```

---

## Task 7: Recompile + 4-green + PR

- [ ] **Step 1: Recompile all weeks locally** (uses prod DATABASE_URL)

Run: `pnpm tsx scripts/recompile-all-weeks.ts`

Expected: each ≥10-char week emits 25 levels (was 23); 8-char weeks emit 19 (was 18). No errors.

- [ ] **Step 2: Final 4-green gate**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

All four must pass.

- [ ] **Step 3: Manual smoke**

```bash
pnpm dev
```

Open `http://localhost:3000/play/<childId>` and verify:
1. Tap an island → land on the week hub.
2. 练习 card shows N/14 (was N/12).
3. Enter 练习 → image_word scenes appear mid-block.
4. Description card renders with imageHook text; base 字 chip renders.
5. Click correct → green; click wrong → red.
6. Boss locked at 7/14 (was 6/12); unlocks at exactly 7.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/pr36-image-word-formation
gh pr create --title "feat: PR #36 — image-prompted word formation (text-stimulus, image-ready)" --body "$(cat <<'EOF'
## Summary
- New `image_word` scene type woven into the sight segment of practice. Each scene shows a kid-friendly description card + the base 字 chip + 4 candidate 词.
- AI scene-gen pipeline extended to V2: each 词 in `WeekContent` now carries an `imageHook` field. New `words.image_hook` text column (migration 0012).
- Practice grows 12 → 14 scenes per full week (2 new image_word slots in sight). Boss unlock threshold 6 → 7.
- Real image generation is **deferred to PR #37** — this PR sets up the schema + scene + AI plumbing so PR #37 becomes a ~5-line stimulus swap (add `<img>` when `words.image_url` is set, else the existing description card).
- Backfill script regenerated imageHook for ~300 existing prod words (~$0.10 DeepSeek).
- Compile gracefully falls back to extra `visual_pick` when no eligible words exist — practice slot count stays at 14.

## Prod state
- Migration 0012 applied (image_hook column + image_word enum value + scene_template seed)
- ~300 prod words backfilled with imageHook
- All 10 published weeks recompiled to PR #36 shape (8 × 25 levels, 2 × 19 levels)

## Test plan
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
- [x] Backfill ran cleanly on prod
- [x] Recompile-all-weeks updated all 10 weeks
- [ ] Tap island → hub shows 14 practice slots
- [ ] image_word scenes appear in sight; description card renders
- [ ] Boss unlocks at 7/14
- [ ] PR #37 forward-compat: scene component reads imageHook, ready for imageUrl swap

## Spec & plan
- Spec: `docs/superpowers/specs/2026-05-24-pr36-image-word-formation-design.md`
- Plan: `docs/superpowers/plans/2026-05-24-pr36-image-word-formation.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Watch CI, squash-merge**

```bash
gh pr checks <pr-number> --watch
gh pr merge <pr-number> --squash --delete-branch
```

- [ ] **Step 6: Update CLAUDE.md on main**

```bash
git checkout main && git pull --ff-only
```

Edit `CLAUDE.md` per spec §9: update "last refreshed" date, append PR #36 entry, append landmine.

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record PR #36 (image_word text-stimulus + V2 AI pipeline)"
git push
```

(Branch protection on main allows the docs-only commit via admin bypass, matching prior pattern.)

---

## Self-review notes

**1. Spec coverage**: every section maps to a task:
- §3.1 (data model) → Task 1
- §3.2 (AI pipeline V2) → Task 2
- §3.3 (scene component) → Task 3
- §3.4 (scene_templates seed) → Task 1 (in migrate.ts second phase)
- §3.5 (compile changes) → Task 5
- §3.6 (pool/SceneRunner wiring) → Task 4
- §3.7 (backfill script) → Task 6
- §4 (tests) → distributed across Tasks 2, 3, 5
- §5 (post-merge scripts) → Task 7
- §6 (PR #37 forward-plan) → not in this PR (reference only)
- §8 (verification) → Task 7

**2. Placeholder scan**: every code block is concrete. Two "read the existing file" notes (Step 2 of Task 4 + Step 5 of Task 3) are precise instructions, not placeholders.

**3. Type consistency**:
- `CharacterWord` shape defined in Task 3 (component) + Task 4 (SceneRunner) — same fields {id, text, imageHook, meaningEn}.
- `ImageWordConfig` defined in Task 3, consumed by Task 4 + Task 5.
- `PracticeSizing.imageWord` introduced in Task 5; existing fields preserved.
- `BOSS_UNLOCK_PRACTICE_THRESHOLD` bumped in Task 3 (configs.ts) — used by hub + route guard (no additional changes needed in those consumers; they read the constant by name).
- `firstWord` preserved on pool items for word_match back-compat (Task 4 Step 5).

## Execution Handoff

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task with two-stage review. Same pattern that shipped PRs #30–#35.
2. **Inline execution with checkpoints** — execute tasks here with pauses at natural boundaries.

Which approach?
