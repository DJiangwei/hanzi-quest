/**
 * Source of truth for the 世界地标 / World Landmarks collection pack.
 *
 * Pairs with the World Flags pack — landmarks are grouped by the SAME 6
 * continents (reusing `Continent` / `CONTINENT_LABELS` / `CONTINENT_ORDER` from
 * flagsData) so the geography lesson reinforces. Yinuo is English-native, so
 * every field is bilingual. Emoji glyphs are limited for landmarks (same
 * constraint as dinosaurs/solar), so cards differentiate primarily by name +
 * location + continent, not the emoji. Real illustrated images are a future
 * enhancement (like words.image_url).
 */

import type { Continent } from './flagsData';

export type LandmarkRarity = 'common' | 'rare' | 'epic';

export interface LandmarkItem {
  slug: string;
  emoji: string;
  continent: Continent;
  nameZh: string;
  nameEn: string;
  /** City · Country, e.g. 法国·巴黎 / Paris, France */
  locationZh: string;
  locationEn: string;
  loreZh: string;
  loreEn: string;
  rarity: LandmarkRarity;
  dropWeight: number;
}

export const LANDMARKS: LandmarkItem[] = [
  // ---------------------------------------------------------------- Asia
  { slug: 'great-wall', emoji: '🏯', continent: 'asia', nameZh: '长城', nameEn: 'Great Wall', locationZh: '中国·北京', locationEn: 'Beijing, China', loreZh: '蜿蜒过群山，超级长！', loreEn: 'It snakes over mountains — super long!', rarity: 'common', dropWeight: 3 },
  { slug: 'taj-mahal', emoji: '🕌', continent: 'asia', nameZh: '泰姬陵', nameEn: 'Taj Mahal', locationZh: '印度·阿格拉', locationEn: 'Agra, India', loreZh: '用白色大理石为爱建造。', loreEn: 'A white marble palace built for love.', rarity: 'common', dropWeight: 3 },
  { slug: 'mount-fuji', emoji: '🗻', continent: 'asia', nameZh: '富士山', nameEn: 'Mount Fuji', locationZh: '日本', locationEn: 'Japan', loreZh: '日本最高的雪山。', loreEn: "Japan's tallest snowy peak.", rarity: 'common', dropWeight: 3 },
  { slug: 'angkor-wat', emoji: '🛕', continent: 'asia', nameZh: '吴哥窟', nameEn: 'Angkor Wat', locationZh: '柬埔寨', locationEn: 'Cambodia', loreZh: '藏在丛林里的古老庙宇。', loreEn: 'An ancient temple in the jungle.', rarity: 'rare', dropWeight: 2 },
  { slug: 'burj-khalifa', emoji: '🏙️', continent: 'asia', nameZh: '哈利法塔', nameEn: 'Burj Khalifa', locationZh: '阿联酋·迪拜', locationEn: 'Dubai, UAE', loreZh: '世界最高的摩天大楼。', loreEn: 'The tallest building in the world.', rarity: 'rare', dropWeight: 2 },

  // -------------------------------------------------------------- Europe
  { slug: 'eiffel-tower', emoji: '🗼', continent: 'europe', nameZh: '埃菲尔铁塔', nameEn: 'Eiffel Tower', locationZh: '法国·巴黎', locationEn: 'Paris, France', loreZh: '用铁建造，夜晚会闪光。', loreEn: 'Made of iron — it sparkles at night.', rarity: 'common', dropWeight: 3 },
  { slug: 'colosseum', emoji: '🏛️', continent: 'europe', nameZh: '罗马斗兽场', nameEn: 'Colosseum', locationZh: '意大利·罗马', locationEn: 'Rome, Italy', loreZh: '古罗马人在这里看比赛。', loreEn: 'Ancient Romans watched games here.', rarity: 'common', dropWeight: 3 },
  { slug: 'big-ben', emoji: '🕰️', continent: 'europe', nameZh: '大本钟', nameEn: 'Big Ben', locationZh: '英国·伦敦', locationEn: 'London, UK', loreZh: '伦敦有名的大钟楼。', loreEn: "London's famous clock tower.", rarity: 'common', dropWeight: 3 },
  { slug: 'sagrada-familia', emoji: '⛪', continent: 'europe', nameZh: '圣家堂', nameEn: 'Sagrada Família', locationZh: '西班牙·巴塞罗那', locationEn: 'Barcelona, Spain', loreZh: '建了一百多年还没完工。', loreEn: 'Still being built after 100+ years!', rarity: 'rare', dropWeight: 2 },

  // -------------------------------------------------------------- Africa
  { slug: 'giza-pyramids', emoji: '🔺', continent: 'africa', nameZh: '吉萨金字塔', nameEn: 'Pyramids of Giza', locationZh: '埃及·开罗', locationEn: 'Cairo, Egypt', loreZh: '古埃及法老的巨大陵墓。', loreEn: 'Giant tombs of ancient pharaohs.', rarity: 'common', dropWeight: 3 },
  { slug: 'kilimanjaro', emoji: '⛰️', continent: 'africa', nameZh: '乞力马扎罗山', nameEn: 'Mount Kilimanjaro', locationZh: '坦桑尼亚', locationEn: 'Tanzania', loreZh: '非洲最高的山，山顶有雪。', loreEn: "Africa's tallest mountain — snow on top.", rarity: 'epic', dropWeight: 1 },

  // ------------------------------------------------------- North America
  { slug: 'statue-of-liberty', emoji: '🗽', continent: 'north_america', nameZh: '自由女神像', nameEn: 'Statue of Liberty', locationZh: '美国·纽约', locationEn: 'New York, USA', loreZh: '高举火炬欢迎大家。', loreEn: 'Holds a torch to welcome everyone.', rarity: 'common', dropWeight: 3 },
  { slug: 'golden-gate', emoji: '🌉', continent: 'north_america', nameZh: '金门大桥', nameEn: 'Golden Gate Bridge', locationZh: '美国·旧金山', locationEn: 'San Francisco, USA', loreZh: '橙红色的大桥常被雾笼罩。', loreEn: 'A red bridge often wrapped in fog.', rarity: 'rare', dropWeight: 2 },
  { slug: 'chichen-itza', emoji: '🛕', continent: 'north_america', nameZh: '奇琴伊察', nameEn: 'Chichén Itzá', locationZh: '墨西哥', locationEn: 'Mexico', loreZh: '玛雅人建造的金字塔神庙。', loreEn: 'A Maya pyramid temple.', rarity: 'epic', dropWeight: 1 },

  // ------------------------------------------------------- South America
  { slug: 'christ-redeemer', emoji: '🗿', continent: 'south_america', nameZh: '救世基督像', nameEn: 'Christ the Redeemer', locationZh: '巴西·里约', locationEn: 'Rio de Janeiro, Brazil', loreZh: '张开双臂俯瞰城市。', loreEn: 'Arms open wide over the city.', rarity: 'rare', dropWeight: 2 },
  { slug: 'machu-picchu', emoji: '🏔️', continent: 'south_america', nameZh: '马丘比丘', nameEn: 'Machu Picchu', locationZh: '秘鲁', locationEn: 'Peru', loreZh: '高山上的印加古城。', loreEn: 'An ancient Inca city high in the mountains.', rarity: 'epic', dropWeight: 1 },

  // ------------------------------------------------------------ Oceania
  { slug: 'sydney-opera', emoji: '🎭', continent: 'oceania', nameZh: '悉尼歌剧院', nameEn: 'Sydney Opera House', locationZh: '澳大利亚·悉尼', locationEn: 'Sydney, Australia', loreZh: '像白色风帆的剧院。', loreEn: 'A theater shaped like white sails.', rarity: 'rare', dropWeight: 2 },
];

export const LANDMARKS_BY_SLUG: Record<string, LandmarkItem> = Object.fromEntries(
  LANDMARKS.map((l) => [l.slug, l]),
);
