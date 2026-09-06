/**
 * Season cards — reward-only, earned ONLY via the Season Pass reward track
 * (never gacha; the pack is `gacha_eligible = false`). Emoji glyph fallback;
 * `CardArt` swaps to real flux art once `collectible_items.image_url` is
 * populated. Bilingual per the locked collectibles rule.
 *
 * **Every season's cards live in ONE pack.** The DB slug is still
 * `season-summer-v1` — it is a POSITION, not a theme, exactly like
 * `pirate-class-level-2` meaning "the second map" rather than "the Indian
 * Ocean". Renaming it would strand the cards the children already own for no
 * gain. At roughly four seasons a year, a pack per season would fill the
 * Backpack with near-empty halls within a year; instead the hall is displayed
 * as 赛季珍藏 / Season Vault and `PACK_REGISTRY` groups its cards by season,
 * the same way flags group by continent.
 */
export interface SeasonCardItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
  rarity: 'rare' | 'epic';
  /** Which season awarded it — the grouping key in the Backpack. */
  season: 'summer-2026' | 'caspian-2026';
}

export const SEASON_CARD_ITEMS: SeasonCardItem[] = [
  {
    slug: 'season-tortoise',
    season: 'summer-2026',
    nameZh: '海龟船长',
    nameEn: 'Captain Tortoise',
    emoji: '🐢',
    rarity: 'rare',
    loreZh: '最年长的航海家，背着整片海的故事。',
    loreEn: 'The oldest navigator, carrying the whole sea on its back.',
  },
  {
    slug: 'season-flyingfish',
    season: 'summer-2026',
    nameZh: '飞鱼信使',
    nameEn: 'Flying-Fish Courier',
    emoji: '🐟',
    rarity: 'rare',
    loreZh: '在浪尖上飞驰，替船队传递消息。',
    loreEn: 'Skimming the wave-tops, carrying messages for the fleet.',
  },
  {
    slug: 'season-dolphin',
    season: 'summer-2026',
    nameZh: '海豚伙伴',
    nameEn: 'Dolphin Friend',
    emoji: '🐬',
    rarity: 'epic',
    loreZh: '夏天最快乐的朋友，总在船头跳跃。',
    loreEn: "Summer's happiest friend, always leaping at the bow.",
  },
  {
    slug: 'season-kraken',
    season: 'summer-2026',
    nameZh: '黄金海怪',
    nameEn: 'Golden Kraken',
    emoji: '🐙',
    rarity: 'epic',
    loreZh: '传说中守护夏季宝藏的金色海怪。',
    loreEn: 'The golden kraken said to guard the summer treasure.',
  },

  // ─── 里海远航 / Caspian Passage ────────────────────────────────────────────
  // The season's teaching lives HERE, in the lore, not on the cosmetics: the
  // countries, peoples and history around the Caspian, each on a card whose
  // fact is true and checkable. Deliberately animals, places and trade goods —
  // a six-year-old wearing a people's traditional dress as a game skin is
  // dressing-up, not learning.
  {
    slug: 'season-caspian-seal',
    season: 'caspian-2026',
    nameZh: '里海海豹',
    nameEn: 'Caspian Seal',
    emoji: '🦭',
    rarity: 'rare',
    loreZh: '全世界只有里海有这种海豹,别的地方都找不到。',
    loreEn: 'This seal lives in the Caspian and nowhere else on Earth.',
  },
  {
    slug: 'season-caspian-sturgeon',
    season: 'caspian-2026',
    nameZh: '鲟鱼',
    nameEn: 'Sturgeon',
    emoji: '🐟',
    rarity: 'rare',
    loreZh: '里海最有名的鱼,比恐龙还要古老。',
    loreEn: "The Caspian's most famous fish — older than the dinosaurs.",
  },
  {
    slug: 'season-caspian-eagle',
    season: 'caspian-2026',
    nameZh: '金雕猎手',
    nameEn: 'Golden Eagle Hunter',
    emoji: '🦅',
    rarity: 'epic',
    loreZh: '哈萨克的猎人骑着马,让金雕站在手臂上一起打猎。',
    loreEn: 'Kazakh hunters ride out with a golden eagle perched on one arm.',
  },
  {
    slug: 'season-caspian-horse',
    season: 'caspian-2026',
    nameZh: '汗血宝马',
    nameEn: 'Akhal-Teke Horse',
    emoji: '🐎',
    rarity: 'epic',
    loreZh: '来自土库曼的骏马。两千年前,汉朝人沿着丝绸之路把它带回中国。',
    loreEn: 'A horse from Turkmenistan. Two thousand years ago it travelled the Silk Road into China.',
  },
  {
    slug: 'season-caspian-baku',
    season: 'caspian-2026',
    nameZh: '火之城巴库',
    nameEn: 'Baku, City of Fire',
    emoji: '🔥',
    rarity: 'epic',
    loreZh: '阿塞拜疆的意思就是"火之国"——那里的火从地底下自己烧上来。',
    loreEn: 'Azerbaijan means "land of fire" — there, flames rise straight out of the ground.',
  },
];

export const SEASON_CARDS_BY_SLUG: Record<string, SeasonCardItem> =
  Object.fromEntries(SEASON_CARD_ITEMS.map((c) => [c.slug, c]));

/** Backpack section headers, bilingual, newest season first. */
export const SEASON_GROUP_LABELS: Record<
  SeasonCardItem['season'],
  { zh: string; en: string; emoji: string }
> = {
  'caspian-2026': { zh: '里海远航', en: 'Caspian Passage', emoji: '🏺' },
  'summer-2026': { zh: '夏季航海', en: 'Summer Voyage', emoji: '⛵' },
};

/** Section order in the Backpack, newest first. */
export const SEASON_GROUP_ORDER: SeasonCardItem['season'][] = ['caspian-2026', 'summer-2026'];
