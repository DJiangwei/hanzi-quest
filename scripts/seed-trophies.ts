/**
 * Seed the 20 trophies. Idempotent — re-running is safe.
 *
 * Usage:
 *   pnpm tsx scripts/seed-trophies.ts
 *
 * CAUTION: shared DATABASE_URL on Neon free tier — will hit prod if .env.local
 * points there. Confirm before running.
 */

import { pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

type Category = 'mastery' | 'streak' | 'collection' | 'coins' | 'practice' | 'story' | 'season' | 'champion';
interface TrophySeed {
  slug: string;
  emoji: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  loreZh: string;
  loreEn: string;
  category: Category;
  displayOrder: number;
}

export const TROPHIES: TrophySeed[] = [
  { slug: 'first-boss', emoji: '🐙', nameZh: '首战告捷', nameEn: 'First Voyage', descriptionZh: '第一次打败海怪', descriptionEn: 'Defeat your first kraken boss', loreZh: '勇敢的小海盗第一次扬起了胜利的旗帜！', loreEn: 'Your first victorious flag flies high!', category: 'mastery', displayOrder: 1 },
  { slug: 'perfect-week', emoji: '⭐', nameZh: '完美一周', nameEn: 'Perfect Week', descriptionZh: '把一周里每个场景都做到 100 分', descriptionEn: 'Get 100% on every level of a week', loreZh: '所有的星星都亮了起来。', loreEn: 'Every star is lit up.', category: 'mastery', displayOrder: 2 },
  { slug: '100-levels', emoji: '💯', nameZh: '百关达人', nameEn: 'Centurion', descriptionZh: '通关 100 个场景', descriptionEn: 'Complete 100 levels', loreZh: '一百次扬帆，一百次靠岸。', loreEn: 'A hundred sails, a hundred shores.', category: 'mastery', displayOrder: 3 },
  { slug: '500-levels', emoji: '🏆', nameZh: '五百勇士', nameEn: 'Veteran', descriptionZh: '通关 500 个场景', descriptionEn: 'Complete 500 levels', loreZh: '老海狼的徽章，刻满了故事。', loreEn: 'A sea wolf\'s badge, full of stories.', category: 'mastery', displayOrder: 4 },
  { slug: 'boss-trio', emoji: '👑', nameZh: '海怪三连击', nameEn: 'Kraken Trio', descriptionZh: '在 3 个不同的周里打败海怪', descriptionEn: 'Defeat the boss in 3 different weeks', loreZh: '三次海战，三次凯旋。', loreEn: 'Three battles, three triumphs.', category: 'mastery', displayOrder: 5 },

  { slug: 'streak-7', emoji: '🔥', nameZh: '一周打卡', nameEn: 'Week Streak', descriptionZh: '连续 7 天玩耍', descriptionEn: '7-day login streak', loreZh: '坚持就是力量。', loreEn: 'Persistence is power.', category: 'streak', displayOrder: 10 },
  { slug: 'streak-14', emoji: '🔥', nameZh: '双周不停', nameEn: 'Fortnight Streak', descriptionZh: '连续 14 天玩耍', descriptionEn: '14-day login streak', loreZh: '两个礼拜的火焰。', loreEn: 'Two weeks of flame.', category: 'streak', displayOrder: 11 },
  { slug: 'streak-30', emoji: '🔥', nameZh: '月度铁人', nameEn: 'Month Streak', descriptionZh: '连续 30 天玩耍', descriptionEn: '30-day login streak', loreZh: '一个月的坚持，无可阻挡。', loreEn: 'A month of focus, unstoppable.', category: 'streak', displayOrder: 12 },

  { slug: 'collect-zodiac', emoji: '🐉', nameZh: '十二生肖', nameEn: 'Full Zodiac', descriptionZh: '集齐 12 个生肖', descriptionEn: 'Collect all 12 zodiac', loreZh: '十二只神兽都跟你做朋友啦。', loreEn: 'All twelve creatures are your friends now.', category: 'collection', displayOrder: 20 },
  { slug: 'collect-flags', emoji: '🚩', nameZh: '世界小队长', nameEn: 'Flag Champion', descriptionZh: '集齐 30 面国旗', descriptionEn: 'Collect all 30 flags', loreZh: '世界这么大，你都收集过了。', loreEn: 'The world is wide — you\'ve seen it all.', category: 'collection', displayOrder: 21 },
  { slug: 'collect-sea', emoji: '🐳', nameZh: '海洋探险家', nameEn: 'Sea Explorer', descriptionZh: '集齐 20 种海洋生物', descriptionEn: 'Collect all 20 sea creatures', loreZh: '海里的朋友都被你找到了。', loreEn: 'Every friend in the sea found.', category: 'collection', displayOrder: 22 },
  { slug: 'collect-dinos', emoji: '🦖', nameZh: '恐龙发掘者', nameEn: 'Dino Digger', descriptionZh: '集齐 15 种恐龙', descriptionEn: 'Collect all 15 dinosaurs', loreZh: '远古的伙伴们对你点头。', loreEn: 'Ancient companions nod to you.', category: 'collection', displayOrder: 23 },
  { slug: 'collect-solar', emoji: '🪐', nameZh: '太阳系导航员', nameEn: 'Solar Navigator', descriptionZh: '集齐太阳系 10 颗星体', descriptionEn: 'Collect all 10 solar bodies', loreZh: '从水星到海王星，你都走过。', loreEn: 'From Mercury to Neptune, you sailed.', category: 'collection', displayOrder: 24 },
  { slug: 'decor-starter', emoji: '🏝️', nameZh: '装饰新手', nameEn: 'Decor Starter', descriptionZh: '购买了你的第一个航海图装饰', descriptionEn: 'Bought your first island decoration', loreZh: '航海图开始有了你的印记。', loreEn: 'Your map starts to feel like yours.', category: 'collection', displayOrder: 25 },
  { slug: 'decor-completionist', emoji: '🏰', nameZh: '装饰大师', nameEn: 'Decor Master', descriptionZh: '收集了所有 10 个航海图装饰', descriptionEn: 'Owned all 10 island decorations', loreZh: '一张完整的航海图，处处是宝藏。', loreEn: 'A complete map, treasure in every corner.', category: 'collection', displayOrder: 26 },

  { slug: 'continent-asia', emoji: '🌏', nameZh: '亚洲集齐', nameEn: 'Asia Complete', descriptionZh: '集齐亚洲所有国旗', descriptionEn: 'Collect every flag in Asia', loreZh: '从东海到丝路，亚洲都装进了背包。', loreEn: 'From the eastern seas to the Silk Road — all of Asia.', category: 'collection', displayOrder: 27 },
  { slug: 'continent-europe', emoji: '🌍', nameZh: '欧洲集齐', nameEn: 'Europe Complete', descriptionZh: '集齐欧洲所有国旗', descriptionEn: 'Collect every flag in Europe', loreZh: '城堡与海港，欧洲尽收眼底。', loreEn: 'Castles and harbours — all of Europe.', category: 'collection', displayOrder: 28 },
  { slug: 'continent-africa', emoji: '🌍', nameZh: '非洲集齐', nameEn: 'Africa Complete', descriptionZh: '集齐非洲所有国旗', descriptionEn: 'Collect every flag in Africa', loreZh: '草原与大河，非洲全部收集。', loreEn: 'Savannahs and great rivers — all of Africa.', category: 'collection', displayOrder: 29 },
  { slug: 'continent-north-america', emoji: '🌎', nameZh: '北美洲集齐', nameEn: 'North America Complete', descriptionZh: '集齐北美洲所有国旗', descriptionEn: 'Collect every flag in North America', loreZh: '从冰原到加勒比，北美洲都走遍。', loreEn: 'From icefields to the Caribbean — all of North America.', category: 'collection', displayOrder: 30 },
  { slug: 'continent-south-america', emoji: '🌎', nameZh: '南美洲集齐', nameEn: 'South America Complete', descriptionZh: '集齐南美洲所有国旗', descriptionEn: 'Collect every flag in South America', loreZh: '雨林与高山，南美洲全部到手。', loreEn: 'Rainforest and high peaks — all of South America.', category: 'collection', displayOrder: 31 },
  { slug: 'continent-oceania', emoji: '🌏', nameZh: '大洋洲集齐', nameEn: 'Oceania Complete', descriptionZh: '集齐大洋洲所有国旗', descriptionEn: 'Collect every flag in Oceania', loreZh: '蓝色大洋上的每座岛屿。', loreEn: 'Every island on the blue ocean.', category: 'collection', displayOrder: 32 },

  { slug: 'coins-100', emoji: '🪙', nameZh: '第一桶金', nameEn: 'First Coins', descriptionZh: '累计获得 100 个金币', descriptionEn: 'Earn first 100 coins lifetime', loreZh: '第一桶金币，闪闪发光。', loreEn: 'Your first coins, gleaming.', category: 'coins', displayOrder: 30 },
  { slug: 'coins-1k', emoji: '💰', nameZh: '千金达人', nameEn: 'Thousand Club', descriptionZh: '累计获得 1000 个金币', descriptionEn: 'Earn 1,000 coins lifetime', loreZh: '一千个金币的宝箱。', loreEn: 'A treasure chest of one thousand.', category: 'coins', displayOrder: 31 },
  { slug: 'coins-5k', emoji: '💎', nameZh: '五千海盗', nameEn: 'Five-K Pirate', descriptionZh: '累计获得 5000 个金币', descriptionEn: 'Earn 5,000 coins lifetime', loreZh: '富可敌国的小海盗。', loreEn: 'A wealthy little pirate.', category: 'coins', displayOrder: 32 },

  { slug: 'first-pinyin-pick', emoji: '🅰️', nameZh: '拼音小能手', nameEn: 'Pinyin Apprentice', descriptionZh: '第一次拼音选字 100 分', descriptionEn: 'First pinyin_pick scored ≥100', loreZh: '声韵调，样样精通。', loreEn: 'Initial, final, tone — all mastered.', category: 'practice', displayOrder: 40 },
  { slug: 'first-translate-pick', emoji: '🌐', nameZh: '双语小达人', nameEn: 'Bilingual Spark', descriptionZh: '第一次中英翻译 100 分', descriptionEn: 'First translate_pick scored ≥100', loreZh: '两种语言都能玩。', loreEn: 'Two languages, one mind.', category: 'practice', displayOrder: 41 },
  { slug: 'first-sentence-cloze', emoji: '📝', nameZh: '填字大师', nameEn: 'Cloze Master', descriptionZh: '第一次句子填字 100 分', descriptionEn: 'First sentence_cloze scored ≥100', loreZh: '句子里少了一个字，被你找到了。', loreEn: 'A sentence missed a word — you found it.', category: 'practice', displayOrder: 42 },
  { slug: 'equip-sound-theme', emoji: '🎵', nameZh: '音效收藏家', nameEn: 'Sound Collector', descriptionZh: '装备第一个非默认音效主题', descriptionEn: 'Equip your first non-default sound theme', loreZh: '不一样的音乐，不一样的航行。', loreEn: 'A new sound, a new voyage.', category: 'practice', displayOrder: 43 },

  { slug: 'first-chapter', emoji: '📖', nameZh: '第一章', nameEn: 'First Chapter', descriptionZh: '解锁你的第一章故事', descriptionEn: 'Unlock your first story chapter', loreZh: '海盗日记的第一页翻开了。', loreEn: "Page one of your pirate's log is open.", category: 'story', displayOrder: 100 },

  { slug: 'season-summer-master', emoji: '⛵', nameZh: '夏季航海大师', nameEn: 'Summer Voyage Master', descriptionZh: '完成夏季航海赛季的全部 30 个档位', descriptionEn: 'Reach tier 30 of the Summer Voyage season', loreZh: '整片夏日海洋都记得你的名字。', loreEn: 'The whole summer sea remembers your name.', category: 'season', displayOrder: 60 },

  { slug: 'champion-caribbean', emoji: '👑', nameZh: '加勒比海霸主', nameEn: 'Lord of the Caribbean', descriptionZh: '击败加勒比海的最终霸主', descriptionEn: 'Defeat the Caribbean final boss', loreZh: '幽灵旗舰沉入海底，王冠属于你。', loreEn: 'The Ghost Galleon sinks — the crown is yours.', category: 'champion', displayOrder: 90 },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(2);
  }
  const { db } = await import('../src/db');
  const { trophies } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  let inserted = 0;
  for (const t of TROPHIES) {
    const existing = await db
      .select({ id: trophies.id })
      .from(trophies)
      .where(eq(trophies.slug, t.slug))
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(trophies).values(t);
    inserted++;
    console.log(`  + ${t.slug} (${t.category})`);
  }
  console.log(`Done. Inserted ${inserted} new trophies (skipped ${TROPHIES.length - inserted}).`);
}

// Only auto-run when executed directly (so tests can import { TROPHIES }).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
