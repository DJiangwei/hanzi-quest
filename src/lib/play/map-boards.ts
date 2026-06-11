export interface VoyageStop {
  labelZh: string;
  labelEn: string;
  /** Landmark emoji shown in the medallion. */
  emoji: string;
}

export interface VoyageMap {
  nameZh: string;
  nameEn: string;
  /** Ordered to match weekNumber: stops[0] = week 1. */
  stops: VoyageStop[];
  /**
   * Generated illustrated sea-chart backdrop (Vercel Blob URL). Optional — when
   * absent the board draws a procedural sea-chart instead. Populate by running
   * `scripts/generate-voyage-map-art.ts` and pasting the printed URL here.
   */
  imageUrl?: string;
}

/** Keyed by curriculum pack slug. Packs absent here fall back to <IslandMap>. */
export const VOYAGE_MAPS: Record<string, VoyageMap> = {
  'pirate-class-level-1': {
    nameZh: '加勒比海',
    nameEn: 'Caribbean Sea',
    imageUrl: 'https://mfl7ap4djy0w98ey.public.blob.vercel-storage.com/maps/pirate-class-level-1.jpg',
    stops: [
      { labelZh: '旧哈瓦那', labelEn: 'Old Havana', emoji: '🏛️' },
      { labelZh: '大蓝洞', labelEn: 'Great Blue Hole', emoji: '🌀' },
      { labelZh: '伯利兹群岛度假村', labelEn: 'Belize Cayes Resort', emoji: '🏝️' },
      { labelZh: '图卢姆玛雅遗址', labelEn: 'Tulum Mayan Ruins', emoji: '🛕' },
      { labelZh: '黄貂鱼城', labelEn: 'Stingray City', emoji: '🐠' },
      { labelZh: '蓝山瀑布', labelEn: 'Blue Mountains Waterfall', emoji: '🏔️' },
      { labelZh: '托尔图盖罗海龟海滩', labelEn: 'Tortuguero Turtle Beach', emoji: '🐢' },
      { labelZh: '哥斯达黎加丛林', labelEn: 'Costa Rican Jungle', emoji: '🦜' },
      { labelZh: '皮通山', labelEn: 'The Pitons', emoji: '⛰️' },
      { labelZh: '托尔图加岛海盗巢穴', labelEn: "Tortuga Pirate's Lair", emoji: '🏴‍☠️' },
    ],
  },
  'pirate-class-level-2': {
    nameZh: '印度洋',
    nameEn: 'Indian Ocean',
    imageUrl: 'https://mfl7ap4djy0w98ey.public.blob.vercel-storage.com/maps/pirate-class-level-2.jpg',
    stops: [
      { labelZh: '毛里求斯瀑布', labelEn: 'Mauritius Waterfall', emoji: '💦' },
      { labelZh: '留尼汪海龟海滩', labelEn: 'Réunion Turtle Beach', emoji: '🐢' },
      { labelZh: '马斯喀特苏丹王宫', labelEn: "Muscat Sultan's Palace", emoji: '🕌' },
      { labelZh: '塞舌尔花岗岩兽穴', labelEn: 'Seychelles Granites Lair', emoji: '🐉' },
      { labelZh: '查戈斯环礁', labelEn: 'Chagos Atoll', emoji: '🏝️' },
      { labelZh: '马尔代夫泻湖', labelEn: 'Maldives Lagoons', emoji: '🏖️' },
      { labelZh: '桑给巴尔香料镇', labelEn: 'Zanzibar Spice Town', emoji: '🧺' },
      { labelZh: '孙德尔本斯红树林', labelEn: 'Sundarbans Mangroves', emoji: '🌳' },
      { labelZh: '安达曼丛林', labelEn: 'Andaman Jungle', emoji: '🐯' },
    ],
  },
};

export function getVoyageMap(packSlug: string): VoyageMap | null {
  return VOYAGE_MAPS[packSlug] ?? null;
}
