/**
 * 夏季航海 / Summer Voyage season cards (`season-summer-v1`) — reward-only.
 * Earned ONLY via the Season Pass reward track (never gacha; the pack is
 * `gacha_eligible = false`). Emoji glyph fallback; `CardArt` swaps to real flux
 * art once `collectible_items.image_url` is populated. Bilingual per the locked
 * collectibles rule.
 */
export interface SeasonCardItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
  rarity: 'rare' | 'epic';
}

export const SEASON_CARD_ITEMS: SeasonCardItem[] = [
  {
    slug: 'season-tortoise',
    nameZh: '海龟船长',
    nameEn: 'Captain Tortoise',
    emoji: '🐢',
    rarity: 'rare',
    loreZh: '最年长的航海家，背着整片海的故事。',
    loreEn: 'The oldest navigator, carrying the whole sea on its back.',
  },
  {
    slug: 'season-flyingfish',
    nameZh: '飞鱼信使',
    nameEn: 'Flying-Fish Courier',
    emoji: '🐟',
    rarity: 'rare',
    loreZh: '在浪尖上飞驰，替船队传递消息。',
    loreEn: 'Skimming the wave-tops, carrying messages for the fleet.',
  },
  {
    slug: 'season-dolphin',
    nameZh: '海豚伙伴',
    nameEn: 'Dolphin Friend',
    emoji: '🐬',
    rarity: 'epic',
    loreZh: '夏天最快乐的朋友，总在船头跳跃。',
    loreEn: "Summer's happiest friend, always leaping at the bow.",
  },
  {
    slug: 'season-kraken',
    nameZh: '黄金海怪',
    nameEn: 'Golden Kraken',
    emoji: '🐙',
    rarity: 'epic',
    loreZh: '传说中守护夏季宝藏的金色海怪。',
    loreEn: 'The golden kraken said to guard the summer treasure.',
  },
];

export const SEASON_CARDS_BY_SLUG: Record<string, SeasonCardItem> =
  Object.fromEntries(SEASON_CARD_ITEMS.map((c) => [c.slug, c]));
