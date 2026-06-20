/** 昆虫 / Minibeasts collectible pack (`minibeasts-v1`). Flat (no grouping). */
export interface MinibeastItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  loreZh: string;
  loreEn: string;
}

export const MINIBEASTS: MinibeastItem[] = [
  { slug: 'butterfly', nameZh: '蝴蝶', nameEn: 'Butterfly', emoji: '🦋', loreZh: '翅膀五颜六色，飞来飞去。', loreEn: 'Colourful wings that flutter about.' },
  { slug: 'bee', nameZh: '蜜蜂', nameEn: 'Bee', emoji: '🐝', loreZh: '采花蜜，会嗡嗡叫。', loreEn: 'Buzzes around collecting nectar.' },
  { slug: 'ladybird', nameZh: '瓢虫', nameEn: 'Ladybird', emoji: '🐞', loreZh: '红背上有黑点点。', loreEn: 'Red back with little black spots.' },
  { slug: 'ant', nameZh: '蚂蚁', nameEn: 'Ant', emoji: '🐜', loreZh: '小小的力气却很大。', loreEn: 'Tiny but very strong.' },
  { slug: 'spider', nameZh: '蜘蛛', nameEn: 'Spider', emoji: '🕷️', loreZh: '会织一张大网。', loreEn: 'Spins a big web.' },
  { slug: 'snail', nameZh: '蜗牛', nameEn: 'Snail', emoji: '🐌', loreZh: '背着小房子慢慢爬。', loreEn: 'Carries its house and moves slowly.' },
  { slug: 'caterpillar', nameZh: '毛毛虫', nameEn: 'Caterpillar', emoji: '🐛', loreZh: '长大后变成蝴蝶。', loreEn: 'Grows up into a butterfly.' },
  { slug: 'dragonfly', nameZh: '蜻蜓', nameEn: 'Dragonfly', emoji: '🪰', loreZh: '在水边飞得很快。', loreEn: 'Zips fast by the water.' },
  { slug: 'grasshopper', nameZh: '蚱蜢', nameEn: 'Grasshopper', emoji: '🦗', loreZh: '后腿一蹬跳得老高。', loreEn: 'Springs high on strong back legs.' },
  { slug: 'beetle', nameZh: '甲虫', nameEn: 'Beetle', emoji: '🪲', loreZh: '硬硬的外壳像盔甲。', loreEn: 'A hard shell like armour.' },
  { slug: 'earthworm', nameZh: '蚯蚓', nameEn: 'Earthworm', emoji: '🪱', loreZh: '在泥土里钻来钻去。', loreEn: 'Wriggles through the soil.' },
  { slug: 'woodlouse', nameZh: '鼠妇', nameEn: 'Woodlouse', emoji: '🪨', loreZh: '一碰就缩成小球。', loreEn: 'Curls into a ball when touched.' },
];

export const MINIBEASTS_BY_SLUG: Record<string, MinibeastItem> = Object.fromEntries(
  MINIBEASTS.map((m) => [m.slug, m]),
);
