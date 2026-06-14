/**
 * Backfill `words.image_url` via Cloudflare Workers AI (flux-1-schnell) — the
 * RELIABLE image path (Pollinations, used by the in-authoring `generateMissing
 * ImagesForWeek`, is rate-limited/flaky, so new weeks tend to land with NULL
 * image_url). Run this AFTER seeding/authoring a map's weeks so the 看图找字 /
 * 看图选词 scenes show real pictures instead of the text fallback.
 *
 * Usage:
 *   CF_ACCOUNT_ID=… CF_API_TOKEN=… pnpm tsx scripts/backfill-word-images-cloudflare.ts
 *   (both also read from .env.local; BLOB_READ_WRITE_TOKEN must be set there too)
 *
 * Scope: every word with a non-null `image_hook` and a NULL/empty `image_url`.
 * Idempotent: already-imaged words are skipped. Uploads to Blob at
 * `words/{wordId}.jpg` (stable path, overwrite-safe) and writes the URL back.
 */

import { config } from 'dotenv';

const STYLE_PREAMBLE =
  'cartoon illustration for children, bright colors, simple, single subject, no text: ';
const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const CONCURRENCY = 3;

async function generateOne(prompt: string, acct: string, token: string): Promise<Buffer> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${CF_MODEL}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, steps: 6 }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!res.ok) throw new Error(`CF ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { success: boolean; result?: { image?: string }; errors?: unknown };
  const b64 = json.result?.image;
  if (!json.success || !b64) throw new Error(`CF returned no image: ${JSON.stringify(json.errors)}`);
  return Buffer.from(b64, 'base64');
}

async function main() {
  config({ path: '.env.local' });
  const acct = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!acct || !token) throw new Error('Set CF_ACCOUNT_ID and CF_API_TOKEN.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Set BLOB_READ_WRITE_TOKEN in .env.local.');

  const { db } = await import('@/db');
  const { words } = await import('@/db/schema');
  const { and, eq, isNull, isNotNull, or } = await import('drizzle-orm');
  const { put } = await import('@vercel/blob');

  const rows = await db
    .select({ id: words.id, text: words.text, imageHook: words.imageHook })
    .from(words)
    .where(
      and(
        isNotNull(words.imageHook),
        or(isNull(words.imageUrl), eq(words.imageUrl, '')),
      ),
    );

  console.log(`\n${rows.length} words need pictures.\n`);
  let done = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        const prompt = `${STYLE_PREAMBLE}${row.imageHook}`;
        try {
          const bytes = await generateOne(prompt, acct, token);
          const blob = await put(`words/${row.id}.jpg`, bytes, {
            access: 'public',
            contentType: 'image/jpeg',
            addRandomSuffix: false,
            allowOverwrite: true,
            // Explicit RW token — implicit env resolution misses it under dotenvx (see #99).
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          await db.update(words).set({ imageUrl: blob.url }).where(eq(words.id, row.id));
          done += 1;
          console.log(`  ✅ [${done + failed}/${rows.length}] ${row.text} (${Math.round(bytes.length / 1024)}KB)`);
        } catch (err) {
          failed += 1;
          console.log(`  ❌ [${done + failed}/${rows.length}] ${row.text}: ${(err as Error).message}`);
        }
      }),
    );
  }

  console.log(`\nDone. ${done} generated, ${failed} failed.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
