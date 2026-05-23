/**
 * Seed 10 decorations + matching shop_items rows.
 * Idempotent — re-running is safe (skip-by-slug).
 *
 * Usage:
 *   pnpm tsx scripts/seed-decorations.ts
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if
 * .env.local points there. Confirm before running.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(2);
}

interface DecorSeed {
  slug: string;
  emoji: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  anchorSlug: string;
  priceCoins: number;
  displayOrder: number;
}

const DECORATIONS: DecorSeed[] = [
  {
    slug: 'sailboat',
    emoji: '⛵',
    nameZh: '小帆船',
    nameEn: 'Sailboat',
    descriptionZh: '红帆小船，停泊在航海的起点。',
    descriptionEn: 'A red-sailed sloop bobbing near the start of your voyage.',
    anchorSlug: 'top-right',
    priceCoins: 200,
    displayOrder: 1,
  },
  {
    slug: 'seagull-pair',
    emoji: '🐦',
    nameZh: '海鸥',
    nameEn: 'Seagull Pair',
    descriptionZh: '两只海鸥在浪花上盘旋。',
    descriptionEn: 'Two seagulls wheeling above the waves.',
    anchorSlug: 'top-left',
    priceCoins: 200,
    displayOrder: 2,
  },
  {
    slug: 'hibiscus',
    emoji: '🌺',
    nameZh: '木槿花',
    nameEn: 'Hibiscus',
    descriptionZh: '热带木槿花，生长在岛屿上。',
    descriptionEn: 'A tropical hibiscus growing wild on the islands.',
    anchorSlug: 'left-margin-mid',
    priceCoins: 250,
    displayOrder: 3,
  },
  {
    slug: 'fish-school',
    emoji: '🐟',
    nameZh: '小鱼群',
    nameEn: 'Fish School',
    descriptionZh: '一群银色小鱼在水下游动。',
    descriptionEn: 'A school of silver fish darting underwater.',
    anchorSlug: 'between-2-3',
    priceCoins: 250,
    displayOrder: 4,
  },
  {
    slug: 'compass-rose',
    emoji: '🧭',
    nameZh: '罗盘',
    nameEn: 'Compass Rose',
    descriptionZh: '古老的罗盘，指引归航的方向。',
    descriptionEn: "An old-timer's compass rose, points the way home.",
    anchorSlug: 'bottom-center',
    priceCoins: 400,
    displayOrder: 5,
  },
  {
    slug: 'rainbow',
    emoji: '🌈',
    nameZh: '彩虹',
    nameEn: 'Rainbow',
    descriptionZh: '海上风暴后的彩虹。',
    descriptionEn: 'A rainbow after a Pacific squall.',
    anchorSlug: 'between-4-5',
    priceCoins: 500,
    displayOrder: 6,
  },
  {
    slug: 'pirate-flag',
    emoji: '🏴‍☠️',
    nameZh: '海盗旗',
    nameEn: 'Pirate Flag',
    descriptionZh: '海盗旗在风中猎猎作响。',
    descriptionEn: 'Jolly Roger snapping in the breeze.',
    anchorSlug: 'left-margin-low',
    priceCoins: 500,
    displayOrder: 7,
  },
  {
    slug: 'whale-tail',
    emoji: '🐋',
    nameZh: '鲸鱼尾',
    nameEn: 'Whale Tail',
    descriptionZh: '座头鲸跃出水面的尾巴。',
    descriptionEn: "A humpback whale's tail breaking the surface.",
    anchorSlug: 'right-margin-mid',
    priceCoins: 700,
    displayOrder: 8,
  },
  {
    slug: 'lighthouse',
    emoji: '🗼',
    nameZh: '灯塔',
    nameEn: 'Lighthouse',
    descriptionZh: '红白相间的灯塔守望着海面。',
    descriptionEn: 'A red-and-white lighthouse keeping watch.',
    anchorSlug: 'between-6-7',
    priceCoins: 900,
    displayOrder: 9,
  },
  {
    slug: 'treasure-chest',
    emoji: '🧰',
    nameZh: '宝箱',
    nameEn: 'Treasure Chest',
    descriptionZh: '饱经风霜的宝箱，盖子微启。',
    descriptionEn: 'A weathered chest, lid slightly ajar.',
    anchorSlug: 'between-8-9',
    priceCoins: 1200,
    displayOrder: 10,
  },
];

async function main() {
  const { db } = await import('../src/db');
  const { decorations, shopItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  let decorInserted = 0;
  let shopInserted = 0;

  for (const d of DECORATIONS) {
    const existingDecor = await db
      .select({ id: decorations.id })
      .from(decorations)
      .where(eq(decorations.slug, d.slug))
      .limit(1);
    if (existingDecor.length === 0) {
      await db.insert(decorations).values({
        slug: d.slug,
        nameZh: d.nameZh,
        nameEn: d.nameEn,
        emoji: d.emoji,
        descriptionZh: d.descriptionZh,
        descriptionEn: d.descriptionEn,
        anchorSlug: d.anchorSlug,
        displayOrder: d.displayOrder,
      });
      decorInserted++;
    }

    const existingShop = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(eq(shopItems.slug, d.slug))
      .limit(1);
    if (existingShop.length === 0) {
      await db.insert(shopItems).values({
        slug: d.slug,
        kind: 'decor',
        name: `${d.nameZh} / ${d.nameEn}`,
        description: `${d.descriptionZh}\n${d.descriptionEn}`,
        imageUrl: d.emoji,
        priceCoins: d.priceCoins,
        isActive: true,
      });
      shopInserted++;
    }

    if (existingDecor.length === 0 || existingShop.length === 0) {
      console.log(`  + ${d.slug} (${d.priceCoins} coins)`);
    }
  }

  console.log(
    `Done. Decorations +${decorInserted}, shop_items +${shopInserted} ` +
      `(skipped ${DECORATIONS.length - decorInserted} decorations, ${DECORATIONS.length - shopInserted} shop_items).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
