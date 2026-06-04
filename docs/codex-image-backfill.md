# Codex handoff — image backfill for `hanzi-quest`

**Repo:** `/Users/jiangwei/Claude/Chinese`  (production at `hanzi-adventure.vercel.app`)
**Last refreshed:** 2026-06-04

---

## ⚡ Quick start (read this, then go)

You're resuming an in-progress backfill. **283 of 426 words are already done; 143 remain.** Generate one cartoon image per remaining word, upload to Vercel Blob, write the URL back to Postgres.

The minimal loop, per word:

1. **Fetch** the 143 eligible rows (`image_url IS NULL AND image_hook IS NOT NULL`) — query in §1.
2. **Prompt** = the fixed preamble + the row's `image_hook`, verbatim — §2.
3. **Generate** a 512×512 PNG with any provider you have working — §6.
4. **Upload** to Blob at `words/{id}.png` (`addRandomSuffix:false, allowOverwrite:true, access:'public'`) — §4.
5. **UPDATE** `words.image_url = <blob url> WHERE id = <id> AND image_url IS NULL` — §5.

Env (`.env.local`, already populated, gitignored): `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`.

**Fastest path if you keep the prior session's provider/script:** just re-run your driver — the SQL filter (`image_url IS NULL`) means it auto-skips the 283 already done and only does the remaining 143. No state to reset.

**Done when:** `SELECT COUNT(*) FROM words WHERE image_url IS NULL AND image_hook IS NOT NULL` returns **0**. Verify with `pnpm tsx scripts/verify-image-url-column.ts` (§7).

The rest of this doc is the full contract (unchanged from prior runs) — skim only if you need a detail.

---

## 0. Progress log

| Date | Total words | `image_url` NULL | Done | Note |
|---|---|---|---|---|
| 2026-05-28 | 426 | 422 | 4 | Pollinations proof-of-life only; free tier blocked batch |
| **2026-06-04** | **426** | **143** | **283** | Prior provider run cleared 283; 143 left |

If the NULL count above is stale when you start, trust the live query in §1 — that's ground truth.

---

## 1. Inputs — what to generate

Read prompts from the production Neon Postgres. Each row is one `words` record with a non-null `image_hook` and a null `image_url`.

```sql
-- Fetch all eligible words. Each row = one image to generate.
SELECT id, text, image_hook
FROM words
WHERE image_url IS NULL
  AND image_hook IS NOT NULL;
```

- `id` (uuid string) — use this as the Blob path key + the row to UPDATE
- `text` (string) — the Chinese 词 (e.g. "红花", "小朋友"). For your own logging/triage only; **do not** put it in the prompt.
- `image_hook` (string) — the kid-friendly English description from an earlier authoring pass. Use it verbatim after the style preamble (next section).

Connection string lives in `.env.local` as `DATABASE_URL`. Pooled URL works fine.

---

## 2. Style preamble — must prepend, do not modify

Every prompt sent to the image model must be:

```
cartoon illustration for children, bright colors, simple, single subject, no text: {image_hook}
```

Exact prefix, including the trailing colon + space. This keeps the new 143 visually consistent with the 283 already in prod. **Do not** add extra style language ("Pixar style", "watercolor", "high detail") — they look out of place next to the existing images.

Source of truth for the preamble is `src/lib/ai/pollinations.ts` constant `POLLINATIONS_STYLE_PREAMBLE`. If you change it, update that constant too — and be aware you'd then need to regen the already-done images for consistency.

---

## 3. Image specs

- **Format:** PNG (the done images serve PNG — keep it format-uniform)
- **Size:** 512×512 (source size; the UI renders at 192px so 512 is plenty)
- **Aspect:** square
- **No watermark / no provider logo** if the provider supports a flag (Pollinations: `nologo=true`)

---

## 4. Output contract — Vercel Blob

Each generated image must be uploaded to Vercel Blob at a deterministic path:

```
words/{wordId}.png
```

Use `addRandomSuffix: false` and `allowOverwrite: true` so the URL is stable (re-runs overwrite in place). Public access.

```ts
import { put } from '@vercel/blob';

const blob = await put(`words/${wordId}.png`, pngBytes, {
  access: 'public',
  contentType: 'image/png',
  addRandomSuffix: false,
  allowOverwrite: true,
});
// blob.url is the public URL to persist to the DB
```

The Blob store is already public (created 2026-05-28). `.env.local` has both `BLOB_READ_WRITE_TOKEN` and `BLOB_STORE_ID`. Reference store: `mfl7ap4djy0w98ey.public.blob.vercel-storage.com`.

**Landmine:** Vercel Blob distinguishes public vs private *at store creation*. The current store IS public — do not flip it. If you must recreate, select public at creation; the dashboard toggle on an existing private store does not reliably work.

---

## 5. Database write — idempotent UPDATE

After upload succeeds, write the public URL back to Postgres, guarded by `image_url IS NULL` so concurrent runs can't double-write.

```sql
UPDATE words
SET image_url = $blobUrl
WHERE id = $wordId
  AND image_url IS NULL;
```

If 0 rows affected, someone else already populated this word — fine, skip and move on. Don't delete the just-uploaded Blob; it'll be orphaned-but-overwritable next time.

---

## 6. Provider notes (you decide)

What we've learned:

**Pollinations.ai (free, key-less) — broken for batch.** Free tier enforces "1 request queued per IP", and the server-side queue holds a slot indefinitely if your first request hangs past your client timeout. Measured 0 successes across multiple concurrency=1 attempts. **Do not** use the free tier for batch. Paid sub ($5/mo at `enter.pollinations.ai`) lifts the queue limit.

**Gemini API.** `GEMINI_API_KEY` is in `.env.local`. The free tier returns 429 RESOURCE_EXHAUSTED for `gemini-2.5-flash-image` — but the 283 already done suggest a working paid/billing-enabled path may already be set up. **Try this key first** — if it generates, you're done fastest. Pay-as-you-go is ~$0.039/image (≈ $5.60 for the remaining 143). Check billing at `aistudio.google.com/usage` if it 429s.

**Other viable providers** (untested by us): OpenAI `gpt-image-1` (~$0.011 low / $0.042 medium per image, needs API credits separate from ChatGPT Plus); Vertex AI Imagen (~$0.02/image, GCP billing + service account); Replicate / fal.ai / Together (often $0.003–$0.01/image).

Pick what works in your environment. The contract (prompt format, Blob path, DB column) is what matters — the provider is swappable.

---

## 7. Verification

After writing images, sanity-check from this repo:

```bash
pnpm tsx scripts/verify-image-url-column.ts
```

It prints:
- total `words` rows (should be 426)
- count of `image_url IS NULL` (should drop toward 0 as you backfill)
- count of NULL rows with a non-null `image_hook` (eligible-but-not-yet-done)

Spot-check one prod image renders:

```bash
curl -sS -o /tmp/check.png \
  "https://mfl7ap4djy0w98ey.public.blob.vercel-storage.com/words/$(psql "$DATABASE_URL" -tAc "SELECT id FROM words WHERE image_url IS NOT NULL LIMIT 1").png"
file /tmp/check.png   # expect: PNG image data, 512 x 512
```

---

## 8. Reference implementation (provider-swappable)

`src/lib/ai/pollinations.ts` is the existing reference — same contract, just a Pollinations URL builder. If you implement a fresh provider, keep the public function signature:

```ts
export async function fetchAndUploadImage(
  imageHook: string,
  wordId: string,
): Promise<string>  // returns the public Blob URL
```

That keeps `src/lib/actions/images.ts` and `scripts/backfill-word-images.ts` unchanged — both call `fetchAndUploadImage` and don't care which provider produced the bytes.

**Recommended swap pattern:** create `src/lib/ai/{your-provider}.ts` exporting the same `fetchAndUploadImage` signature, then change the import line in `src/lib/actions/images.ts` and `scripts/backfill-word-images.ts`. Don't delete `pollinations.ts` — keep it as a fallback if the paid sub is enabled later.

The backfill driver at `scripts/backfill-word-images.ts` (`pnpm tsx scripts/backfill-word-images.ts`):
1. Loads `.env.local` (`DATABASE_URL` + `BLOB_READ_WRITE_TOKEN`)
2. Selects all `words WHERE image_url IS NULL AND image_hook IS NOT NULL`
3. For each, calls `fetchAndUploadImage(imageHook, wordId)`, then UPDATEs with the idempotency guard
4. Prints `.` per success and `FAIL {text}: {error}` per failure
5. Exits with final tally

Reuse this driver as-is — only the imported `fetchAndUploadImage` needs to change for a new provider. Because of the `image_url IS NULL` filter, re-running automatically skips the 283 done and only processes the 143 remaining.

---

## 9. Do not touch

- `src/db/schema/content.ts` — schema is correct (`image_url` from migration `0016_colossal_morbius.sql`)
- `src/components/scenes/ImageWordScene.tsx` — already handles both `imageUrl` set and null (text-card fallback)
- `src/lib/scenes/compile-week.ts` — `scene_config` stores only word IDs; image URLs flow at runtime via `getCharactersWithDetailsForWeek` → page pool mapper → `SceneRunner`. Adding image URLs is a pure DB write, **no recompile needed**.
- `words.image_hook` column — keep it; doubles as accessibility alt-text in `ImageWordScene`
- The already-done images — leave them; they're the visual anchor for the style to match.

---

## 10. Environment

`.env.local` (already populated; gitignored):

```
DATABASE_URL              # Neon prod (shared across envs on free tier — you ARE writing to prod)
BLOB_READ_WRITE_TOKEN     # Vercel Blob token for the public store
BLOB_STORE_ID             # store_mfL7AP4DJY0W98Ey
GEMINI_API_KEY            # Try first — 283 already done suggests a working path
DEEPSEEK_API_KEY          # Not relevant to image gen
```

If you add a new provider key (e.g. `OPENAI_API_KEY`), add it to `.env.local` only — do not commit. The file is gitignored.

---

## 11. Done criteria

- `SELECT COUNT(*) FROM words WHERE image_url IS NULL AND image_hook IS NOT NULL` returns **0**
- Spot-check 3 random `words.image_url` URLs in a browser — each renders a cartoon-kid 512×512 PNG consistent with the existing anchors
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` are green (only if you committed code changes; pure DB writes don't trigger this)

When done, drop a one-line summary back in the parent's chat (final count succeeded/failed + provider used). Then he returns here for next steps.
