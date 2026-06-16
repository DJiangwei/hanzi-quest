/**
 * Source of truth for the 太阳系 / Solar System collection pack.
 *
 * Kids are English-native (UK heritage learner) — every field that the kid
 * sees is bilingual. Body type (rocky planet / gas giant / star / moon) is
 * rendered alongside the body name; lore is one short kid-friendly fact per
 * body. Emoji glyphs are stored in `collectible_items.image_url` at seed time;
 * the renderer uses them as plain text glyphs (no `<img>`).
 *
 * Visual differentiation note: only 🪐, ☀️ and 🌝 are true solar-system
 * emojis. The rest of the planets use coloured-disc emojis (🔴 / 🟠 / 🔵 /
 * 🟣 / 🟡 / ⚪) that roughly match the real-world colour of each body, so
 * cards stay distinguishable on the grid.
 */

export type SolarBodyRarity = 'common' | 'rare' | 'epic';

export type SolarBodyType = 'rocky' | 'gas' | 'ice' | 'star' | 'moon';

export const TYPE_LABELS: Record<SolarBodyType, { zh: string; en: string }> = {
  rocky: { zh: '岩石行星', en: 'Rocky planet' },
  gas: { zh: '气体巨星', en: 'Gas giant' },
  ice: { zh: '冰巨星', en: 'Ice giant' },
  star: { zh: '恒星', en: 'Star' },
  moon: { zh: '卫星', en: 'Moon' },
};

/** Display order for the grouped Solar System render (Backpack sections). */
export const SOLAR_TYPE_ORDER: SolarBodyType[] = [
  'star',
  'rocky',
  'gas',
  'ice',
  'moon',
];

/** Header emoji per body type (grouped-section headers). */
export const TYPE_EMOJI: Record<SolarBodyType, string> = {
  rocky: '🪨',
  gas: '🌀',
  ice: '❄️',
  star: '☀️',
  moon: '🌙',
};

export interface SolarBodyItem {
  slug: string;
  emoji: string;
  nameZh: string;
  nameEn: string;
  type: SolarBodyType;
  loreZh: string;
  loreEn: string;
  rarity: SolarBodyRarity;
  dropWeight: number;
}

export const SOLAR_BODIES: SolarBodyItem[] = [
  {
    slug: 'mercury',
    emoji: '⚪',
    nameZh: '水星',
    nameEn: 'Mercury',
    type: 'rocky',
    loreZh: '离太阳最近的小行星。',
    loreEn: 'The smallest planet, closest to the Sun.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'venus',
    emoji: '🟡',
    nameZh: '金星',
    nameEn: 'Venus',
    type: 'rocky',
    loreZh: '最亮的星，被云层包裹。',
    loreEn: 'The brightest planet, wrapped in clouds.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'earth',
    emoji: '🌍',
    nameZh: '地球',
    nameEn: 'Earth',
    type: 'rocky',
    loreZh: '我们的家，唯一有海洋的行星。',
    loreEn: 'Our home — the only planet with oceans.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'moon',
    emoji: '🌝',
    nameZh: '月球',
    nameEn: 'Moon',
    type: 'moon',
    loreZh: '地球的小伙伴，会变胖变瘦。',
    loreEn: "Earth's friend — waxes and wanes each month.",
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'mars',
    emoji: '🔴',
    nameZh: '火星',
    nameEn: 'Mars',
    type: 'rocky',
    loreZh: '红色的沙漠星球。',
    loreEn: 'The red, dusty planet next door.',
    rarity: 'common',
    dropWeight: 3,
  },
  {
    slug: 'jupiter',
    emoji: '🟠',
    nameZh: '木星',
    nameEn: 'Jupiter',
    type: 'gas',
    loreZh: '最大的行星，有一个大红斑。',
    loreEn: 'Biggest planet, with a giant red storm.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'saturn',
    emoji: '🪐',
    nameZh: '土星',
    nameEn: 'Saturn',
    type: 'gas',
    loreZh: '有美丽光环的行星。',
    loreEn: 'The planet with beautiful icy rings.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'uranus',
    emoji: '🔵',
    nameZh: '天王星',
    nameEn: 'Uranus',
    type: 'ice',
    loreZh: '蓝绿色的星球，侧着转。',
    loreEn: 'A blue-green planet spinning on its side.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'neptune',
    emoji: '🟣',
    nameZh: '海王星',
    nameEn: 'Neptune',
    type: 'ice',
    loreZh: '最远的行星，风超级大。',
    loreEn: 'The farthest planet, with super-fast winds.',
    rarity: 'rare',
    dropWeight: 2,
  },
  {
    slug: 'sun',
    emoji: '☀️',
    nameZh: '太阳',
    nameEn: 'Sun',
    type: 'star',
    loreZh: '一颗会发光的大火球，给地球温暖。',
    loreEn: 'A giant ball of fire that keeps us warm.',
    rarity: 'epic',
    dropWeight: 1,
  },
];

export const SOLAR_BODIES_BY_SLUG: Record<string, SolarBodyItem> =
  Object.fromEntries(SOLAR_BODIES.map((b) => [b.slug, b]));
