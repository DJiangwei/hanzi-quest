/**
 * Source of truth for the 海洋生物 / Sea Creatures collection pack.
 *
 * Yinuo is English-native (UK heritage learner) — every field that the kid
 * sees is bilingual. Habitat is rendered alongside the creature name; lore is
 * one short kid-friendly fact per creature. Emoji glyphs are stored in
 * `collectible_items.image_url` at seed time; the renderer uses them as plain
 * text glyphs (no `<img>`).
 *
 * Pirate-adventure theme: this pack lines up with the game's island/ocean
 * setting and the existing boss kraken — sea creatures are who Yinuo meets on
 * her voyages.
 */

export type SeaCreatureRarity = 'common' | 'rare' | 'epic';

export interface SeaCreatureItem {
  slug: string;
  emoji: string;
  nameZh: string;
  nameEn: string;
  habitatZh: string;
  habitatEn: string;
  loreZh: string;
  loreEn: string;
  rarity: SeaCreatureRarity;
  dropWeight: number;
}

export const SEA_CREATURES: SeaCreatureItem[] = [
  {
    slug: 'fish',
    emoji: '🐟',
    nameZh: '鱼',
    nameEn: 'Fish',
    habitatZh: '海洋',
    habitatEn: 'The ocean',
    loreZh: '海里最常见的小伙伴。',
    loreEn: 'The most common little friend in the sea.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'tropical-fish',
    emoji: '🐠',
    nameZh: '热带鱼',
    nameEn: 'Tropical Fish',
    habitatZh: '珊瑚礁',
    habitatEn: 'Coral reefs',
    loreZh: '身上有彩色的条纹。',
    loreEn: 'Wears bright stripes for camouflage.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'crab',
    emoji: '🦀',
    nameZh: '螃蟹',
    nameEn: 'Crab',
    habitatZh: '沙滩',
    habitatEn: 'Sandy beaches',
    loreZh: '横着走路的小钳子手。',
    loreEn: 'Walks sideways with two pinchy claws.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'shrimp',
    emoji: '🦐',
    nameZh: '虾',
    nameEn: 'Shrimp',
    habitatZh: '海底',
    habitatEn: 'The seafloor',
    loreZh: '游得飞快的小尾巴。',
    loreEn: 'Flicks its tail to zip away.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'squid',
    emoji: '🦑',
    nameZh: '鱿鱼',
    nameEn: 'Squid',
    habitatZh: '深海',
    habitatEn: 'The deep sea',
    loreZh: '有十只手臂，会喷墨水。',
    loreEn: 'Has ten arms and squirts ink!',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'octopus',
    emoji: '🐙',
    nameZh: '章鱼',
    nameEn: 'Octopus',
    habitatZh: '礁石缝',
    habitatEn: 'Rocky reefs',
    loreZh: '八只腕足，超级聪明。',
    loreEn: 'Eight arms and very clever.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'pufferfish',
    emoji: '🐡',
    nameZh: '河豚',
    nameEn: 'Pufferfish',
    habitatZh: '温暖海域',
    habitatEn: 'Warm seas',
    loreZh: '害怕时会鼓成一个球。',
    loreEn: 'Puffs into a spiky ball when scared.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'jellyfish',
    emoji: '🪼',
    nameZh: '水母',
    nameEn: 'Jellyfish',
    habitatZh: '海面',
    habitatEn: 'Open waters',
    loreZh: '像漂浮的果冻伞。',
    loreEn: 'Drifts like a jelly umbrella.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'seashell',
    emoji: '🐚',
    nameZh: '贝壳',
    nameEn: 'Seashell',
    habitatZh: '海岸',
    habitatEn: 'The shoreline',
    loreZh: '把它贴近耳朵能听见海声。',
    loreEn: 'Hold one to your ear to hear the sea.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'coral',
    emoji: '🪸',
    nameZh: '珊瑚',
    nameEn: 'Coral',
    habitatZh: '热带海底',
    habitatEn: 'Tropical seafloor',
    loreZh: '看起来像石头的小动物。',
    loreEn: 'Tiny animals that build stone castles.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'dolphin',
    emoji: '🐬',
    nameZh: '海豚',
    nameEn: 'Dolphin',
    habitatZh: '温暖海洋',
    habitatEn: 'Warm oceans',
    loreZh: '爱跳跃，喜欢和小朋友玩。',
    loreEn: 'Loves to leap and play with kids!',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'sea-turtle',
    emoji: '🐢',
    nameZh: '海龟',
    nameEn: 'Sea Turtle',
    habitatZh: '热带海洋',
    habitatEn: 'Tropical seas',
    loreZh: '可以活一百多岁。',
    loreEn: 'Can live for over a hundred years.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'seal',
    emoji: '🦭',
    nameZh: '海豹',
    nameEn: 'Seal',
    habitatZh: '寒冷海岸',
    habitatEn: 'Cold coasts',
    loreZh: '圆圆的身体，大大的眼睛。',
    loreEn: 'Round body, huge curious eyes.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'sea-otter',
    emoji: '🦦',
    nameZh: '海獭',
    nameEn: 'Sea Otter',
    habitatZh: '海带林',
    habitatEn: 'Kelp forests',
    loreZh: '睡觉时手牵手不会漂走。',
    loreEn: 'Holds hands when sleeping so it does not drift away.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'lobster',
    emoji: '🦞',
    nameZh: '龙虾',
    nameEn: 'Lobster',
    habitatZh: '岩石海底',
    habitatEn: 'Rocky seabeds',
    loreZh: '两只大钳子很有力。',
    loreEn: 'Two huge claws — careful!',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'oyster',
    emoji: '🦪',
    nameZh: '牡蛎',
    nameEn: 'Oyster',
    habitatZh: '海床',
    habitatEn: 'Shallow seabeds',
    loreZh: '有时候里面藏着珍珠。',
    loreEn: 'Sometimes hides a shiny pearl inside.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'shark',
    emoji: '🦈',
    nameZh: '鲨鱼',
    nameEn: 'Shark',
    habitatZh: '大海',
    habitatEn: 'The open ocean',
    loreZh: '鼻子很灵，几公里外都闻得到。',
    loreEn: 'Can smell food from miles away.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'whale',
    emoji: '🐳',
    nameZh: '鲸鱼',
    nameEn: 'Whale',
    habitatZh: '深海',
    habitatEn: 'The deep ocean',
    loreZh: '会从头顶喷水柱。',
    loreEn: 'Shoots a spout of water from the top of its head.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'blue-whale',
    emoji: '🐋',
    nameZh: '蓝鲸',
    nameEn: 'Blue Whale',
    habitatZh: '深海',
    habitatEn: 'The deep ocean',
    loreZh: '地球上最大的动物。',
    loreEn: 'The largest animal on planet Earth!',
    rarity: 'epic',
    dropWeight: 1,
  },
  {
    slug: 'sea-dragon',
    emoji: '🐉',
    nameZh: '海龙',
    nameEn: 'Sea Dragon',
    habitatZh: '东海传说',
    habitatEn: 'Legends of the Eastern Sea',
    loreZh: '中国神话里掌管海洋的龙王。',
    loreEn: 'The dragon king who rules the seas in Chinese myth.',
    rarity: 'epic',
    dropWeight: 1,
  },
];

export const SEA_CREATURES_BY_SLUG: Record<string, SeaCreatureItem> =
  Object.fromEntries(SEA_CREATURES.map((c) => [c.slug, c]));
