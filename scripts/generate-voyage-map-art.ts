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
 * Run:
 *   CF_ACCOUNT_ID=xxx CF_API_TOKEN=yyy pnpm tsx scripts/generate-voyage-map-art.ts
 *
 * flux-1-schnell is fixed 1024² on CF; the board uses it `object-cover`.
 */
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

  const slugs = Object.keys(VOYAGE_MAPS);
  console.log(`\nGenerating ${slugs.length} voyage map backdrops…\n`);

  const results: Record<string, string> = {};
  for (const slug of slugs) {
    const map = VOYAGE_MAPS[slug];
    const prompt = `${STYLE}, theme: ${map.nameEn}`;
    try {
      const bytes = await generateOne(prompt, acct, token);
      const blob = await put(`maps/${slug}.jpg`, bytes, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      results[slug] = blob.url;
      console.log(`  ✅ ${slug} (${Math.round(bytes.length / 1024)}KB) → ${blob.url}`);
    } catch (err) {
      console.error(`  ❌ ${slug}: ${(err as Error).message}`);
    }
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
