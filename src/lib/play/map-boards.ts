export interface VoyageStop {
  labelZh: string;
  labelEn: string;
  /** Landmark emoji shown in the medallion. */
  emoji: string;
}

/**
 * Per-map chrome accent (plain hex, applied inline). Differentiates the small
 * shared chrome (home `MapHeaderPill`, `/maps` cards) so each sea region has its
 * own colour. The voyage-board frame stays the shared treasure-map look; a map's
 * identity comes mostly from its backdrop + stops, with this as a chrome accent.
 */
export interface MapAccent {
  pillBg: string;
  pillText: string;
  cardBorder: string;
}

export interface VoyageMap {
  nameZh: string;
  nameEn: string;
  /** Chrome accent; falls back to the ocean-turquoise default when absent. */
  accent?: MapAccent;
  /** Ordered to match weekNumber: stops[0] = week 1. */
  stops: VoyageStop[];
  /**
   * Generated illustrated sea-chart backdrop (Vercel Blob URL). Optional — when
   * absent the board draws a procedural sea-chart instead. Populate by running
   * `scripts/generate-voyage-map-art.ts` and pasting the printed URL here.
   */
  imageUrl?: string;
  /**
   * Overrides the generator's shared STYLE prompt for this map's backdrop.
   * The shared one asks for "a few small tropical islands", which pulls every
   * sea toward Caribbean turquoise — fine for map 1, wrong for anywhere else.
   * See scripts/generate-voyage-map-art.ts.
   */
  backdropPrompt?: string;
}

/** Ocean-turquoise default — matches the legacy `--color-ocean` chrome. */
export const DEFAULT_MAP_ACCENT: MapAccent = {
  pillBg: '#d4eff2',
  pillText: '#0e7490',
  cardBorder: '#7dd3dc',
};

/** Resolve a map's chrome accent by pack slug (default when none configured). */
export function getMapAccent(packSlug: string): MapAccent {
  return VOYAGE_MAPS[packSlug]?.accent ?? DEFAULT_MAP_ACCENT;
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
    nameZh: '里海',
    nameEn: 'Caspian Sea',
    // The shared STYLE prompt asks for tropical islands and produced a chart
    // indistinguishable from the Caribbean's — turquoise water, palm-topped
    // sand cays. The Caspian is a LANDLOCKED sea ringed by desert and steppe,
    // so this one names that explicitly and pushes the palette cold.
    backdropPrompt:
      'a colorful cartoon treasure map sea chart for children of the Caspian Sea, ' +
      'a large inland sea completely enclosed by land on every side, deep indigo ' +
      'and slate-blue water, surrounding desert and dry steppe coastline in ochre ' +
      'and pale sand, no palm trees, no tropical islands, a single small compass ' +
      'rose in one corner, a friendly cute sturgeon fish and a small seal, ' +
      'top-down map view, aged parchment border, bright and playful, ' +
      'completely free of any text, words, letters, numbers, labels, ' +
      'dotted lines, dashed lines, routes, paths or trails',
    // Night-sea indigo — deliberately far from both the Caribbean turquoise
    // and the Indian Ocean coral, so the header pill still says where she is.
    accent: {
      pillBg: '#e2e0f0',
      pillText: '#3b357a',
      cardBorder: '#8f88c8',
    },
    // Regenerated for the Caspian on 2026-09-05 (the path previously held the
    // Indian Ocean art this map was re-themed away from). Chosen from three
    // local previews rather than the first roll: this one shows a genuinely
    // ENCLOSED inland sea in deep indigo — the Caspian's defining feature and
    // clearly distinct from map 1's turquoise — and leaves the centre empty
    // for the route, medallions and ship the board draws on top.
    imageUrl:
      'https://mfl7ap4djy0w98ey.public.blob.vercel-storage.com/maps/pirate-class-level-2.jpg',
    //
    // Ten real places, anticlockwise round the sea: Azerbaijan → Russia →
    // Kazakhstan → Turkmenistan. The Caspian seal is the only seal living in a
    // landlocked sea, nine tenths of the world's wild sturgeon are here, and
    // Yanardag has been burning on leaking natural gas for millennia — the
    // finale, mirroring how the Caribbean ends at a pirate lair.
    stops: [
      { labelZh: '巴库少女塔', labelEn: 'Maiden Tower, Baku', emoji: '🗼' },
      { labelZh: '戈布斯坦泥火山', labelEn: 'Gobustan Mud Volcanoes', emoji: '🌋' },
      { labelZh: '火烈鸟盐湖', labelEn: 'Flamingo Salt Lake', emoji: '🦩' },
      { labelZh: '伏尔加河莲花三角洲', labelEn: 'Volga Lotus Delta', emoji: '🪷' },
      { labelZh: '里海海豹岛', labelEn: 'Caspian Seal Island', emoji: '🦭' },
      { labelZh: '鲟鱼浅滩', labelEn: 'Sturgeon Shallows', emoji: '🐟' },
      { labelZh: '阿克套白垩崖', labelEn: 'Aktau Chalk Cliffs', emoji: '🏔️' },
      { labelZh: '曼格斯套石谷', labelEn: 'Mangystau Stone Valley', emoji: '🪨' },
      { labelZh: '土库曼巴希港', labelEn: 'Turkmenbashi Harbour', emoji: '⚓' },
      { labelZh: '火焰山', labelEn: 'Burning Mountain', emoji: '🔥' },
    ],
  },
  // Reserve, ready for a third map. Re-themed out of map 2 on 2026-09-05 and
  // kept whole rather than deleted, so opening it later is a seed row plus a
  // backdrop instead of a rewrite. It shipped with NINE stops against a
  // ten-week map, which would have dropped week 10 off the board entirely —
  // the PR #151 failure again; 亚丁湾风暴角 is the tenth, and a test now pins
  // the count for every map.
  'pirate-class-level-3': {
    nameZh: '印度洋',
    nameEn: 'Indian Ocean',
    // Warm spice-route accent (coral/amber).
    accent: {
      pillBg: '#fde4cf',
      pillText: '#b4530a',
      cardBorder: '#f0a868',
    },
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
      { labelZh: '亚丁湾风暴角', labelEn: 'Gulf of Aden Storm Cape', emoji: '🌊' },
    ],
  },
};

export function getVoyageMap(packSlug: string): VoyageMap | null {
  return VOYAGE_MAPS[packSlug] ?? null;
}
