/**
 * Backfill words.image_hook for words where image_hook IS NULL.
 *
 * For each word: ask DeepSeek for a kid-friendly visual description, then
 * UPDATE words SET image_hook = ... WHERE id = ... AND image_hook IS NULL.
 *
 * Idempotent — skips words that already have image_hook set. Re-runnable
 * after partial failure (retries NULLs only).
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

Output a JSON object {"imageHook": "..."} where imageHook is a vivid visual
description (max 120 characters) of the word's meaning. No proper nouns, no
text in scene. Examples:
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
  const { eq, isNull } = await import('drizzle-orm');

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
          await db.update(words).set({ imageHook: hook }).where(eq(words.id, w.id));
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
