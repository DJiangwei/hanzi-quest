export interface MapHotspot {
  /** Center X as % of image width (0–100). */
  xPct: number;
  /** Center Y as % of image height (0–100). */
  yPct: number;
  /** Landmark scenery name (display only — weeks teach hanzi, not geography). */
  labelZh: string;
  labelEn: string;
}

export interface MapBoardConfig {
  imageSrc: string;
  nameZh: string;
  nameEn: string;
  /** Ordered to match weekNumber: hotspots[0] = week 1. */
  hotspots: MapHotspot[];
}

/** Keyed by curriculum pack slug. Packs absent here fall back to <IslandMap>. */
export const MAP_BOARDS: Record<string, MapBoardConfig> = {
  'pirate-class-level-1': {
    imageSrc: '/maps/caribbean-sea.webp',
    nameZh: '加勒比海',
    nameEn: 'Caribbean Sea',
    hotspots: [
      { xPct: 20, yPct: 33, labelZh: '旧哈瓦那', labelEn: 'Old Havana' },
      { xPct: 50, yPct: 27, labelZh: '大蓝洞', labelEn: 'Great Blue Hole' },
      { xPct: 80, yPct: 28, labelZh: '伯利兹群岛度假村', labelEn: 'Belize Cayes Resort' },
      { xPct: 83, yPct: 56, labelZh: '图卢姆玛雅遗址', labelEn: 'Tulum Mayan Ruins' },
      { xPct: 50, yPct: 49, labelZh: '黄貂鱼城', labelEn: 'Stingray City' },
      { xPct: 22, yPct: 55, labelZh: '蓝山瀑布', labelEn: 'Blue Mountains Waterfall' },
      { xPct: 20, yPct: 72, labelZh: '托尔图盖罗海龟海滩', labelEn: 'Tortuguero Turtle Beach' },
      { xPct: 17, yPct: 87, labelZh: '哥斯达黎加丛林', labelEn: 'Costa Rican Jungle' },
      { xPct: 50, yPct: 84, labelZh: '皮通山', labelEn: 'The Pitons' },
      { xPct: 80, yPct: 84, labelZh: '托尔图加岛海盗巢穴', labelEn: "Tortuga Pirate's Lair" },
    ],
  },
  'pirate-class-level-2': {
    imageSrc: '/maps/indian-ocean.webp',
    nameZh: '印度洋',
    nameEn: 'Indian Ocean',
    hotspots: [
      { xPct: 17, yPct: 35, labelZh: '毛里求斯瀑布', labelEn: 'Mauritius Waterfall' },
      { xPct: 45, yPct: 28, labelZh: '留尼汪海龟海滩', labelEn: 'Réunion Turtle Beach' },
      { xPct: 75, yPct: 27, labelZh: '马斯喀特苏丹王宫', labelEn: "Muscat Sultan's Palace" },
      { xPct: 80, yPct: 55, labelZh: '塞舌尔花岗岩兽穴', labelEn: 'Seychelles Granites Lair' },
      { xPct: 47, yPct: 52, labelZh: '查戈斯环礁', labelEn: 'Chagos Atoll' },
      { xPct: 20, yPct: 60, labelZh: '马尔代夫泻湖', labelEn: 'Maldives Lagoons' },
      { xPct: 17, yPct: 78, labelZh: '桑给巴尔香料镇', labelEn: 'Zanzibar Spice Town' },
      { xPct: 48, yPct: 82, labelZh: '孙德尔本斯红树林', labelEn: 'Sundarbans Mangroves' },
      { xPct: 78, yPct: 80, labelZh: '安达曼丛林', labelEn: 'Andaman Jungle' },
    ],
  },
};

export function getMapBoard(packSlug: string): MapBoardConfig | null {
  return MAP_BOARDS[packSlug] ?? null;
}
