/**
 * Generate the illustrated sea-chart backdrop for each voyage map using
 * Cloudflare Workers AI (flux-1-schnell), upload to Vercel Blob, and PRINT the
 * URLs to paste into `VOYAGE_MAPS[slug].imageUrl` in src/lib/play/map-boards.ts.
 *
 * The image is a DECORATIVE backdrop only (no path / numbers / text) — the
 * board overlays its own route + numbered stops + ship on top.
 *
 * Credentials come from ENV (never hardcoded / committed):
 *   CF_ACCOUNT_ID, CF_API_TOKEN
 *
 * Run (ALWAYS scope it — see below):
 *   PREVIEW_DIR=/tmp/x ONLY_SLUG=pirate-class-level-2 pnpm tsx scripts/…   (look first)
 *   ONLY_SLUG=pirate-class-level-2 UPLOAD_FILE=/tmp/x/….jpg pnpm tsx scripts/…  (ship it)
 *
 * **Preview before uploading.** Cloudflare generation is cheap; a Vercel Blob
 * `put` is one of 2,000 advanced operations a month, and flux-1-schnell takes
 * NO seed (Cloudflare rejects the field), so generation cannot be reproduced —
 * re-rolling to "get that one back" is impossible. Preview to disk, look at the
 * images, then UPLOAD_FILE the one you chose.
 *
 * **ONLY_SLUG is not optional in practice.** Unscoped, this regenerates EVERY
 * configured map, and flux is non-deterministic — so a re-run does not refresh
 * a backdrop, it REPLACES a known-good one with a different random image, on a
 * map the child is already playing. It also spends one Vercel Blob advanced
 * operation per map against a 2,000/month free-tier budget (see the Blob
 * landmine in CLAUDE.md: generate each asset once, never bulk-regenerate).
 * Same convention as ONLY_PACK in scripts/zoom-collectible-art.ts.
 *
 * flux-1-schnell is fixed 1024² on CF; the board uses it `object-cover`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { config } from 'dotenv';

const STYLE =
  'a colorful cartoon pirate treasure map sea chart for children, aged parchment, blue ocean with gentle waves, a few small tropical islands, a large compass rose, a friendly cute sea monster, top-down map view, bright and playful, NO text, NO words, NO numbers, NO route lines, NO dotted path';

const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';

async function generateOne(
  prompt: string,
  acct: string,
  token: string,
): Promise<Buffer> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${CF_MODEL}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, steps: 6 }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!res.ok) {
    throw new Error(`CF ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    success: boolean;
    result?: { image?: string };
    errors?: unknown;
  };
  const b64 = json.result?.image;
  if (!json.success || !b64) {
    throw new Error(`CF returned no image: ${JSON.stringify(json.errors)}`);
  }
  return Buffer.from(b64, 'base64');
}

async function main() {
  config({ path: '.env.local' });

  const acct = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!acct || !token) {
    throw new Error('Set CF_ACCOUNT_ID and CF_API_TOKEN in the environment.');
  }

  const { put } = await import('@vercel/blob');
  const { VOYAGE_MAPS } = await import('@/lib/play/map-boards');

  const only = process.env.ONLY_SLUG;
  const all = Object.keys(VOYAGE_MAPS);
  if (only && !all.includes(only)) {
    throw new Error(`ONLY_SLUG=${only} is not a configured map. Known: ${all.join(', ')}`);
  }
  const slugs = only ? [only] : all;

  if (!only) {
    console.warn(
      `\n⚠️  UNSCOPED RUN — this will overwrite the backdrop of all ${all.length} maps\n` +
        `   with newly generated images. flux is non-deterministic, so existing\n` +
        `   artwork is replaced, not refreshed. Set ONLY_SLUG=<slug> to scope it.\n`,
    );
  }
  const previewDir = process.env.PREVIEW_DIR;
  const uploadFile = process.env.UPLOAD_FILE;
  if (uploadFile && !only) {
    throw new Error('UPLOAD_FILE requires ONLY_SLUG — it uploads one file to one map.');
  }
  console.log(
    uploadFile
      ? `\nUploading ${uploadFile} → maps/${only}.jpg (no generation)…\n`
      : `\nGenerating ${slugs.length} voyage map backdrop(s)` +
          `${previewDir ? ' — PREVIEW ONLY, nothing will be uploaded' : ''}…\n`,
  );

  const results: Record<string, string> = {};
  for (const slug of slugs) {
    const map = VOYAGE_MAPS[slug];
    const prompt = map.backdropPrompt ?? `${STYLE}, theme: ${map.nameEn}`;
    try {
      // UPLOAD_FILE ships a previously previewed image. flux-1-schnell takes
      // no seed (Cloudflare rejects the field outright — verified 2026-09-05),
      // so generation cannot be reproduced: the ONLY way to ship the image you
      // actually looked at is to upload that file rather than re-roll for it.
      const bytes = uploadFile
        ? await readFile(uploadFile)
        : await generateOne(prompt, acct, token);

      // PREVIEW_DIR writes the image locally and uploads NOTHING. Cloudflare
      // generation is cheap; a Vercel Blob `put` is one of 2,000 advanced
      // operations a month, so iterating on a prompt by uploading each attempt
      // burns the scarce resource to inspect the free one. Preview until the
      // image is right, then re-run the SAME seed without PREVIEW_DIR to
      // upload that exact image.
      if (previewDir) {
        const out = `${previewDir}/${slug}-${Date.now()}.jpg`;
        await writeFile(out, bytes);
        console.log(`  👁  ${slug} (${Math.round(bytes.length / 1024)}KB) → ${out} (NOT uploaded)`);
        continue;
      }

      const blob = await put(`maps/${slug}.jpg`, bytes, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false,
        allowOverwrite: true,
        // Explicit RW token (implicit env resolution misses it under dotenvx).
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      results[slug] = blob.url;
      console.log(`  ✅ ${slug} (${Math.round(bytes.length / 1024)}KB) → ${blob.url}`);
    } catch (err) {
      console.error(`  ❌ ${slug}: ${(err as Error).message}`);
    }
  }

  if (previewDir) {
    console.log(
      `\nPreviewed into ${previewDir}. Look at them, then ship the winner with:\n` +
        `  ONLY_SLUG=<slug> UPLOAD_FILE=<that file> pnpm tsx scripts/generate-voyage-map-art.ts\n`,
    );
    process.exit(0);
  }

  console.log('\nPaste into src/lib/play/map-boards.ts:');
  for (const [slug, url] of Object.entries(results)) {
    console.log(`  ${slug}: imageUrl: '${url}',`);
  }
  console.log('');
  process.exit(Object.keys(results).length === slugs.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
