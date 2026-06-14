/**
 * RE-generate ALL word images in one unified art style (CF flux) — for the
 * visual-consistency pass (existing word pictures were made by mixed
 * tools/prompts, so they don't match). Overwrites Blob + `words.image_url`.
 *
 * ⚠️ This OVERWRITES live art. Run only after David approves the style sample.
 * Tune `STYLE` to the approved look before running.
 *
 * Usage:
 *   CF_ACCOUNT_ID=… CF_API_TOKEN=… pnpm tsx scripts/regenerate-word-images-cloudflare.ts
 *   (also reads .env.local; BLOB_READ_WRITE_TOKEN required there)
 *
 * Idempotent path (words/{id}.jpg, overwrite-safe). Re-runnable. Failures are
 * logged (and skipped) so the run completes; re-run to retry stragglers.
 */

import { config } from 'dotenv';
import { UNIFIED_ART_STYLE } from '@/lib/ai/art-style';

const STYLE = UNIFIED_ART_STYLE;
const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const CONCURRENCY = 3;

/** Per-word prompt overrides for flux's (twitchy) NSFW false positives. Keyed by word text. */
const SUBJECT_OVERRIDE: Record<string, string> = {
  小鱼: 'a cute happy little cartoon fish swimming, single subject',
  鱼: 'a cute happy cartoon fish, single subject',
};

async function gen(prompt: string, acct: string, token: string): Promise<Buffer> {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${CF_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, steps: 6 }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`CF ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = (await r.json()) as { success: boolean; result?: { image?: string }; errors?: unknown };
  if (!j.success || !j.result?.image) throw new Error(`CF no image: ${JSON.stringify(j.errors)}`);
  return Buffer.from(j.result.image, 'base64');
}

async function main() {
  config({ path: '.env.local' });
  const acct = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!acct || !token) throw new Error('Set CF_ACCOUNT_ID and CF_API_TOKEN.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Set BLOB_READ_WRITE_TOKEN in .env.local.');

  const { db } = await import('@/db');
  const { words } = await import('@/db/schema');
  const { eq, isNotNull } = await import('drizzle-orm');
  const { put } = await import('@vercel/blob');

  const rows = await db
    .select({ id: words.id, text: words.text, hook: words.imageHook })
    .from(words)
    .where(isNotNull(words.imageHook));

  console.log(`\nRe-generating ${rows.length} word images in the unified style.\n`);
  let done = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        const subject = SUBJECT_OVERRIDE[row.text] ?? row.hook!;
        try {
          const bytes = await gen(`${STYLE}${subject}`, acct, token);
          const blob = await put(`words/${row.id}.jpg`, bytes, {
            access: 'public',
            contentType: 'image/jpeg',
            addRandomSuffix: false,
            allowOverwrite: true,
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          await db.update(words).set({ imageUrl: blob.url }).where(eq(words.id, row.id));
          done += 1;
          console.log(`  ✅ [${done + failed}/${rows.length}] ${row.text}`);
        } catch (err) {
          failed += 1;
          console.log(`  ❌ [${done + failed}/${rows.length}] ${row.text}: ${(err as Error).message}`);
        }
      }),
    );
  }
  console.log(`\nDone. ${done} regenerated, ${failed} failed.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
