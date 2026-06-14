/**
 * Generate pronunciation audio for words + characters via Cloudflare Workers AI
 * (MeloTTS, Chinese). Consistent, high-quality clips — replaces the per-device
 * browser TTS as the primary voice (the app falls back to TTS when a clip is
 * absent or fails to play). Keyless beyond the existing CF + Blob creds.
 *
 * Usage:
 *   CF_ACCOUNT_ID=… CF_API_TOKEN=… pnpm tsx scripts/generate-audio-cloudflare.ts
 *   (also reads .env.local; BLOB_READ_WRITE_TOKEN must be set there)
 *
 * Scope: every word/character with a NULL/empty `audio_url`. Idempotent — skips
 * rows that already have audio. Uploads to Blob at `audio/words/{id}.mp3` /
 * `audio/chars/{id}.mp3` and writes the URL back.
 */

import { config } from 'dotenv';

const CF_MODEL = '@cf/myshell-ai/melotts';
const CONCURRENCY = 3;

async function ttsOne(text: string, acct: string, token: string): Promise<Buffer> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${CF_MODEL}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, lang: 'zh' }),
      signal: AbortSignal.timeout(40_000),
    },
  );
  if (!res.ok) throw new Error(`CF ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = (await res.json()) as { success: boolean; result?: { audio?: string }; errors?: unknown };
  const b64 = json.result?.audio;
  if (!json.success || !b64) throw new Error(`CF returned no audio: ${JSON.stringify(json.errors)}`);
  return Buffer.from(b64, 'base64');
}

async function main() {
  config({ path: '.env.local' });
  const acct = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!acct || !token) throw new Error('Set CF_ACCOUNT_ID and CF_API_TOKEN.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Set BLOB_READ_WRITE_TOKEN in .env.local.');

  const { db } = await import('@/db');
  const { words, characters } = await import('@/db/schema');
  const { and, eq, isNull, isNotNull, or } = await import('drizzle-orm');
  const { put } = await import('@vercel/blob');

  const wordRows = await db
    .select({ id: words.id, text: words.text })
    .from(words)
    .where(or(isNull(words.audioUrl), eq(words.audioUrl, '')));
  const charRows = await db
    .select({ id: characters.id, text: characters.hanzi })
    .from(characters)
    .where(and(isNotNull(characters.hanzi), or(isNull(characters.audioUrl), eq(characters.audioUrl, ''))));

  const jobs: Array<{ kind: 'words' | 'chars'; id: string; text: string }> = [
    ...wordRows.map((r) => ({ kind: 'words' as const, id: r.id, text: r.text })),
    ...charRows.map((r) => ({ kind: 'chars' as const, id: r.id, text: r.text })),
  ];
  console.log(`\n${jobs.length} clips to generate (${wordRows.length} words + ${charRows.length} chars).\n`);

  let done = 0;
  let failed = 0;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (job) => {
        try {
          const bytes = await ttsOne(job.text, acct, token);
          const blob = await put(`audio/${job.kind}/${job.id}.mp3`, bytes, {
            access: 'public',
            contentType: 'audio/mpeg',
            addRandomSuffix: false,
            allowOverwrite: true,
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          if (job.kind === 'words') {
            await db.update(words).set({ audioUrl: blob.url }).where(eq(words.id, job.id));
          } else {
            await db.update(characters).set({ audioUrl: blob.url }).where(eq(characters.id, job.id));
          }
          done += 1;
          console.log(`  ✅ [${done + failed}/${jobs.length}] ${job.kind} ${job.text} (${Math.round(bytes.length / 1024)}KB)`);
        } catch (err) {
          failed += 1;
          console.log(`  ❌ [${done + failed}/${jobs.length}] ${job.kind} ${job.text}: ${(err as Error).message}`);
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
