# PR #42 — Pollinations.ai Image Backfill (design spec)

> Date: 2026-05-27
> Status: design approved, plan pending
> Predecessor: PR #40 (multi-map chapter system)
> Companion: PR #36 (image_word scene type, V2 imageHook schema)

## 1. Goal

Populate `words.image_url` for the 238 existing words in prod using **Pollinations.ai** (free, key-less image gen) → upload to **Vercel Blob** → wire image generation into the V2 authoring pipeline so future weeks auto-generate, and swap `ImageWordScene`'s stimulus from a text-description card to the generated image with a graceful text fallback.

Five user-visible deliverables:

| # | What |
|---|---|
| 1 | `words.image_url` column added (migration 0016, nullable text) |
| 2 | One-off `scripts/backfill-word-images.ts` populates all 238 existing words |
| 3 | `ImageWordScene` renders `<img>` stimulus when `image_url` is set; falls back to existing text card otherwise |
| 4 | `generateWeekContent` triggers non-blocking image gen for newly authored weeks (image-gen failure does not block the week from reaching `awaiting_review`) |
| 5 | `regenerateCharacter` triggers image gen for the regenerated character's new word rows |

## 2. Architecture overview

Four small subsystems, all additive:

1. **Schema** — Migration 0016 adds `text image_url` (nullable) to `words` table. Existing `characters.image_url` column stays unused (separate future PR if needed).
2. **Image-gen library** (`src/lib/ai/pollinations.ts`) — pure `buildPollinationsUrl(imageHook, wordId)` for testability; `fetchAndUploadImage(imageHook, wordId)` fetches PNG bytes from Pollinations, uploads to Vercel Blob at `words/{wordId}.png`, returns the public URL.
3. **Authoring integration** — New `generateMissingImagesForWeek(weekId)` server action; called inside `generateWeekContent` after `persistWeekContent` + `setWeekStatus('awaiting_review')`, wrapped in try/catch so image-gen failure cannot roll back the week. Also called inside `regenerateCharacter` after the transaction commits.
4. **Scene swap** — `ImageWordScene` reads new `imageUrl` from each `WordOption`; renders `<img>` when set, else falls back to the existing text card. Backward-compat: old compiled levels lacking `imageUrl` in their `scene_config` JSON treat it as null and render the text card.

Total: 5 new files + 4 modified + 1 migration + 1 backfill script + 5 test files. ~350-450 LOC.

## 3. Schema changes

### Migration 0016 — words.image_url

```ts
// src/db/schema/content.ts — extend existing words declaration
export const words = pgTable('words', {
  // …existing columns…
  imageUrl: text('image_url'),  // NEW — nullable, populated by Pollinations backfill / authoring
});
```

Drizzle generates: `ALTER TABLE words ADD COLUMN image_url text;`

No backfill in the migration itself — the column starts NULL for all 238 existing rows, then `scripts/backfill-word-images.ts` populates them.

## 4. Pollinations URL construction

**Endpoint:** `https://image.pollinations.ai/prompt/{urlencoded_prompt}?{params}`

**Style preamble** (constant in `src/lib/ai/pollinations.ts`):
```
cartoon illustration for children, bright colors, simple, single subject, no text:
```

**Full prompt** = `${PREAMBLE} ${word.imageHook}`. The imageHook itself is already kid-friendly + single-subject per the V2 schema rules (`src/lib/ai/prompts/generate-week-v1.ts`), so the preamble just locks in the visual style.

**Query params** (baked into `buildPollinationsUrl`):
- `model=flux` — stylized output (vs `turbo` which is faster but more realistic-looking).
- `width=512&height=512` — square. Scene container is ~192px tall, so 512 is 2× retina-safe with headroom for any future zoom UX.
- `nologo=true` — strips the Pollinations watermark.
- `enhance=true` — Pollinations LLM-enhances short prompts. Cheap quality win.
- `seed={wordId-derived integer}` — deterministic. Re-running the backfill for the same word returns the same image (idempotent at Pollinations layer too). Hash: `parseInt(wordId.slice(0, 8), 16)`.

**Example:**
```
Word: 大象 (elephant), wordId: 8B2C3F47-…
imageHook: "a friendly grey elephant with a long trunk raised up"
Final URL: https://image.pollinations.ai/prompt/cartoon%20illustration%20for%20children%2C%20bright%20colors%2C%20simple%2C%20single%20subject%2C%20no%20text%3A%20a%20friendly%20grey%20elephant%20with%20a%20long%20trunk%20raised%20up?model=flux&width=512&height=512&nologo=true&enhance=true&seed=2334732103
```

### `fetchAndUploadImage(imageHook, wordId)` flow

1. `const url = buildPollinationsUrl(imageHook, wordId)`.
2. `const res = await fetch(url, { signal: AbortSignal.timeout(30000) })` — 30-second timeout per request (Pollinations queue can be slow at peak).
3. If `!res.ok`: throw `PollinationsError(status, url)`.
4. `const bytes = await res.arrayBuffer()`.
5. `const blob = await put('words/' + wordId + '.png', bytes, { access: 'public', contentType: 'image/png', addRandomSuffix: false, allowOverwrite: true })` — `@vercel/blob` returns `{ url }`. We use `addRandomSuffix: false` so the URL is stable at `https://{store-id}.public.blob.vercel-storage.com/words/{wordId}.png` and `allowOverwrite: true` so re-runs replace cleanly.
6. Return `blob.url`.

## 5. Server action

### `src/lib/actions/images.ts` (new, `'use server'`)

```ts
'use server';

export async function generateMissingImagesForWeek(weekId: string): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}>;
```

**Behavior:**
1. **Auth fence:** calls `auth()` from `@clerk/nextjs/server` and throws `UnauthenticatedError` if no session. The action is invoked server-internally from `generateWeekContent`, never from a kid client, but a defensive check protects against accidental wiring later.
2. **Query:** join `words ← character_word ← week_characters` to scope to the given week; filter `image_url IS NULL AND image_hook IS NOT NULL`. (Words without imageHook can't be image-genned — they'll keep the text fallback indefinitely.)
3. **Concurrency:** 5 in-flight Pollinations requests (lower than the 10 used by the local backfill — server-side this shares Vercel function CPU with other traffic).
4. **Per-word try/catch:** failure logged with word text + error; increments `failed`. Does not abort the batch.
5. **Returns counts** for caller logging. Caller does not act on them — image gen is best-effort.

**Errors live in `src/lib/errors/images-errors.ts`** (pure, client-safe): `PollinationsError`, `BlobUploadError`.

## 6. Authoring integration

### `src/lib/ai/generate-content.ts` — modifications

After `persistWeekContent(...)` + `setWeekStatus(input.weekId, 'awaiting_review')`, BEFORE `completeJob(...)`:

```ts
try {
  const result = await generateMissingImagesForWeek(input.weekId);
  console.log(
    `[images] week=${input.weekId} attempted=${result.attempted} succeeded=${result.succeeded} failed=${result.failed}`,
  );
} catch (err) {
  console.error('[images] failed for week', input.weekId, err);
}
```

If Pollinations is wholly unreachable, the week still reaches `awaiting_review` and `completeJob` records success — `image_word` scenes for that week's words simply render the text-card fallback until a later backfill run populates them.

The same try/catch wrapper goes into `regenerateCharacter` after its `db.transaction(...)` commits. Because `replaceCharacterWords` deletes old word rows and inserts new ones, the old blobs at `words/{oldWordId}.png` become orphans. We accept this — Vercel Blob storage cost for 238 words × occasional regen is negligible. Cleanup is a future PR.

## 7. Scene swap

### `src/lib/scenes/compile-week.ts` — projection update

The image_word scene's `WordOption` projection extends by one column:

```ts
type WordOption = {
  wordId: string;
  text: string;
  imageHook: string | null;
  meaningEn: string | null;
  imageUrl: string | null;   // NEW
};
```

After PR ships, run the existing `pnpm tsx scripts/recompile-all-weeks.ts` to refresh `scene_config` JSON across all 10 published weeks so previously-compiled `image_word` scenes pick up the new `imageUrl` field.

### `src/components/scenes/ImageWordScene.tsx` — stimulus swap

```tsx
const stimulusText = correctWord.imageHook ?? correctWord.meaningEn ?? correctWord.text;

const stimulus = correctWord.imageUrl ? (
  <div className="h-48 w-72 overflow-hidden rounded-2xl border-4 border-amber-800/30 bg-amber-50 shadow-lg">
    <img
      src={correctWord.imageUrl}
      alt={stimulusText}
      className="h-full w-full object-cover"
      loading="eager"
    />
  </div>
) : (
  // Existing text card — unchanged.
  <div className="flex h-48 w-72 items-center justify-center rounded-2xl border-4 border-amber-800/30 bg-gradient-to-br from-amber-50 via-sky-50 to-amber-50 p-5 text-center shadow-lg">
    <span className="mr-2 shrink-0 text-3xl" aria-hidden>✨</span>
    <p className="text-base font-semibold leading-snug text-amber-950">{stimulusText}</p>
  </div>
);
```

**`loading="eager"`** — scene appears immediately when the user advances; lazy-loading would flash a blank.

**No `next/image`** — Vercel Blob URLs aren't in `images.remotePatterns`. Raw `<img>` is fine: 512×512 PNG (~50-150 KB) served from Vercel Blob's CDN.

**Alt text** uses `imageHook ?? meaningEn ?? text` — satisfies screen readers AND preserves the imageHook usefulness called out in CLAUDE.md ("image_hook stays useful as accessibility alt-text").

## 8. One-off backfill script

### `scripts/backfill-word-images.ts` (new)

Mirrors the existing `scripts/backfill-word-image-hooks.ts` pattern (proven, idempotent, recoverable):

```ts
// 1. loadEnv() from .env.local then .env
// 2. Verify DATABASE_URL + BLOB_READ_WRITE_TOKEN are present.
// 3. Inside main(): dynamic-import @/db + words schema + drizzle eq/isNull.
// 4. SELECT id, text, image_hook FROM words WHERE image_url IS NULL AND image_hook IS NOT NULL.
// 5. Concurrency=10, batch loop. Per word:
//      try { url = await fetchAndUploadImage(hook, id); UPDATE words SET image_url = $url WHERE id = $id; succeeded++; }
//      catch (e) { failed++; console.error(text, e.message); }
// 6. Progress dots to stdout; summary at end.
```

**Runtime expectations:** Pollinations averages 3-8s per image. At concurrency=10 and 238 words → ~80-180s total wall time. Expected near-100% success rate based on Pollinations' production track record; per-row failures are isolated and re-runnable (script picks up only NULL rows on re-run).

**CAUTION (banner in the script):** "writes to prod via shared `DATABASE_URL` on Neon free tier + shared `BLOB_READ_WRITE_TOKEN`." Mirrors the existing backfill scripts.

## 9. Testing

Vitest + RTL + jsdom; mock `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `@vercel/blob`, global `fetch`. No test hits real Pollinations or real Vercel Blob.

| File | Asserts |
|---|---|
| `tests/unit/lib/ai/pollinations.test.ts` | `buildPollinationsUrl` produces correct URL: preamble prepended; URL-encoded; query params `model=flux`, `width=512`, `height=512`, `nologo=true`, `enhance=true`, deterministic `seed` from wordId. |
| `tests/unit/lib/ai/pollinations-fetch.test.ts` | `fetchAndUploadImage`: success path (mocked fetch → bytes → `put` called with `words/{wordId}.png` → returns blob URL); fetch !ok throws `PollinationsError`; AbortError propagates. |
| `tests/unit/lib/actions/images.test.ts` | `generateMissingImagesForWeek`: returns counts; skips words where `imageUrl` already set; skips words where `imageHook` is NULL; per-word error doesn't fail batch (succeeded=N-1, failed=1); concurrency cap honored. |
| `tests/unit/components/scenes/ImageWordScene.test.tsx` (extend existing) | renders `<img>` with `src=imageUrl` + `alt=imageHook` when imageUrl set; renders text card when imageUrl null; MCQ flow still functional (3 distractors, 1 correct → onComplete(true)). |
| `tests/unit/lib/scenes/compile-week.test.ts` (extend) | image_word scene config carries `imageUrl` per WordOption; null when DB row has null; non-null pass-through. |

### Manual verification (before opening the PR)

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green.
2. Run `pnpm tsx scripts/backfill-word-images.ts` against prod DB. Expect ~80-180s wall time, ~238 succeeded, near-zero failed.
3. `pnpm dev`, sign in, open `/play/[childId]/level/<weekId>/practice` for any week with an `image_word` slot. Stimulus is a cartoon image, not the text card.
4. `UPDATE words SET image_url = NULL WHERE id = '<one wordId>'` — that word's scene falls back to the text card; other words still show images.
5. Test authoring: draft a fresh week via `/parent/weeks/new` with 1 new character + AI-gen. DeepSeek text-gen runs first; Pollinations images appear ~30s later (visible in `words.image_url` via a DB query). Confirm the week ships to `awaiting_review` even when Pollinations is forced to fail (e.g., temporarily break the URL builder).

## 10. Out of scope (explicit deferrals)

- **Orphaned blob cleanup** when `regenerateCharacter` replaces word rows. Vercel Blob storage is cheap; revisit if quota becomes a concern.
- **Parent-facing image-regeneration UI.** David uses `UPDATE words SET image_url = NULL WHERE …` + re-runs the backfill script. UI is YAGNI.
- **Character-level image backfill** (`characters.image_url` exists but unused). Words are the visible win for ImageWordScene; characters appear in FlashcardScene where the hanzi itself is the focus.
- **Sentence-level images** — `example_sentences` has no image column.
- **Style customization per pack.** Map 2 (Indian Ocean) when populated reuses the same `cartoon illustration for children` preamble.
- **CDN preconnect** to Pollinations or Vercel Blob in the play layout. Premature optimization.

## 11. File summary

**New (5):**
- `drizzle/0016_<name>.sql` — migration
- `src/lib/ai/pollinations.ts` — `buildPollinationsUrl`, `fetchAndUploadImage`
- `src/lib/actions/images.ts` — `generateMissingImagesForWeek` server action
- `src/lib/errors/images-errors.ts` — `PollinationsError`, `BlobUploadError` (pure, client-safe)
- `scripts/backfill-word-images.ts`

**Modified (4):**
- `src/db/schema/content.ts` — add `imageUrl` to `words` table
- `src/lib/ai/generate-content.ts` — call `generateMissingImagesForWeek` in `generateWeekContent` + `regenerateCharacter`
- `src/lib/scenes/compile-week.ts` — project `imageUrl` into image_word `scene_config`
- `src/components/scenes/ImageWordScene.tsx` — swap stimulus to `<img>` with fallback

**Tests:** 5 new/extended test files; ~30-40 assertions total.

**Net LOC:** ~350-450.

## 12. Dependencies

**New npm package:** `@vercel/blob` (not currently in `package.json`). The `BLOB_STORE_ID` + `BLOB_READ_WRITE_TOKEN` env vars are already provisioned in `.env.local` and on Vercel. Add via `pnpm add @vercel/blob`.

Pollinations.ai is HTTP-only (no SDK), uses global `fetch`.

## 13. Open questions (none blocking)

- **Image quality variance.** Pollinations + `flux` produces mostly good results but occasional misfires (e.g., text bleed even with `no text` in the prompt, hand mutations). Acceptable for V1; if Yinuo complains, we revisit prompt engineering or model (`flux-anime`, `flux-realism`) in a follow-up.
- **Rate limiting.** Pollinations has no published rate limits. If the authoring path triggers a flurry (10 words × 1 week regen), we may hit transient 429s. The per-word try/catch + idempotent re-runs handle this gracefully; if it becomes routine, we add explicit backoff.
- **Image moderation.** Pollinations claims SFW-by-default for the public endpoint. Inputs are kid-appropriate imageHooks. No additional moderation layer in V1.
