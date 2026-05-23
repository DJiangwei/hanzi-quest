/**
 * Seed 8 pets + their corresponding shop_items rows. Idempotent — re-running
 * is safe (skip-by-slug).
 *
 * Usage:
 *   pnpm tsx scripts/seed-pets.ts
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

interface PetSeed {
  slug: string;
  emoji: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  speechZh: string[];
  speechEn: string[];
  priceCoins: number;
  displayOrder: number;
}

const PETS: PetSeed[] = [
  {
    slug: 'pet-parrot',
    emoji: '🦜',
    nameZh: '鹦鹉',
    nameEn: 'Parrot',
    descriptionZh: '聪明的甲板伙伴，会模仿船长说话。',
    descriptionEn: 'A clever deckmate who mimics the captain.',
    speechZh: ['加油！', '你真棒！', '再来一关！', '海盗船长好！', '我喜欢你！', '继续冒险！'],
    speechEn: ['Keep going!', "You're amazing!", 'One more level!', 'Hello, captain!', 'I like you!', 'Onward!'],
    priceCoins: 300,
    displayOrder: 1,
  },
  {
    slug: 'pet-crab',
    emoji: '🦀',
    nameZh: '螃蟹',
    nameEn: 'Crab',
    descriptionZh: '在沙滩上横着走的小伙伴。',
    descriptionEn: 'A sideways little buddy from the beach.',
    speechZh: ['咔哒咔哒', '我在沙滩上', '小心我的钳子', '加油哦', '海水真凉', '我们是好朋友'],
    speechEn: ['Click click', "I'm on the beach", 'Watch the claws', 'Hang in there', "The water's cool", "We're friends"],
    priceCoins: 300,
    displayOrder: 2,
  },
  {
    slug: 'pet-ship-cat',
    emoji: '🐈',
    nameZh: '船猫',
    nameEn: 'Ship Cat',
    descriptionZh: '海盗船上的好运猫。',
    descriptionEn: 'The lucky cat of every pirate ship.',
    speechZh: ['喵', '想吃鱼', '今天好困', '让我打个盹', '你好', '捉只老鼠去'],
    speechEn: ['Meow', 'I want fish', 'So sleepy today', 'Time for a nap', 'Hi there', 'Off to catch mice'],
    priceCoins: 350,
    displayOrder: 3,
  },
  {
    slug: 'pet-monkey',
    emoji: '🐒',
    nameZh: '猴子',
    nameEn: 'Monkey',
    descriptionZh: '爬桅杆的小淘气。',
    descriptionEn: 'A mast-climbing little rascal.',
    speechZh: ['嘻嘻嘻', '给我一根香蕉', '我会爬桅杆', '跳起来', '好玩好玩', '我们一起玩'],
    speechEn: ['Hee hee', 'Banana please', 'I climb the mast', "Let's jump", 'Fun fun fun', 'Play with me'],
    priceCoins: 500,
    displayOrder: 4,
  },
  {
    slug: 'pet-sea-turtle',
    emoji: '🐢',
    nameZh: '海龟',
    nameEn: 'Sea Turtle',
    descriptionZh: '慢慢悠悠的百岁老人。',
    descriptionEn: 'A century-old gentle traveler.',
    speechZh: ['慢慢来', '我活了 100 岁', '游到深海', '海洋很大', '你做得很好', '保护海龟'],
    speechEn: ['Take it slow', "I'm 100 years old", 'Off to the deep sea', 'The ocean is vast', "You're doing great", 'Protect the turtles'],
    priceCoins: 500,
    displayOrder: 5,
  },
  {
    slug: 'pet-dolphin',
    emoji: '🐬',
    nameZh: '海豚',
    nameEn: 'Dolphin',
    descriptionZh: '聪明的海上歌手。',
    descriptionEn: 'A clever ocean singer.',
    speechZh: ['咯咯咯', '跳起来！', '我会唱歌', '跟我游', '海里好玩', '你笑了'],
    speechEn: ['Click click click', 'Jumping!', 'I can sing', 'Swim with me', 'The sea is fun', "You're smiling"],
    priceCoins: 600,
    displayOrder: 6,
  },
  {
    slug: 'pet-bat',
    emoji: '🦇',
    nameZh: '蝙蝠',
    nameEn: 'Bat',
    descriptionZh: '夜里的安静朋友。',
    descriptionEn: 'A quiet friend of the night.',
    speechZh: ['晚上好', '我用耳朵看', '飞起来', '月亮真亮', '寻找虫子', '静悄悄'],
    speechEn: ['Good evening', 'I see with my ears', 'Up I go', 'The moon is bright', 'Hunting bugs', 'Quietly'],
    priceCoins: 900,
    displayOrder: 7,
  },
  {
    slug: 'pet-glow-jelly',
    emoji: '🪼',
    nameZh: '发光水母',
    nameEn: 'Glow Jellyfish',
    descriptionZh: '深海里闪闪发光的伙伴。',
    descriptionEn: 'A shimmering friend from the deep.',
    speechZh: ['闪闪发光', '我会发光', '飘啊飘', '深海里好凉', '星星一样', '安静的伙伴'],
    speechEn: ['Shimmer shimmer', 'I glow', 'Drift drift', 'Cool in the deep', 'Like a star', 'Quiet friend'],
    priceCoins: 1200,
    displayOrder: 8,
  },
];

async function main() {
  const { db } = await import('../src/db');
  const { pets, shopItems } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  let petsInserted = 0;
  let shopInserted = 0;

  for (const p of PETS) {
    // 1) pets row
    const existingPet = await db.select({ id: pets.id }).from(pets).where(eq(pets.slug, p.slug)).limit(1);
    if (existingPet.length === 0) {
      await db.insert(pets).values({
        slug: p.slug,
        nameZh: p.nameZh,
        nameEn: p.nameEn,
        emoji: p.emoji,
        descriptionZh: p.descriptionZh,
        descriptionEn: p.descriptionEn,
        speechZh: p.speechZh,
        speechEn: p.speechEn,
        displayOrder: p.displayOrder,
      });
      petsInserted++;
    }

    // 2) matching shop_items row (slug must match for ownership join)
    const existingShop = await db.select({ id: shopItems.id }).from(shopItems).where(eq(shopItems.slug, p.slug)).limit(1);
    if (existingShop.length === 0) {
      await db.insert(shopItems).values({
        slug: p.slug,
        kind: 'pet',
        name: `${p.nameZh} / ${p.nameEn}`,
        description: `${p.descriptionZh}\n${p.descriptionEn}`,
        imageUrl: p.emoji,
        priceCoins: p.priceCoins,
        isActive: true,
      });
      shopInserted++;
    }

    if (existingPet.length === 0 || existingShop.length === 0) {
      console.log(`  + ${p.slug} (${p.priceCoins} coins)`);
    }
  }

  console.log(`Done. Pets +${petsInserted}, shop_items +${shopInserted} (skipped ${PETS.length - petsInserted} pets, ${PETS.length - shopInserted} shop_items).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
