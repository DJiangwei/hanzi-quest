/**
 * Generate real cartoon art for the 62 weak-emoji collectible cards using
 * Cloudflare Workers AI (flux-1-schnell), upload to Vercel Blob, and write the
 * URL into `collectible_items.image_url`.
 *
 * Scope: sea-creatures-v1 / dinosaurs-v1 / solar-system-v1 / landmarks-v1.
 * Flags (real flag emoji) + zodiac (procedural SVG) are intentionally excluded.
 *
 * Idempotent + error-isolated per card: re-running only processes rows whose
 * image_url is not yet an http(s) URL, and one failed card never aborts the run.
 *
 * Credentials come from ENV (never hardcoded / committed):
 *   CF_ACCOUNT_ID, CF_API_TOKEN
 *
 * Run:
 *   CF_ACCOUNT_ID=xxx CF_API_TOKEN=yyy pnpm tsx scripts/generate-collectible-art-cloudflare.ts
 *
 * Verify:
 *   pnpm tsx scripts/verify-collectible-images.ts   → target 62/62
 */
import { config } from 'dotenv';

const TARGET_PACK_SLUGS = [
  'sea-creatures-v1',
  'dinosaurs-v1',
  'solar-system-v1',
  'landmarks-v1',
];

const STYLE_PREAMBLE =
  'cartoon illustration for children, bright colors, simple, single subject, no text: ';

const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const CONCURRENCY = 3;

/** Per-slug subject overrides for solar bodies (recognizability matters most). */
const SOLAR_SUBJECT: Record<string, string> = {
  earth:
    'planet Earth, a blue and green planet with white clouds, viewed from outer space, centered, plain dark space background',
  mars: 'planet Mars, a red dusty planet, viewed in outer space, centered, plain dark space background',
  jupiter:
    'planet Jupiter, a large planet with orange and cream cloud bands and a great red spot, viewed in outer space, centered, plain dark space background',
  saturn:
    'planet Saturn, a pale gold planet with bright rings, viewed in outer space, centered, plain dark space background',
  mercury:
    'planet Mercury, a small grey cratered planet, viewed in outer space, centered, plain dark space background',
  venus:
    'planet Venus, a pale yellow cloudy planet, viewed in outer space, centered, plain dark space background',
  uranus:
    'planet Uranus, a pale blue-green planet, viewed in outer space, centered, plain dark space background',
  neptune:
    'planet Neptune, a deep blue planet, viewed in outer space, centered, plain dark space background',
  sun: 'the Sun, a bright glowing yellow-orange star, viewed in outer space, centered, plain dark space background',
  moon: 'the Moon, a grey cratered moon, viewed in outer space, centered, plain dark space background',
};

/**
 * Per-slug subject overrides for prompts that trip flux's (twitchy) NSFW
 * filter or otherwise need a steer. Keyed by slug.
 */
const SUBJECT_OVERRIDE: Record<string, string> = {
  seashell:
    'a pretty spiral conch seashell on the sand, centered, plain light background',
  oyster:
    'a closed oyster shell with a round white pearl beside it, centered, plain light background',
  dolphin:
    'a happy grey dolphin leaping above the ocean waves, full body, centered, plain light background',
};

interface Row {
  id: string;
  slug: string;
  nameEn: string;
  packSlug: string;
}

function buildPrompt(
  row: Row,
  landmarkLocation: (slug: string) => string | undefined,
): string {
  const { packSlug, slug, nameEn } = row;
  const override = SUBJECT_OVERRIDE[slug];
  if (override) return `${STYLE_PREAMBLE}${override}`;
  switch (packSlug) {
    case 'sea-creatures-v1':
      return `${STYLE_PREAMBLE}a ${nameEn}, a friendly sea creature, full body, centered, plain light background`;
    case 'dinosaurs-v1':
      return `${STYLE_PREAMBLE}a ${nameEn} dinosaur, full body, centered, plain light background`;
    case 'solar-system-v1':
      return `${STYLE_PREAMBLE}${SOLAR_SUBJECT[slug] ?? `${nameEn}, viewed in outer space, centered`}`;
    case 'landmarks-v1': {
      const loc = landmarkLocation(slug);
      return `${STYLE_PREAMBLE}the ${nameEn}, a famous landmark${loc ? ` in ${loc}` : ''}, centered, plain light background`;
    }
    default:
      return `${STYLE_PREAMBLE}${nameEn}`;
  }
}

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

  const { db } = await import('@/db');
  const { collectionPacks, collectibleItems } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { put } = await import('@vercel/blob');
  const { LANDMARKS_BY_SLUG } = await import(
    '@/lib/collections/landmarksData'
  );

  const packs = await db
    .select()
    .from(collectionPacks)
    .where(inArray(collectionPacks.slug, TARGET_PACK_SLUGS));
  const packSlugById = new Map(packs.map((p) => [p.id, p.slug]));

  const allItems = await db
    .select()
    .from(collectibleItems)
    .where(
      inArray(
        collectibleItems.packId,
        packs.map((p) => p.id),
      ),
    );

  const eligible: Row[] = allItems
    .filter((i) => !(i.imageUrl && /^https?:\/\//i.test(i.imageUrl)))
    .map((i) => ({
      id: i.id,
      slug: i.slug,
      nameEn: i.nameEn,
      packSlug: packSlugById.get(i.packId)!,
    }));

  console.log(`\n${eligible.length} cards to generate (of ${allItems.length}).\n`);

  const landmarkLocation = (slug: string) =>
    LANDMARKS_BY_SLUG[slug]?.locationEn;

  let done = 0;
  let failed = 0;
  const queue = [...eligible];

  async function worker(workerId: number) {
    while (queue.length > 0) {
      const row = queue.shift();
      if (!row) break;
      const prompt = buildPrompt(row, landmarkLocation);
      try {
        const bytes = await generateOne(prompt, acct!, token!);
        const blob = await put(`collectibles/${row.id}.jpg`, bytes, {
          access: 'public',
          contentType: 'image/jpeg',
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        await db
          .update(collectibleItems)
          .set({ imageUrl: blob.url })
          .where(eq(collectibleItems.id, row.id));
        done += 1;
        console.log(
          `  ✅ [${done + failed}/${eligible.length}] ${row.packSlug}/${row.slug} (${Math.round(bytes.length / 1024)}KB)`,
        );
      } catch (err) {
        failed += 1;
        console.error(
          `  ❌ [${done + failed}/${eligible.length}] ${row.packSlug}/${row.slug}: ${(err as Error).message}`,
        );
      }
    }
    void workerId;
  }

  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => worker(i)),
  );

  console.log(`\nDone. ${done} generated, ${failed} failed.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
