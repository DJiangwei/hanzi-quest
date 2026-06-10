/**
 * 节日 / Festivals collectible pack (`festivals-v1`) — reward-only. Cards are
 * earned ONLY via the monthly festival challenge (never gacha; the pack is
 * `gacha_eligible = false`). Emoji glyphs (no generated art), like the
 * dinosaurs / landmarks packs. Bilingual per the locked collectibles rule.
 */
export interface FestivalItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
}

export const FESTIVAL_ITEMS: FestivalItem[] = [
  {
    slug: 'newyear',
    nameZh: '元旦',
    nameEn: "New Year's Day",
    emoji: '🎆',
    loreZh: '新的一年开始啦，大家互相祝福。',
    loreEn: 'The first day of the new year — everyone shares good wishes.',
  },
  {
    slug: 'spring-festival',
    nameZh: '春节',
    nameEn: 'Spring Festival',
    emoji: '🧧',
    loreZh: '中国最热闹的节日，贴春联、放鞭炮、收红包。',
    loreEn: "China's biggest festival — couplets, firecrackers, and red packets.",
  },
  {
    slug: 'lantern',
    nameZh: '元宵节',
    nameEn: 'Lantern Festival',
    emoji: '🏮',
    loreZh: '正月十五赏花灯、吃汤圆、猜灯谜。',
    loreEn: 'Admire lanterns, eat tangyuan, and guess riddles.',
  },
  {
    slug: 'qingming',
    nameZh: '清明节',
    nameEn: 'Qingming Festival',
    emoji: '🌿',
    loreZh: '人们扫墓踏青，柳枝青青。',
    loreEn: 'Families tend graves and enjoy the green spring outdoors.',
  },
  {
    slug: 'start-summer',
    nameZh: '立夏',
    nameEn: 'Start of Summer',
    emoji: '🍃',
    loreZh: '夏天来了，万物生长。',
    loreEn: 'Summer begins and everything grows.',
  },
  {
    slug: 'dragon-boat',
    nameZh: '端午节',
    nameEn: 'Dragon Boat Festival',
    emoji: '🐲',
    loreZh: '赛龙舟、吃粽子，纪念诗人屈原。',
    loreEn: 'Dragon-boat races and zongzi, honoring the poet Qu Yuan.',
  },
  {
    slug: 'summer-solstice',
    nameZh: '夏至',
    nameEn: 'Summer Solstice',
    emoji: '☀️',
    loreZh: '一年中白天最长的一天。',
    loreEn: 'The longest day of the year.',
  },
  {
    slug: 'qixi',
    nameZh: '七夕',
    nameEn: 'Qixi Festival',
    emoji: '🐦',
    loreZh: '牛郎织女鹊桥相会的浪漫节日。',
    loreEn: 'The romantic tale of the Cowherd and the Weaver Girl.',
  },
  {
    slug: 'mid-autumn',
    nameZh: '中秋节',
    nameEn: 'Mid-Autumn Festival',
    emoji: '🌕',
    loreZh: '一家人赏圆月、吃月饼。',
    loreEn: 'Families gather to admire the full moon and eat mooncakes.',
  },
  {
    slug: 'double-ninth',
    nameZh: '重阳节',
    nameEn: 'Double Ninth Festival',
    emoji: '🌼',
    loreZh: '登高望远、敬爱老人。',
    loreEn: 'Climb to high places and honor the elderly.',
  },
  {
    slug: 'start-winter',
    nameZh: '立冬',
    nameEn: 'Start of Winter',
    emoji: '⛄',
    loreZh: '冬天开始，天气变冷。',
    loreEn: 'Winter begins and the weather turns cold.',
  },
  {
    slug: 'winter-solstice',
    nameZh: '冬至',
    nameEn: 'Winter Solstice',
    emoji: '🥟',
    loreZh: '北方吃饺子，南方吃汤圆，一家团圆。',
    loreEn: 'Dumplings in the north, tangyuan in the south — a family reunion.',
  },
];

export const FESTIVALS_BY_SLUG: Record<string, FestivalItem> =
  Object.fromEntries(FESTIVAL_ITEMS.map((f) => [f.slug, f]));
