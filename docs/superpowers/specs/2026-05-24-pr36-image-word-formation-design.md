# PR #36 — Image-prompted word formation

**Date:** 2026-05-24
**Author:** Claude + David (brainstorm)
**Status:** Spec — pending implementation plan

---

## 1. Goal

Add a new scene type `image_word` where Yinuo sees a kid-friendly AI-generated illustration + the base 字 she's learning, then picks the correct 词 (multi-char word containing that 字) from 4 candidates. The illustrations are generated via Flux Schnell through Vercel AI Gateway and stored in Vercel Blob. Two `image_word` slots are added to the sight segment of the practice block (12 → 14 scenes per full week). Old weeks are backfilled with a one-off script.

This is the deferred companion to PR #35 — the structural refactor shipped without image-word; this PR completes the trio of asks from the 2026-05-23 directive.

After this PR ships:
- Each ≥10-char week's practice grows from 12 → 14 scenes (added: 2 image_word in sight).
- New weeks generate per-word illustrations automatically during publish.
- The 10 already-published weeks get illustrations backfilled by a one-off script (~$1 total Flux cost).
- Boss-unlock threshold bumps 6 → 7 to keep the proportion ≈ 50% of practice cleared.
- Words without an image (e.g. Flux failure) gracefully fall back to extra `visual_pick` so the practice slot count stays at 14.

## 2. Locked decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Image provider | **Flux Schnell** (`black-forest-labs/flux-schnell`) via Vercel AI Gateway. ~$0.003/image, ~2s wall time. |
| Storage | **Vercel Blob** (`@vercel/blob`), public-read URLs. Filename: `word-images/<wordId>.png`. |
| Scene mechanic | **Image + base 字 → pick 词** from 4 options, all containing the base 字 where possible. |
| Generation timing | **Auto on week publish** (parallelized, concurrency=5, per-word try/catch). **Backfill script** for the 10 already-published weeks. |
| Compile placement | **+2 `image_word` slots in sight segment.** Practice grows 12 → 14 per full week. |
| Boss inclusion | **No.** Boss rotation stays at 5 types (audio_pick / visual_pick / image_pick / translate_pick / sentence_cloze) — image_word stays exclusive to practice. |
| Boss unlock threshold | **Bump 6 → 7** (~50% of new 14-scene practice; matches the proportion from PR #35). |
| Prompt source | **DeepSeek extends `WeekContent` schema** (V1 → V2) — each word gets a kid-friendly cartoon prompt as part of the existing scene-gen pipeline. Backfill script lazy-generates the prompt at run-time. |
| Image hook persistence | **Not persisted.** Hooks are used at generation time and discarded; only the resulting `words.image_url` is stored. |

## 3. Architecture

### 3.1 Data model

**Single column add** (migration 0012):

```sql
ALTER TABLE words ADD COLUMN image_url text;
```

Nullable. No backfill required (NULL means "image not generated yet"; compile gracefully handles).

**Schema source** (`src/db/schema/content.ts`):

```ts
export const words = pgTable('words', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  script: scriptKind('script').notNull().default('simplified'),
  pinyinArray: text('pinyin_array').array().notNull(),
  meaningEn: text('meaning_en'),
  audioUrl: text('audio_url'),
  imageUrl: text('image_url'),                  // NEW
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

**No new enum values, no new tables.** `image_word` is added to the existing `scene_type` enum.

### 3.2 AI pipeline — schema bump V1 → V2

**`src/lib/ai/schemas.ts`** (extend Word):

```ts
export const Word = z.object({
  text: z.string().min(1).max(8),
  pinyin: PinyinArray,
  meaningEn: z.string().min(1).max(80),
  imageHook: z.string().min(3).max(120).describe(
    'A child-friendly cartoon prompt describing the word\'s meaning visually. Single subject, bright flat style, no text. Used as the Flux image-gen prompt. e.g. for 大人: "a smiling adult standing next to a small child, simple flat cartoon, pastel colors".',
  ),
});
```

Bump `WeekContentSchemaV1` → `WeekContentSchemaV2`. The version bump is purely additive (no rename), so V1-shaped responses would still validate, but we declare V2 to make the change explicit in `PROMPT_VERSION`.

**`src/lib/ai/prompts/generate-week-v1.ts`** → `generate-week-v2.ts`: add a paragraph to the system prompt explaining the imageHook requirement per word, with examples.

### 3.3 Image generation flow

**`src/lib/ai/generate-images.ts`** (new):

```ts
import { put } from '@vercel/blob';
import { experimental_generateImage as generateImage } from 'ai';

interface GenInput { wordId: string; prompt: string }
interface GenOutput { wordId: string; imageUrl: string | null; error?: string }

export async function generateAndStoreImage(input: GenInput): Promise<GenOutput> {
  try {
    const { image } = await generateImage({
      model: 'black-forest-labs/flux-schnell',  // routed via Vercel AI Gateway
      prompt: input.prompt,
      size: '1024x1024',
    });
    const blob = await put(
      `word-images/${input.wordId}.png`,
      image.uint8Array,
      { access: 'public', contentType: 'image/png', addRandomSuffix: false },
    );
    return { wordId: input.wordId, imageUrl: blob.url };
  } catch (e) {
    return {
      wordId: input.wordId,
      imageUrl: null,
      error: e instanceof Error ? e.message : 'unknown',
    };
  }
}

export async function generateImagesForWordsInBatch(
  inputs: GenInput[],
  concurrency = 5,
): Promise<GenOutput[]> {
  // simple p-limit-style batching; no extra deps
  const results: GenOutput[] = [];
  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency);
    const out = await Promise.all(batch.map(generateAndStoreImage));
    results.push(...out);
  }
  return results;
}
```

**Inlined into `generateWeekContent`** (`src/lib/ai/generate-content.ts`):

After persisting characters + words + sentences, before flipping the week to `awaiting_review`:

```ts
const allWords = await getAllWordsForWeek(input.weekId);  // {id, imageHook} pairs
const imageInputs = allWords.map((w) => ({ wordId: w.id, prompt: w.imageHook }));
const imageResults = await generateImagesForWordsInBatch(imageInputs, 5);

const successes = imageResults.filter((r) => r.imageUrl !== null);
const failures = imageResults.filter((r) => r.imageUrl === null);

for (const ok of successes) {
  await db.update(words).set({ imageUrl: ok.imageUrl }).where(eq(words.id, ok.wordId));
}
if (failures.length > 0) {
  console.warn(`[generate-week] image gen failed for ${failures.length} words:`, failures);
}
```

This adds ~30s wall time to publish (30 words × 2s wall, parallelized at concurrency=5 → 30/5 × 2s = 12s). Acceptable; David is the only one waiting for publishes.

**Failure handling:** per-word try/catch is already in `generateAndStoreImage`. A whole batch failure (Flux outage) leaves all images NULL; week still flips to `awaiting_review` and compile gracefully skips image_word slots. David re-runs the backfill script later when Flux recovers.

### 3.4 The `image_word` scene type

**Config schema** (`src/lib/scenes/configs.ts`):

```ts
export const ImageWordConfigSchema = z.object({
  characterId: z.string().uuid(),       // base 字 being practiced
  wordId: z.string().uuid(),             // correct answer
  distractorWordIds: z.array(z.string().uuid()).length(3),
  ...withSegment,
});
export type ImageWordConfig = z.infer<typeof ImageWordConfigSchema>;
```

**Scene component** `src/components/scenes/ImageWordScene.tsx`:

```tsx
'use client';

import Image from 'next/image';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';
import { shuffle } from '@/lib/scenes/sample';

interface WordOption {
  wordId: string;
  text: string;
  imageUrl: string | null;
  meaningEn: string | null;
}
interface CharacterDetail { characterId: string; hanzi: string }

interface Props {
  baseChar: CharacterDetail;
  correctWord: WordOption;          // must have imageUrl
  distractors: WordOption[];         // 3 wrong words
  onComplete: (correct: boolean) => void;
}

export function ImageWordScene({ baseChar, correctWord, distractors, onComplete }: Props) {
  // useMemo'd elsewhere in real impl; sketch only
  const choices = shuffle([correctWord, ...distractors]).map((w) => ({
    key: w.wordId,
    label: <span className="text-3xl font-extrabold">{w.text}</span>,
    isCorrect: w.wordId === correctWord.wordId,
  }));

  return (
    <MultipleChoiceQuiz
      prompt={
        <span>
          看图选词 / Pick the word{' '}
          <span className="rounded-md bg-amber-200 px-2 py-0.5 text-2xl font-extrabold text-amber-900">
            {baseChar.hanzi}
          </span>
        </span>
      }
      stimulus={
        correctWord.imageUrl ? (
          <Image
            src={correctWord.imageUrl}
            alt={correctWord.meaningEn ?? correctWord.text}
            width={280}
            height={280}
            className="rounded-2xl border-4 border-amber-800/30 shadow-lg"
            unoptimized   // Vercel Blob is already optimized
          />
        ) : null
      }
      choices={choices}
      onComplete={onComplete}
    />
  );
}
```

**SceneRunner integration**: `SceneType` discriminated union extended with `'image_word'`; new `case 'image_word'` in the switch that resolves `wordId` + `distractorWordIds` from `pool`/`charactersById`.

**Pool/CharacterDetail extension**: the existing `pool` items include `firstWord`. We need access to *all* words and image URLs. Extend `CharacterDetail.words` from `firstWord: string | null` to `words: Array<{ id: string; text: string; imageUrl: string | null; meaningEn: string | null }>` in the runner-side type. Section-page builds `pool` accordingly (cheap — already fetched).

### 3.5 scene_templates seed

Migration 0012 includes a second-phase data step (idempotent), same pattern as PR #30's pinyin/translate/cloze seeds in `scripts/migrate.ts`:

```sql
INSERT INTO scene_templates (type, version, default_config, is_active)
SELECT * FROM (VALUES ('image_word'::scene_type, 1::smallint, '{}'::jsonb, true)) AS new_rows(t, v, c, a)
WHERE NOT EXISTS (
  SELECT 1 FROM scene_templates st WHERE st.type = new_rows.t AND st.version = new_rows.v
);
```

`scene_type` enum already contains all 10 values today; no enum ALTER needed for `image_word` IF it's already in the enum. Let me verify by reading the schema before plan stage. (Note: per current `src/db/schema/game.ts` the enum is `['flashcard', 'audio_pick', 'visual_pick', 'image_pick', 'word_match', 'tracing', 'boss', 'pinyin_pick', 'translate_pick', 'sentence_cloze']`. **`image_word` is NOT in the enum** — needs `ALTER TYPE scene_type ADD VALUE 'image_word'`. Migration 0012 must include this in its first phase, followed by the template seed in second phase, matching the existing two-phase pattern.)

### 3.6 Compile changes

`src/lib/scenes/compile-week.ts` — extend sight segment to include up to 2 `image_word` slots:

```ts
if (sizing.sight > 0) {
  // ... existing image_pick / visual_pick / word_match emission ...

  // NEW: image_word slots at the end of sight segment
  const imageWordId = tmplByType.get('image_word');
  if (imageWordId) {
    const imageWordSlots = computeImageWordSlots(N);   // 2 at N>=10, 1 at 4-9, 1 at 2-3, 0 otherwise
    const eligibleChars = chars.filter((c) =>
      c.words.some((w) => w.imageUrl !== null),
    );
    let imageWordEmitted = 0;
    for (let slot = 0; slot < imageWordSlots && eligibleChars.length > 0; slot++) {
      const target = pickRandom(eligibleChars);
      const correctWord = pickRandom(target.words.filter((w) => w.imageUrl !== null));
      // distractors: other words from this week, preferring same base char
      const allOtherWords = chars
        .flatMap((c) => c.words.filter((w) => w.id !== correctWord.id))
        .map((w) => w.id);
      const distractors = shuffle(allOtherWords).slice(0, 3);
      if (distractors.length < 3) break;
      push(
        imageWordId,
        {
          characterId: target.id,
          wordId: correctWord.id,
          distractorWordIds: distractors,
        },
        'sight',
        `practice:image_word:${slot}`,
      );
      imageWordEmitted++;
    }
    // Fallback: any slot not filled becomes an extra visual_pick
    const visualId = tmplByType.get('visual_pick');
    if (imageWordEmitted < imageWordSlots && visualId) {
      for (let i = imageWordEmitted; i < imageWordSlots; i++) {
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
}

function computeImageWordSlots(n: number): number {
  if (n < 2) return 0;
  if (n < 4) return 1;
  if (n < 10) return 1;
  return 2;
}
```

**Updated `computePracticeSizing` table:**

| chars | audio | sight (existing + image_word) | meaning | total practice |
|---|---|---|---|---|
| < 2  | 0 | 0   | 0 | 0  |
| 2–3  | 1 | 1+1 | 4 | 7  |
| 4–9  | 2 | 2+1*  | 6 | 11–12 |
| ≥ 10 | 3 | 3+2 | 6 | 14 |

(* if `sizing.sight = 2`, can only fit 2 sight scenes total; image_word slot becomes 1 even though full mid-tier sizing allows it. Need to extend sizing to expose image_word count separately. Plan stage will codify this.)

Cleaner: extend `PracticeSizing` to `{ audio, sight, imageWord, meaning }`:

```ts
function computePracticeSizing(n: number): PracticeSizing {
  if (n < 2)  return { audio: 0, sight: 0, imageWord: 0, meaning: 0 };
  if (n < 4)  return { audio: 1, sight: 1, imageWord: 1, meaning: 4 };  // 7 practice
  if (n < 10) return { audio: 2, sight: 2, imageWord: 1, meaning: 6 };  // 11 practice
  return { audio: 3, sight: 3, imageWord: 2, meaning: 6 };              // 14 practice
}
```

Boss-unlock threshold becomes `BOSS_UNLOCK_PRACTICE_THRESHOLD = 7` (was 6). Single-line change in `configs.ts`. Spec §1 table updated to match.

### 3.7 RSC boundary

The section page (server) builds the `pool` and `charactersById` it passes to `SceneRunner` (client). To support `image_word`, the `pool` items need each character's word list (including `imageUrl`). This is pure JSON — no functions, no React components — so the RSC boundary is safe. Per the CLAUDE.md landmine about function-bearing objects: not applicable here.

Concrete prop extension:
```ts
// Today
firstWord: c.words[0]?.text ?? null,
// Becomes
words: c.words.map((w) => ({
  id: w.id,
  text: w.text,
  imageUrl: w.imageUrl ?? null,
  meaningEn: w.meaningEn ?? null,
})),
```

`firstWord` is removed (or kept as a derived getter on the client side if any other scene type used it; grep confirms only word_match uses it indirectly via the `pool`).

## 4. Backfill script

**`scripts/backfill-word-images.ts`** (one-off, idempotent):

```ts
/**
 * Backfill word images for words where image_url IS NULL.
 *
 * Steps per word:
 *   1. Build a prompt: ask DeepSeek for a kid-friendly cartoon description
 *      ("A child-friendly cartoon illustration of <word> (<meaningEn>), single
 *       subject, bright flat style, no text.")
 *   2. Generate via Flux Schnell + upload to Vercel Blob.
 *   3. UPDATE words SET image_url = ... WHERE id = ...
 *
 * Idempotent — skips words with image_url already set. Re-runnable after
 * partial failure.
 *
 * Usage: pnpm tsx scripts/backfill-word-images.ts
 * Cost: ~$0.003 per word.
 *
 * CAUTION: writes to prod via shared DATABASE_URL on Neon free tier.
 */
```

Cost: ~$1 total for the 10 prod weeks (~300 words). Wall time: ~2 min at concurrency=5.

Failure mode: re-run skips already-imaged words and retries NULLs.

## 5. Tests (Vitest, mocking `@/db`, `@vercel/blob`, `ai`, `next/cache`, `next/navigation`)

1. **`tests/unit/generate-and-store-image.test.ts`**
   - Happy path: prompt → Flux returns bytes → Blob upload returns URL → output has imageUrl.
   - Flux throws → output has imageUrl=null + error message.
   - Batch of 5: all succeed in one call. 3 succeed + 2 fail → results in correct order.

2. **`tests/unit/image-word-scene.test.tsx`**
   - Renders an `<img>` with the correct src.
   - Renders 4 choice buttons; clicking the correct word → `onComplete(true)`.
   - Clicking a distractor → `onComplete(false)`.

3. **`tests/unit/compile-week-image-word.test.ts`**
   - 10-char week with all words having imageUrl → 2 image_word scenes in sight segment.
   - 10-char week with 0 words having imageUrl → 0 image_word; falls back to 2 extra visual_pick (sight still totals 5).
   - 5-char week → 1 image_word slot (per scaling).
   - Distractor selection: never includes the correct word; always 3 distractors; pulled from same week.

4. **`tests/unit/configs-image-word.test.ts`**
   - Valid config parses.
   - Missing `distractorWordIds` rejects.
   - distractorWordIds length 2 or 4 rejects.

5. **`tests/unit/section-route-image-word.test.ts`**
   - Section page's `pool` includes `words: [{id, text, imageUrl}]` per character.

## 6. Scripts run after merge

```bash
# 1. Apply migration 0012 (image_url column + image_word scene_template seed + scene_type ADD VALUE)
pnpm tsx scripts/migrate.ts

# 2. Backfill word images for the 10 prod weeks (~$1, ~2 min)
pnpm tsx scripts/backfill-word-images.ts

# 3. Recompile all weeks so image_word scenes appear
pnpm tsx scripts/recompile-all-weeks.ts
```

All three are idempotent.

## 7. Out of scope

- **Image regeneration UI** in the parent admin. If a generated image is wrong, David nulls `words.image_url` manually and re-runs backfill.
- **Image moderation pipeline** beyond Flux's built-in safety filter.
- **Multi-language alt text** (alt is `meaningEn` only).
- **Image edit on word edit** (rare event; manual today).
- **CDN tuning** — Vercel Blob's defaults are fine.
- **Adding image_word to boss rotation** — explicitly excluded; boss stays at 5 types.

## 8. Verification (pre-PR-open)

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — 4-green.
2. `pnpm tsx scripts/migrate.ts` against dev (or prod via shared URL) — confirms migration 0012 applies.
3. Run backfill on dev — confirm ~30 words get imageUrl populated.
4. Run recompile-all-weeks — confirm a full-size week has 14 practice scenes (was 12).
5. `pnpm dev`:
   - Open `/play/<childId>/week/<weekId>/practice` — verify image_word scenes appear in sight block.
   - Image renders. Click correct → green; click wrong → red.
   - Boss locked until 7/14 cleared (was 6/12); confirm lock copy reflects new numbers.
6. Publish a new dev week — confirm publish takes ~30s longer than before and that all words have imageUrl after.
7. Manually null a word's image_url + re-run backfill → just that word regenerates.

## 9. CLAUDE.md updates after merge

Under "Current state":
> PR #36 (shipped YYYY-MM-DD) — Image-prompted word formation. New `image_word` scene type woven into the sight segment of practice; 2 slots per full week. Practice grows 12 → 14 scenes per ≥10-char week; boss-unlock threshold bumps 6 → 7. AI scene-gen pipeline extended to V2 (each 词 gets a kid-friendly cartoon prompt; Flux Schnell via Vercel AI Gateway generates images; Vercel Blob stores them). New `words.image_url` column (migration 0012). One-off `scripts/backfill-word-images.ts` covered the 10 existing weeks (~$1 Flux cost).

Under "Landmines":
> **Image generation is best-effort.** `generateWeekContent` per-word try/catches Flux + Blob failures and leaves `words.image_url = NULL` on failure; the week still publishes. Compile-week skips image_word slots for words without images and emits extra visual_pick as fallback. To regenerate after a failure: null the row + re-run `scripts/backfill-word-images.ts`. **Don't** make the publish path fail-loud on image errors — that would block all of Yinuo's new content for a single rate-limit blip.

> **Word images use Vercel Blob with stable filenames.** Path is `word-images/<wordId>.png`. `put(..., { addRandomSuffix: false })` ensures re-runs overwrite the same blob (no orphaning). If a wordId is ever recycled (very rare), the new image silently overwrites — acceptable.

## 10. Implementation order (preview for plan stage)

1. **Schema + migration 0012**: `words.image_url` column + `scene_type` enum `'image_word'` value + second-phase scene_templates seed for `image_word`.
2. **Image generation primitives**: `src/lib/ai/generate-images.ts` with `generateAndStoreImage` + `generateImagesForWordsInBatch`. Vercel AI Gateway + Vercel Blob bindings. Unit tests.
3. **AI pipeline V2**: bump `WeekContentSchemaV1 → V2` to include per-word imageHook; update prompt template; inline image-gen step in `generateWeekContent` post-text-persist.
4. **Scene config + component**: `ImageWordConfigSchema` in configs.ts; `ImageWordScene.tsx`; tests.
5. **SceneRunner integration**: extend SceneType union, add switch case, extend pool/CharacterDetail to include `words[]` with imageUrl.
6. **Compile-week**: image_word slot emission with eligibility + fallback. Update `computePracticeSizing`. Bump `BOSS_UNLOCK_PRACTICE_THRESHOLD = 7`. Tests.
7. **Backfill script**: `scripts/backfill-word-images.ts`. Idempotent. Per-word lazy prompt via DeepSeek one-shot.
8. **Section page / pool extension**: ensure `words[]` flows from server to SceneRunner.
9. **4-green + manual smoke + PR**.
10. **Post-merge**: migrate + backfill + recompile against prod.

## 11. Risk & rollback

- **Migration**: enum ADD VALUE + column add + scene_template insert. Two-phase (per the existing `scripts/migrate.ts` pattern). Rollback = drop the column + remove the scene_template row (ADD VALUE is irreversible but inert if unused).
- **Image-gen during publish**: adds ~30s wall time + a new failure surface. Mitigated by per-word try/catch and graceful compile fallback.
- **Vercel Blob cost**: trivial (~$0.15/month at 10 weeks × 30 words × 2MB).
- **Vercel AI Gateway cost**: ~$0.09/week ongoing.
- **Flux quality**: if illustrations are wrong-feeling in practice, the fix is to refine the system-prompt for imageHook generation. Cheap iteration.
- **Compile threshold change**: bumping boss-unlock 6 → 7 means kids who were "almost there" need 1 more clear. Minor friction; matches the new practice size.
