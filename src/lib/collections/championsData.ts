/** 海域霸主 / Map Champion reward cards (`champions-v1`) — reward-only, one per
 *  map, earned ONLY by beating that map's final boss (pack gacha_eligible=false,
 *  shard-swap-exclusive). Bilingual per the locked collectibles rule. */
export interface ChampionItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
}

export const CHAMPIONS: ChampionItem[] = [
  {
    slug: 'champion-caribbean',
    nameZh: '加勒比海霸主',
    nameEn: 'Lord of the Caribbean',
    emoji: '👑',
    loreZh: '你击败了幽灵旗舰，成为加勒比海的霸主！',
    loreEn: 'You sank the Ghost Galleon and became Lord of the Caribbean!',
  },
];

export const CHAMPIONS_BY_SLUG: Record<string, ChampionItem> = Object.fromEntries(
  CHAMPIONS.map((c) => [c.slug, c]),
);

/** Map pack slug → its champion card slug. */
export const MAP_TO_CHAMPION_CARD: Record<string, string> = {
  'pirate-class-level-1': 'champion-caribbean',
};

/** Map pack slug → the bilingual champion title (shown on the home chip). */
export const CHAMPION_TITLES: Record<string, { zh: string; en: string }> = {
  'pirate-class-level-1': { zh: '加勒比海霸主', en: 'Lord of the Caribbean' },
};
