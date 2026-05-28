/**
 * Backfill words.image_url for words where image_url IS NULL and image_hook IS NOT NULL.
 *
 * For each eligible word: build a Pollinations URL from the imageHook, fetch
 * the PNG bytes, upload to Vercel Blob at words/{wordId}.png, then
 * UPDATE words SET image_url = $blobUrl WHERE id = $wordId AND image_url IS NULL.
 *
 * Idempotent — skips words that already have image_url set. Re-runnable
 * after partial failure (retries NULLs only).
 *
 * Usage: pnpm tsx scripts/backfill-word-images.ts
 * Cost: $0 (Pollinations is free). Wall time: ~80-180s at concurrency=10 for ~238 words.
 *
 * CAUTION: writes to prod via shared DATABASE_URL on Neon free tier and
 * shared BLOB_READ_WRITE_TOKEN.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN not set');
  process.exit(2);
}

async function main() {
  const { db } = await import('../src/db');
  const { words } = await import('../src/db/schema');
  const { fetchAndUploadImage } = await import('../src/lib/ai/pollinations');
  const { eq, and, isNull, isNotNull } = await import('drizzle-orm');

  const rows = await db
    .select({ id: words.id, text: words.text, imageHook: words.imageHook })
    .from(words)
    .where(and(isNull(words.imageUrl), isNotNull(words.imageHook)));

  console.log(`Found ${rows.length} words without image_url.`);
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
          const url = await fetchAndUploadImage(w.imageHook!, w.id);
          await db
            .update(words)
            .set({ imageUrl: url })
            .where(and(eq(words.id, w.id), isNull(words.imageUrl)));
          return { ok: true as const, word: w };
        } catch (e) {
          return {
            ok: false as const,
            word: w,
            error: e instanceof Error ? e.message : 'unknown',
          };
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
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
