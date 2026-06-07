/**
 * Source of truth for the 世界国旗 / World Flags collection pack.
 *
 * Yinuo is English-native (UK heritage learner) — every field that the kid
 * sees is bilingual. Capital is rendered alongside the country name; lore is
 * one short, kid-friendly, apolitical fact per country. Emoji flags are stored
 * in `collectible_items.image_url` at seed time; the renderer uses them as
 * plain text glyphs (no `<img>`).
 *
 * The pack covers all 193 UN member states grouped into 6 continents. The
 * `continent` field is render-derived (the Backpack groups by it via the pack
 * registry) — there is no `continent` DB column. The flag `emoji` is DERIVED
 * from `iso2` via the Unicode regional-indicator transform, so the emoji always
 * matches the country and we never hand-type ~190 glyphs.
 *
 * Disputed / non-UN-member territories are intentionally excluded (Taiwan,
 * Kosovo, Palestine, Western Sahara, Vatican, Northern Cyprus, etc.).
 * Cross-continental countries are assigned to exactly one continent by common
 * kid-atlas convention: Russia→Europe, Türkiye/Kazakhstan/Azerbaijan/Armenia/
 * Georgia→Asia, Cyprus→Europe, Egypt→Africa, Central America + the Caribbean→
 * North America.
 */

export type FlagRarity = 'common' | 'rare' | 'epic';

export type Continent =
  | 'asia'
  | 'europe'
  | 'africa'
  | 'north_america'
  | 'south_america'
  | 'oceania';

export const CONTINENT_LABELS: Record<
  Continent,
  { zh: string; en: string; emoji: string }
> = {
  asia: { zh: '亚洲', en: 'Asia', emoji: '🌏' },
  europe: { zh: '欧洲', en: 'Europe', emoji: '🌍' },
  africa: { zh: '非洲', en: 'Africa', emoji: '🌍' },
  north_america: { zh: '北美洲', en: 'North America', emoji: '🌎' },
  south_america: { zh: '南美洲', en: 'South America', emoji: '🌎' },
  oceania: { zh: '大洋洲', en: 'Oceania', emoji: '🌏' },
};

/** Fixed display order for the grouped Backpack render. */
export const CONTINENT_ORDER: Continent[] = [
  'asia',
  'europe',
  'africa',
  'north_america',
  'south_america',
  'oceania',
];

/**
 * Build a 🇨🇳-style flag emoji from an ISO-3166 alpha-2 code via the Unicode
 * regional-indicator transform (a→🇦 … z→🇿). Returns 🏳️ for malformed input.
 */
export function flagEmojiFromIso2(iso2: string): string {
  const cc = iso2.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return '🏳️';
  const BASE = 0x1f1e6; // regional indicator 'A'
  const a = 'a'.charCodeAt(0);
  return String.fromCodePoint(
    BASE + (cc.charCodeAt(0) - a),
    BASE + (cc.charCodeAt(1) - a),
  );
}

export interface FlagItem {
  slug: string;
  iso2: string;
  /** Derived from `iso2` at build time — do not hand-set. */
  emoji: string;
  continent: Continent;
  nameZh: string;
  nameEn: string;
  capitalZh: string;
  capitalEn: string;
  loreZh: string;
  loreEn: string;
  rarity: FlagRarity;
  dropWeight: number;
}

type RawFlag = Omit<FlagItem, 'emoji'>;

const RAW_FLAGS: RawFlag[] = [
  // ---------------------------------------------------------------- Asia (46)
  { slug: 'china', iso2: 'cn', continent: 'asia', nameZh: '中国', nameEn: 'China', capitalZh: '北京', capitalEn: 'Beijing', loreZh: '大熊猫的故乡。', loreEn: 'Home of the giant panda!', rarity: 'common', dropWeight: 3 },
  { slug: 'japan', iso2: 'jp', continent: 'asia', nameZh: '日本', nameEn: 'Japan', capitalZh: '东京', capitalEn: 'Tokyo', loreZh: '樱花和富士山很美丽。', loreEn: 'Cherry blossoms and Mount Fuji!', rarity: 'common', dropWeight: 3 },
  { slug: 'south-korea', iso2: 'kr', continent: 'asia', nameZh: '韩国', nameEn: 'South Korea', capitalZh: '首尔', capitalEn: 'Seoul', loreZh: '泡菜和歌曲很流行。', loreEn: 'Famous for kimchi and K-pop.', rarity: 'common', dropWeight: 3 },
  { slug: 'north-korea', iso2: 'kp', continent: 'asia', nameZh: '朝鲜', nameEn: 'North Korea', capitalZh: '平壤', capitalEn: 'Pyongyang', loreZh: '有很多高高的山。', loreEn: 'Has many tall mountains.', rarity: 'epic', dropWeight: 1 },
  { slug: 'mongolia', iso2: 'mn', continent: 'asia', nameZh: '蒙古', nameEn: 'Mongolia', capitalZh: '乌兰巴托', capitalEn: 'Ulaanbaatar', loreZh: '大草原和骑马的地方。', loreEn: 'Land of grasslands and horses.', rarity: 'rare', dropWeight: 2 },
  { slug: 'india', iso2: 'in', continent: 'asia', nameZh: '印度', nameEn: 'India', capitalZh: '新德里', capitalEn: 'New Delhi', loreZh: '有美丽的泰姬陵。', loreEn: 'Home of the Taj Mahal.', rarity: 'common', dropWeight: 3 },
  { slug: 'pakistan', iso2: 'pk', continent: 'asia', nameZh: '巴基斯坦', nameEn: 'Pakistan', capitalZh: '伊斯兰堡', capitalEn: 'Islamabad', loreZh: '有高高的雪山。', loreEn: 'Home to tall snowy mountains.', rarity: 'rare', dropWeight: 2 },
  { slug: 'bangladesh', iso2: 'bd', continent: 'asia', nameZh: '孟加拉国', nameEn: 'Bangladesh', capitalZh: '达卡', capitalEn: 'Dhaka', loreZh: '有很多大河。', loreEn: 'Crossed by many big rivers.', rarity: 'rare', dropWeight: 2 },
  { slug: 'sri-lanka', iso2: 'lk', continent: 'asia', nameZh: '斯里兰卡', nameEn: 'Sri Lanka', capitalZh: '科伦坡', capitalEn: 'Colombo', loreZh: '出产好喝的红茶。', loreEn: 'Famous for delicious tea.', rarity: 'rare', dropWeight: 2 },
  { slug: 'nepal', iso2: 'np', continent: 'asia', nameZh: '尼泊尔', nameEn: 'Nepal', capitalZh: '加德满都', capitalEn: 'Kathmandu', loreZh: '世界最高峰珠峰在这里。', loreEn: 'Home of Mount Everest.', rarity: 'rare', dropWeight: 2 },
  { slug: 'bhutan', iso2: 'bt', continent: 'asia', nameZh: '不丹', nameEn: 'Bhutan', capitalZh: '廷布', capitalEn: 'Thimphu', loreZh: '喜欢测量幸福的国家。', loreEn: 'Famous for measuring happiness.', rarity: 'epic', dropWeight: 1 },
  { slug: 'maldives', iso2: 'mv', continent: 'asia', nameZh: '马尔代夫', nameEn: 'Maldives', capitalZh: '马累', capitalEn: 'Malé', loreZh: '蓝色海洋上的小岛。', loreEn: 'Tiny islands in a blue sea.', rarity: 'epic', dropWeight: 1 },
  { slug: 'afghanistan', iso2: 'af', continent: 'asia', nameZh: '阿富汗', nameEn: 'Afghanistan', capitalZh: '喀布尔', capitalEn: 'Kabul', loreZh: '有古老的丝绸之路。', loreEn: 'Once part of the old Silk Road.', rarity: 'rare', dropWeight: 2 },
  { slug: 'kazakhstan', iso2: 'kz', continent: 'asia', nameZh: '哈萨克斯坦', nameEn: 'Kazakhstan', capitalZh: '阿斯塔纳', capitalEn: 'Astana', loreZh: '世界最大的内陆国。', loreEn: 'The largest landlocked country.', rarity: 'rare', dropWeight: 2 },
  { slug: 'uzbekistan', iso2: 'uz', continent: 'asia', nameZh: '乌兹别克斯坦', nameEn: 'Uzbekistan', capitalZh: '塔什干', capitalEn: 'Tashkent', loreZh: '丝绸之路上的古城。', loreEn: 'Old cities along the Silk Road.', rarity: 'epic', dropWeight: 1 },
  { slug: 'turkmenistan', iso2: 'tm', continent: 'asia', nameZh: '土库曼斯坦', nameEn: 'Turkmenistan', capitalZh: '阿什哈巴德', capitalEn: 'Ashgabat', loreZh: '有一个燃烧的大火坑。', loreEn: 'Has a giant burning gas crater.', rarity: 'epic', dropWeight: 1 },
  { slug: 'kyrgyzstan', iso2: 'kg', continent: 'asia', nameZh: '吉尔吉斯斯坦', nameEn: 'Kyrgyzstan', capitalZh: '比什凯克', capitalEn: 'Bishkek', loreZh: '高山和湖泊的家。', loreEn: 'Land of mountains and lakes.', rarity: 'epic', dropWeight: 1 },
  { slug: 'tajikistan', iso2: 'tj', continent: 'asia', nameZh: '塔吉克斯坦', nameEn: 'Tajikistan', capitalZh: '杜尚别', capitalEn: 'Dushanbe', loreZh: '几乎全是大山。', loreEn: 'Almost all mountains!', rarity: 'epic', dropWeight: 1 },
  { slug: 'iran', iso2: 'ir', continent: 'asia', nameZh: '伊朗', nameEn: 'Iran', capitalZh: '德黑兰', capitalEn: 'Tehran', loreZh: '有美丽的花园和地毯。', loreEn: 'Famous for gardens and carpets.', rarity: 'rare', dropWeight: 2 },
  { slug: 'iraq', iso2: 'iq', continent: 'asia', nameZh: '伊拉克', nameEn: 'Iraq', capitalZh: '巴格达', capitalEn: 'Baghdad', loreZh: '古老文明的发源地。', loreEn: 'Birthplace of ancient cities.', rarity: 'rare', dropWeight: 2 },
  { slug: 'syria', iso2: 'sy', continent: 'asia', nameZh: '叙利亚', nameEn: 'Syria', capitalZh: '大马士革', capitalEn: 'Damascus', loreZh: '有非常古老的城市。', loreEn: 'Home to very ancient cities.', rarity: 'epic', dropWeight: 1 },
  { slug: 'lebanon', iso2: 'lb', continent: 'asia', nameZh: '黎巴嫩', nameEn: 'Lebanon', capitalZh: '贝鲁特', capitalEn: 'Beirut', loreZh: '有高大的雪松树。', loreEn: 'Famous for tall cedar trees.', rarity: 'rare', dropWeight: 2 },
  { slug: 'jordan', iso2: 'jo', continent: 'asia', nameZh: '约旦', nameEn: 'Jordan', capitalZh: '安曼', capitalEn: 'Amman', loreZh: '有玫瑰色的古城佩特拉。', loreEn: 'Home of the rose-red city Petra.', rarity: 'rare', dropWeight: 2 },
  { slug: 'israel', iso2: 'il', continent: 'asia', nameZh: '以色列', nameEn: 'Israel', capitalZh: '耶路撒冷', capitalEn: 'Jerusalem', loreZh: '有很咸的死海。', loreEn: 'Home of the salty Dead Sea.', rarity: 'rare', dropWeight: 2 },
  { slug: 'saudi-arabia', iso2: 'sa', continent: 'asia', nameZh: '沙特阿拉伯', nameEn: 'Saudi Arabia', capitalZh: '利雅得', capitalEn: 'Riyadh', loreZh: '沙漠和椰枣的国度。', loreEn: 'Land of deserts and date palms.', rarity: 'rare', dropWeight: 2 },
  { slug: 'yemen', iso2: 'ye', continent: 'asia', nameZh: '也门', nameEn: 'Yemen', capitalZh: '萨那', capitalEn: "Sana'a", loreZh: '有像积木一样的高楼。', loreEn: 'Has tall tower houses.', rarity: 'epic', dropWeight: 1 },
  { slug: 'oman', iso2: 'om', continent: 'asia', nameZh: '阿曼', nameEn: 'Oman', capitalZh: '马斯喀特', capitalEn: 'Muscat', loreZh: '出产香香的乳香。', loreEn: 'Famous for sweet frankincense.', rarity: 'epic', dropWeight: 1 },
  { slug: 'uae', iso2: 'ae', continent: 'asia', nameZh: '阿联酋', nameEn: 'UAE', capitalZh: '阿布扎比', capitalEn: 'Abu Dhabi', loreZh: '世界最高的楼在迪拜。', loreEn: 'Has the tallest tower in the world.', rarity: 'epic', dropWeight: 1 },
  { slug: 'qatar', iso2: 'qa', continent: 'asia', nameZh: '卡塔尔', nameEn: 'Qatar', capitalZh: '多哈', capitalEn: 'Doha', loreZh: '沙漠里的现代城市。', loreEn: 'A modern city in the desert.', rarity: 'rare', dropWeight: 2 },
  { slug: 'bahrain', iso2: 'bh', continent: 'asia', nameZh: '巴林', nameEn: 'Bahrain', capitalZh: '麦纳麦', capitalEn: 'Manama', loreZh: '由很多小岛组成。', loreEn: 'Made of many small islands.', rarity: 'epic', dropWeight: 1 },
  { slug: 'kuwait', iso2: 'kw', continent: 'asia', nameZh: '科威特', nameEn: 'Kuwait', capitalZh: '科威特城', capitalEn: 'Kuwait City', loreZh: '有高高的水塔。', loreEn: 'Famous for its tall water towers.', rarity: 'rare', dropWeight: 2 },
  { slug: 'turkey', iso2: 'tr', continent: 'asia', nameZh: '土耳其', nameEn: 'Türkiye', capitalZh: '安卡拉', capitalEn: 'Ankara', loreZh: '热气球飞过卡帕多奇亚。', loreEn: 'Hot air balloons over Cappadocia!', rarity: 'rare', dropWeight: 2 },
  { slug: 'thailand', iso2: 'th', continent: 'asia', nameZh: '泰国', nameEn: 'Thailand', capitalZh: '曼谷', capitalEn: 'Bangkok', loreZh: '大象和金色寺庙。', loreEn: 'Home of elephants and golden temples.', rarity: 'rare', dropWeight: 2 },
  { slug: 'vietnam', iso2: 'vn', continent: 'asia', nameZh: '越南', nameEn: 'Vietnam', capitalZh: '河内', capitalEn: 'Hanoi', loreZh: '河粉很好吃。', loreEn: 'Famous for pho noodle soup.', rarity: 'rare', dropWeight: 2 },
  { slug: 'cambodia', iso2: 'kh', continent: 'asia', nameZh: '柬埔寨', nameEn: 'Cambodia', capitalZh: '金边', capitalEn: 'Phnom Penh', loreZh: '有宏伟的吴哥窟。', loreEn: 'Home of the grand Angkor Wat.', rarity: 'rare', dropWeight: 2 },
  { slug: 'laos', iso2: 'la', continent: 'asia', nameZh: '老挝', nameEn: 'Laos', capitalZh: '万象', capitalEn: 'Vientiane', loreZh: '有很多瀑布和大象。', loreEn: 'Land of waterfalls and elephants.', rarity: 'epic', dropWeight: 1 },
  { slug: 'myanmar', iso2: 'mm', continent: 'asia', nameZh: '缅甸', nameEn: 'Myanmar', capitalZh: '内比都', capitalEn: 'Naypyidaw', loreZh: '有金色的宝塔。', loreEn: 'Famous for golden pagodas.', rarity: 'rare', dropWeight: 2 },
  { slug: 'malaysia', iso2: 'my', continent: 'asia', nameZh: '马来西亚', nameEn: 'Malaysia', capitalZh: '吉隆坡', capitalEn: 'Kuala Lumpur', loreZh: '有双子塔和雨林。', loreEn: 'Twin towers and rainforests.', rarity: 'rare', dropWeight: 2 },
  { slug: 'singapore', iso2: 'sg', continent: 'asia', nameZh: '新加坡', nameEn: 'Singapore', capitalZh: '新加坡', capitalEn: 'Singapore', loreZh: '小小的花园城市。', loreEn: 'The tiny garden city.', rarity: 'rare', dropWeight: 2 },
  { slug: 'indonesia', iso2: 'id', continent: 'asia', nameZh: '印度尼西亚', nameEn: 'Indonesia', capitalZh: '雅加达', capitalEn: 'Jakarta', loreZh: '一千七百个海岛。', loreEn: 'Made of 17,000 islands!', rarity: 'rare', dropWeight: 2 },
  { slug: 'philippines', iso2: 'ph', continent: 'asia', nameZh: '菲律宾', nameEn: 'Philippines', capitalZh: '马尼拉', capitalEn: 'Manila', loreZh: '由七千多个海岛组成。', loreEn: 'Made of over 7,000 islands!', rarity: 'rare', dropWeight: 2 },
  { slug: 'brunei', iso2: 'bn', continent: 'asia', nameZh: '文莱', nameEn: 'Brunei', capitalZh: '斯里巴加湾市', capitalEn: 'Bandar Seri Begawan', loreZh: '有金顶的大清真寺。', loreEn: 'Famous for a golden-domed mosque.', rarity: 'epic', dropWeight: 1 },
  { slug: 'timor-leste', iso2: 'tl', continent: 'asia', nameZh: '东帝汶', nameEn: 'Timor-Leste', capitalZh: '帝力', capitalEn: 'Dili', loreZh: '美丽的热带小岛国。', loreEn: 'A small tropical island nation.', rarity: 'epic', dropWeight: 1 },
  { slug: 'armenia', iso2: 'am', continent: 'asia', nameZh: '亚美尼亚', nameEn: 'Armenia', capitalZh: '埃里温', capitalEn: 'Yerevan', loreZh: '有很古老的教堂。', loreEn: 'Home to very old churches.', rarity: 'epic', dropWeight: 1 },
  { slug: 'azerbaijan', iso2: 'az', continent: 'asia', nameZh: '阿塞拜疆', nameEn: 'Azerbaijan', capitalZh: '巴库', capitalEn: 'Baku', loreZh: '被称为火焰之国。', loreEn: 'Called the Land of Fire.', rarity: 'epic', dropWeight: 1 },
  { slug: 'georgia', iso2: 'ge', continent: 'asia', nameZh: '格鲁吉亚', nameEn: 'Georgia', capitalZh: '第比利斯', capitalEn: 'Tbilisi', loreZh: '高加索山下的国家。', loreEn: 'Sits below the Caucasus mountains.', rarity: 'epic', dropWeight: 1 },

  // -------------------------------------------------------------- Europe (44)
  { slug: 'uk', iso2: 'gb', continent: 'europe', nameZh: '英国', nameEn: 'United Kingdom', capitalZh: '伦敦', capitalEn: 'London', loreZh: '有红色双层巴士。', loreEn: 'Famous for red double-decker buses.', rarity: 'common', dropWeight: 3 },
  { slug: 'france', iso2: 'fr', continent: 'europe', nameZh: '法国', nameEn: 'France', capitalZh: '巴黎', capitalEn: 'Paris', loreZh: '有埃菲尔铁塔。', loreEn: 'Home of the Eiffel Tower.', rarity: 'common', dropWeight: 3 },
  { slug: 'germany', iso2: 'de', continent: 'europe', nameZh: '德国', nameEn: 'Germany', capitalZh: '柏林', capitalEn: 'Berlin', loreZh: '香肠和面包很有名。', loreEn: 'Famous for sausages and bread.', rarity: 'common', dropWeight: 3 },
  { slug: 'italy', iso2: 'it', continent: 'europe', nameZh: '意大利', nameEn: 'Italy', capitalZh: '罗马', capitalEn: 'Rome', loreZh: '披萨和面条来自这里。', loreEn: 'Birthplace of pizza and pasta.', rarity: 'common', dropWeight: 3 },
  { slug: 'spain', iso2: 'es', continent: 'europe', nameZh: '西班牙', nameEn: 'Spain', capitalZh: '马德里', capitalEn: 'Madrid', loreZh: '弗拉门戈舞很热情。', loreEn: 'Famous for flamenco dancing.', rarity: 'common', dropWeight: 3 },
  { slug: 'russia', iso2: 'ru', continent: 'europe', nameZh: '俄罗斯', nameEn: 'Russia', capitalZh: '莫斯科', capitalEn: 'Moscow', loreZh: '世界上最大的国家。', loreEn: 'The largest country in the world.', rarity: 'common', dropWeight: 3 },
  { slug: 'portugal', iso2: 'pt', continent: 'europe', nameZh: '葡萄牙', nameEn: 'Portugal', capitalZh: '里斯本', capitalEn: 'Lisbon', loreZh: '蛋挞最早从这里来。', loreEn: 'Birthplace of the egg tart.', rarity: 'rare', dropWeight: 2 },
  { slug: 'netherlands', iso2: 'nl', continent: 'europe', nameZh: '荷兰', nameEn: 'Netherlands', capitalZh: '阿姆斯特丹', capitalEn: 'Amsterdam', loreZh: '风车和郁金香很多。', loreEn: 'Famous for windmills and tulips.', rarity: 'rare', dropWeight: 2 },
  { slug: 'belgium', iso2: 'be', continent: 'europe', nameZh: '比利时', nameEn: 'Belgium', capitalZh: '布鲁塞尔', capitalEn: 'Brussels', loreZh: '巧克力和薯条很有名。', loreEn: 'Famous for chocolate and fries.', rarity: 'rare', dropWeight: 2 },
  { slug: 'switzerland', iso2: 'ch', continent: 'europe', nameZh: '瑞士', nameEn: 'Switzerland', capitalZh: '伯尔尼', capitalEn: 'Bern', loreZh: '巧克力和奶酪很美味。', loreEn: 'Famous for chocolate and cheese.', rarity: 'rare', dropWeight: 2 },
  { slug: 'austria', iso2: 'at', continent: 'europe', nameZh: '奥地利', nameEn: 'Austria', capitalZh: '维也纳', capitalEn: 'Vienna', loreZh: '音乐和阿尔卑斯山。', loreEn: 'Land of music and the Alps.', rarity: 'rare', dropWeight: 2 },
  { slug: 'greece', iso2: 'gr', continent: 'europe', nameZh: '希腊', nameEn: 'Greece', capitalZh: '雅典', capitalEn: 'Athens', loreZh: '奥林匹克运动会从这里开始。', loreEn: 'Where the Olympics began.', rarity: 'rare', dropWeight: 2 },
  { slug: 'sweden', iso2: 'se', continent: 'europe', nameZh: '瑞典', nameEn: 'Sweden', capitalZh: '斯德哥尔摩', capitalEn: 'Stockholm', loreZh: '冬天有北极光。', loreEn: 'Northern lights shine in winter.', rarity: 'epic', dropWeight: 1 },
  { slug: 'norway', iso2: 'no', continent: 'europe', nameZh: '挪威', nameEn: 'Norway', capitalZh: '奥斯陆', capitalEn: 'Oslo', loreZh: '有美丽的峡湾。', loreEn: 'Famous for beautiful fjords.', rarity: 'rare', dropWeight: 2 },
  { slug: 'denmark', iso2: 'dk', continent: 'europe', nameZh: '丹麦', nameEn: 'Denmark', capitalZh: '哥本哈根', capitalEn: 'Copenhagen', loreZh: '乐高积木的故乡。', loreEn: 'Birthplace of LEGO bricks!', rarity: 'rare', dropWeight: 2 },
  { slug: 'finland', iso2: 'fi', continent: 'europe', nameZh: '芬兰', nameEn: 'Finland', capitalZh: '赫尔辛基', capitalEn: 'Helsinki', loreZh: '圣诞老人住在这里。', loreEn: 'Home of Santa Claus.', rarity: 'rare', dropWeight: 2 },
  { slug: 'iceland', iso2: 'is', continent: 'europe', nameZh: '冰岛', nameEn: 'Iceland', capitalZh: '雷克雅未克', capitalEn: 'Reykjavik', loreZh: '有火山和温泉。', loreEn: 'Land of volcanoes and hot springs.', rarity: 'epic', dropWeight: 1 },
  { slug: 'ireland', iso2: 'ie', continent: 'europe', nameZh: '爱尔兰', nameEn: 'Ireland', capitalZh: '都柏林', capitalEn: 'Dublin', loreZh: '绿色的翡翠岛。', loreEn: 'The green Emerald Isle.', rarity: 'rare', dropWeight: 2 },
  { slug: 'poland', iso2: 'pl', continent: 'europe', nameZh: '波兰', nameEn: 'Poland', capitalZh: '华沙', capitalEn: 'Warsaw', loreZh: '有很多古老城堡。', loreEn: 'Full of old castles.', rarity: 'rare', dropWeight: 2 },
  { slug: 'czechia', iso2: 'cz', continent: 'europe', nameZh: '捷克', nameEn: 'Czechia', capitalZh: '布拉格', capitalEn: 'Prague', loreZh: '布拉格有童话城堡。', loreEn: 'Prague has fairy-tale castles.', rarity: 'rare', dropWeight: 2 },
  { slug: 'slovakia', iso2: 'sk', continent: 'europe', nameZh: '斯洛伐克', nameEn: 'Slovakia', capitalZh: '布拉迪斯拉发', capitalEn: 'Bratislava', loreZh: '高山和城堡的国家。', loreEn: 'Land of mountains and castles.', rarity: 'epic', dropWeight: 1 },
  { slug: 'hungary', iso2: 'hu', continent: 'europe', nameZh: '匈牙利', nameEn: 'Hungary', capitalZh: '布达佩斯', capitalEn: 'Budapest', loreZh: '有温暖的温泉浴池。', loreEn: 'Famous for warm thermal baths.', rarity: 'rare', dropWeight: 2 },
  { slug: 'romania', iso2: 'ro', continent: 'europe', nameZh: '罗马尼亚', nameEn: 'Romania', capitalZh: '布加勒斯特', capitalEn: 'Bucharest', loreZh: '有传说中的城堡。', loreEn: 'Home of legendary castles.', rarity: 'rare', dropWeight: 2 },
  { slug: 'bulgaria', iso2: 'bg', continent: 'europe', nameZh: '保加利亚', nameEn: 'Bulgaria', capitalZh: '索非亚', capitalEn: 'Sofia', loreZh: '出产玫瑰精油。', loreEn: 'Famous for rose oil.', rarity: 'rare', dropWeight: 2 },
  { slug: 'ukraine', iso2: 'ua', continent: 'europe', nameZh: '乌克兰', nameEn: 'Ukraine', capitalZh: '基辅', capitalEn: 'Kyiv', loreZh: '金色的麦田很广阔。', loreEn: 'Vast golden wheat fields.', rarity: 'rare', dropWeight: 2 },
  { slug: 'belarus', iso2: 'by', continent: 'europe', nameZh: '白俄罗斯', nameEn: 'Belarus', capitalZh: '明斯克', capitalEn: 'Minsk', loreZh: '有大片森林和野牛。', loreEn: 'Forests full of wild bison.', rarity: 'epic', dropWeight: 1 },
  { slug: 'moldova', iso2: 'md', continent: 'europe', nameZh: '摩尔多瓦', nameEn: 'Moldova', capitalZh: '基希讷乌', capitalEn: 'Chișinău', loreZh: '有很长的地下酒窖。', loreEn: 'Famous for huge wine cellars.', rarity: 'epic', dropWeight: 1 },
  { slug: 'lithuania', iso2: 'lt', continent: 'europe', nameZh: '立陶宛', nameEn: 'Lithuania', capitalZh: '维尔纽斯', capitalEn: 'Vilnius', loreZh: '出产金黄的琥珀。', loreEn: 'Famous for golden amber.', rarity: 'epic', dropWeight: 1 },
  { slug: 'latvia', iso2: 'lv', continent: 'europe', nameZh: '拉脱维亚', nameEn: 'Latvia', capitalZh: '里加', capitalEn: 'Riga', loreZh: '森林和海滩很多。', loreEn: 'Full of forests and beaches.', rarity: 'epic', dropWeight: 1 },
  { slug: 'estonia', iso2: 'ee', continent: 'europe', nameZh: '爱沙尼亚', nameEn: 'Estonia', capitalZh: '塔林', capitalEn: 'Tallinn', loreZh: '古老又现代的国家。', loreEn: 'Old towns and new tech.', rarity: 'epic', dropWeight: 1 },
  { slug: 'croatia', iso2: 'hr', continent: 'europe', nameZh: '克罗地亚', nameEn: 'Croatia', capitalZh: '萨格勒布', capitalEn: 'Zagreb', loreZh: '有蓝色的海岸。', loreEn: 'Famous for its blue coast.', rarity: 'rare', dropWeight: 2 },
  { slug: 'slovenia', iso2: 'si', continent: 'europe', nameZh: '斯洛文尼亚', nameEn: 'Slovenia', capitalZh: '卢布尔雅那', capitalEn: 'Ljubljana', loreZh: '有美丽的山中湖。', loreEn: 'Home of a beautiful mountain lake.', rarity: 'epic', dropWeight: 1 },
  { slug: 'serbia', iso2: 'rs', continent: 'europe', nameZh: '塞尔维亚', nameEn: 'Serbia', capitalZh: '贝尔格莱德', capitalEn: 'Belgrade', loreZh: '多瑙河流过这里。', loreEn: 'The Danube river flows through.', rarity: 'rare', dropWeight: 2 },
  { slug: 'bosnia-herzegovina', iso2: 'ba', continent: 'europe', nameZh: '波斯尼亚和黑塞哥维那', nameEn: 'Bosnia and Herzegovina', capitalZh: '萨拉热窝', capitalEn: 'Sarajevo', loreZh: '有古老的石桥。', loreEn: 'Famous for an old stone bridge.', rarity: 'epic', dropWeight: 1 },
  { slug: 'montenegro', iso2: 'me', continent: 'europe', nameZh: '黑山', nameEn: 'Montenegro', capitalZh: '波德戈里察', capitalEn: 'Podgorica', loreZh: '名字意思是黑色的山。', loreEn: 'Its name means "black mountain".', rarity: 'epic', dropWeight: 1 },
  { slug: 'north-macedonia', iso2: 'mk', continent: 'europe', nameZh: '北马其顿', nameEn: 'North Macedonia', capitalZh: '斯科普里', capitalEn: 'Skopje', loreZh: '有一个很古老的湖。', loreEn: 'Home to a very ancient lake.', rarity: 'epic', dropWeight: 1 },
  { slug: 'albania', iso2: 'al', continent: 'europe', nameZh: '阿尔巴尼亚', nameEn: 'Albania', capitalZh: '地拉那', capitalEn: 'Tirana', loreZh: '有很多碉堡和海滩。', loreEn: 'Beaches and many bunkers.', rarity: 'epic', dropWeight: 1 },
  { slug: 'cyprus', iso2: 'cy', continent: 'europe', nameZh: '塞浦路斯', nameEn: 'Cyprus', capitalZh: '尼科西亚', capitalEn: 'Nicosia', loreZh: '阳光明媚的地中海岛。', loreEn: 'A sunny Mediterranean island.', rarity: 'epic', dropWeight: 1 },
  { slug: 'malta', iso2: 'mt', continent: 'europe', nameZh: '马耳他', nameEn: 'Malta', capitalZh: '瓦莱塔', capitalEn: 'Valletta', loreZh: '地中海上的小岛国。', loreEn: 'A tiny island in the sea.', rarity: 'epic', dropWeight: 1 },
  { slug: 'luxembourg', iso2: 'lu', continent: 'europe', nameZh: '卢森堡', nameEn: 'Luxembourg', capitalZh: '卢森堡市', capitalEn: 'Luxembourg City', loreZh: '很小但很富的国家。', loreEn: 'Tiny but very wealthy.', rarity: 'epic', dropWeight: 1 },
  { slug: 'liechtenstein', iso2: 'li', continent: 'europe', nameZh: '列支敦士登', nameEn: 'Liechtenstein', capitalZh: '瓦杜兹', capitalEn: 'Vaduz', loreZh: '山间的小小国家。', loreEn: 'A tiny country in the mountains.', rarity: 'epic', dropWeight: 1 },
  { slug: 'monaco', iso2: 'mc', continent: 'europe', nameZh: '摩纳哥', nameEn: 'Monaco', capitalZh: '摩纳哥', capitalEn: 'Monaco', loreZh: '有赛车比赛的小国。', loreEn: 'Famous for its car races.', rarity: 'epic', dropWeight: 1 },
  { slug: 'andorra', iso2: 'ad', continent: 'europe', nameZh: '安道尔', nameEn: 'Andorra', capitalZh: '安道尔城', capitalEn: 'Andorra la Vella', loreZh: '藏在山里的小国。', loreEn: 'Hidden in the mountains.', rarity: 'epic', dropWeight: 1 },
  { slug: 'san-marino', iso2: 'sm', continent: 'europe', nameZh: '圣马力诺', nameEn: 'San Marino', capitalZh: '圣马力诺', capitalEn: 'San Marino', loreZh: '世界最古老的共和国。', loreEn: "The world's oldest republic.", rarity: 'epic', dropWeight: 1 },

  // -------------------------------------------------------------- Africa (54)
  { slug: 'egypt', iso2: 'eg', continent: 'africa', nameZh: '埃及', nameEn: 'Egypt', capitalZh: '开罗', capitalEn: 'Cairo', loreZh: '有古老的金字塔。', loreEn: 'Home of the ancient pyramids.', rarity: 'rare', dropWeight: 2 },
  { slug: 'south-africa', iso2: 'za', continent: 'africa', nameZh: '南非', nameEn: 'South Africa', capitalZh: '比勒陀利亚', capitalEn: 'Pretoria', loreZh: '可以看到狮子和大象。', loreEn: 'Lions and elephants live here.', rarity: 'rare', dropWeight: 2 },
  { slug: 'nigeria', iso2: 'ng', continent: 'africa', nameZh: '尼日利亚', nameEn: 'Nigeria', capitalZh: '阿布贾', capitalEn: 'Abuja', loreZh: '非洲人口最多的国家。', loreEn: "Africa's most populous country.", rarity: 'rare', dropWeight: 2 },
  { slug: 'kenya', iso2: 'ke', continent: 'africa', nameZh: '肯尼亚', nameEn: 'Kenya', capitalZh: '内罗毕', capitalEn: 'Nairobi', loreZh: '草原上有狮子和长颈鹿。', loreEn: 'Lions and giraffes roam the plains.', rarity: 'rare', dropWeight: 2 },
  { slug: 'ethiopia', iso2: 'et', continent: 'africa', nameZh: '埃塞俄比亚', nameEn: 'Ethiopia', capitalZh: '亚的斯亚贝巴', capitalEn: 'Addis Ababa', loreZh: '咖啡最早的故乡。', loreEn: 'The birthplace of coffee.', rarity: 'rare', dropWeight: 2 },
  { slug: 'ghana', iso2: 'gh', continent: 'africa', nameZh: '加纳', nameEn: 'Ghana', capitalZh: '阿克拉', capitalEn: 'Accra', loreZh: '出产可可做巧克力。', loreEn: 'Grows cocoa for chocolate.', rarity: 'rare', dropWeight: 2 },
  { slug: 'tanzania', iso2: 'tz', continent: 'africa', nameZh: '坦桑尼亚', nameEn: 'Tanzania', capitalZh: '多多马', capitalEn: 'Dodoma', loreZh: '有非洲最高的雪山。', loreEn: "Home of Africa's tallest mountain.", rarity: 'rare', dropWeight: 2 },
  { slug: 'morocco', iso2: 'ma', continent: 'africa', nameZh: '摩洛哥', nameEn: 'Morocco', capitalZh: '拉巴特', capitalEn: 'Rabat', loreZh: '有热闹的集市。', loreEn: 'Famous for busy markets.', rarity: 'rare', dropWeight: 2 },
  { slug: 'algeria', iso2: 'dz', continent: 'africa', nameZh: '阿尔及利亚', nameEn: 'Algeria', capitalZh: '阿尔及尔', capitalEn: 'Algiers', loreZh: '非洲最大的国家。', loreEn: 'The largest country in Africa.', rarity: 'rare', dropWeight: 2 },
  { slug: 'tunisia', iso2: 'tn', continent: 'africa', nameZh: '突尼斯', nameEn: 'Tunisia', capitalZh: '突尼斯', capitalEn: 'Tunis', loreZh: '沙漠边的古老城市。', loreEn: 'Old cities by the desert.', rarity: 'rare', dropWeight: 2 },
  { slug: 'libya', iso2: 'ly', continent: 'africa', nameZh: '利比亚', nameEn: 'Libya', capitalZh: '的黎波里', capitalEn: 'Tripoli', loreZh: '大部分是撒哈拉沙漠。', loreEn: 'Mostly Sahara desert.', rarity: 'epic', dropWeight: 1 },
  { slug: 'sudan', iso2: 'sd', continent: 'africa', nameZh: '苏丹', nameEn: 'Sudan', capitalZh: '喀土穆', capitalEn: 'Khartoum', loreZh: '也有金字塔哦。', loreEn: 'It has pyramids too!', rarity: 'epic', dropWeight: 1 },
  { slug: 'south-sudan', iso2: 'ss', continent: 'africa', nameZh: '南苏丹', nameEn: 'South Sudan', capitalZh: '朱巴', capitalEn: 'Juba', loreZh: '世界最年轻的国家。', loreEn: "The world's youngest country.", rarity: 'epic', dropWeight: 1 },
  { slug: 'uganda', iso2: 'ug', continent: 'africa', nameZh: '乌干达', nameEn: 'Uganda', capitalZh: '坎帕拉', capitalEn: 'Kampala', loreZh: '有山地大猩猩。', loreEn: 'Home to mountain gorillas.', rarity: 'rare', dropWeight: 2 },
  { slug: 'rwanda', iso2: 'rw', continent: 'africa', nameZh: '卢旺达', nameEn: 'Rwanda', capitalZh: '基加利', capitalEn: 'Kigali', loreZh: '被称为千丘之国。', loreEn: 'Land of a thousand hills.', rarity: 'epic', dropWeight: 1 },
  { slug: 'burundi', iso2: 'bi', continent: 'africa', nameZh: '布隆迪', nameEn: 'Burundi', capitalZh: '基特加', capitalEn: 'Gitega', loreZh: '有美丽的大湖。', loreEn: 'Sits by a great lake.', rarity: 'epic', dropWeight: 1 },
  { slug: 'dr-congo', iso2: 'cd', continent: 'africa', nameZh: '刚果民主共和国', nameEn: 'DR Congo', capitalZh: '金沙萨', capitalEn: 'Kinshasa', loreZh: '有大片热带雨林。', loreEn: 'Huge rainforests grow here.', rarity: 'rare', dropWeight: 2 },
  { slug: 'congo', iso2: 'cg', continent: 'africa', nameZh: '刚果共和国', nameEn: 'Congo', capitalZh: '布拉柴维尔', capitalEn: 'Brazzaville', loreZh: '雨林里有很多动物。', loreEn: 'Rainforests full of animals.', rarity: 'epic', dropWeight: 1 },
  { slug: 'cameroon', iso2: 'cm', continent: 'africa', nameZh: '喀麦隆', nameEn: 'Cameroon', capitalZh: '雅温得', capitalEn: 'Yaoundé', loreZh: '被称为小非洲。', loreEn: 'Called "Africa in miniature".', rarity: 'rare', dropWeight: 2 },
  { slug: 'ivory-coast', iso2: 'ci', continent: 'africa', nameZh: '科特迪瓦', nameEn: 'Ivory Coast', capitalZh: '亚穆苏克罗', capitalEn: 'Yamoussoukro', loreZh: '出产很多可可豆。', loreEn: 'Grows lots of cocoa beans.', rarity: 'rare', dropWeight: 2 },
  { slug: 'senegal', iso2: 'sn', continent: 'africa', nameZh: '塞内加尔', nameEn: 'Senegal', capitalZh: '达喀尔', capitalEn: 'Dakar', loreZh: '有粉红色的湖。', loreEn: 'Home of a pink lake.', rarity: 'rare', dropWeight: 2 },
  { slug: 'mali', iso2: 'ml', continent: 'africa', nameZh: '马里', nameEn: 'Mali', capitalZh: '巴马科', capitalEn: 'Bamako', loreZh: '有泥土建的大清真寺。', loreEn: 'Famous for mud-brick mosques.', rarity: 'epic', dropWeight: 1 },
  { slug: 'burkina-faso', iso2: 'bf', continent: 'africa', nameZh: '布基纳法索', nameEn: 'Burkina Faso', capitalZh: '瓦加杜古', capitalEn: 'Ouagadougou', loreZh: '名字意思是正直人之地。', loreEn: 'Means "land of honest people".', rarity: 'epic', dropWeight: 1 },
  { slug: 'niger', iso2: 'ne', continent: 'africa', nameZh: '尼日尔', nameEn: 'Niger', capitalZh: '尼亚美', capitalEn: 'Niamey', loreZh: '有长颈鹿在野外。', loreEn: 'Wild giraffes live here.', rarity: 'epic', dropWeight: 1 },
  { slug: 'chad', iso2: 'td', continent: 'africa', nameZh: '乍得', nameEn: 'Chad', capitalZh: '恩贾梅纳', capitalEn: "N'Djamena", loreZh: '有一个心形的大湖。', loreEn: 'Home of a heart-shaped lake.', rarity: 'epic', dropWeight: 1 },
  { slug: 'mauritania', iso2: 'mr', continent: 'africa', nameZh: '毛里塔尼亚', nameEn: 'Mauritania', capitalZh: '努瓦克肖特', capitalEn: 'Nouakchott', loreZh: '沙漠里有铁路。', loreEn: 'A railway crosses the desert.', rarity: 'epic', dropWeight: 1 },
  { slug: 'somalia', iso2: 'so', continent: 'africa', nameZh: '索马里', nameEn: 'Somalia', capitalZh: '摩加迪沙', capitalEn: 'Mogadishu', loreZh: '海岸线很长。', loreEn: "Has Africa's longest coastline.", rarity: 'epic', dropWeight: 1 },
  { slug: 'djibouti', iso2: 'dj', continent: 'africa', nameZh: '吉布提', nameEn: 'Djibouti', capitalZh: '吉布提市', capitalEn: 'Djibouti City', loreZh: '有彩色的盐湖。', loreEn: 'Home to colorful salt lakes.', rarity: 'epic', dropWeight: 1 },
  { slug: 'eritrea', iso2: 'er', continent: 'africa', nameZh: '厄立特里亚', nameEn: 'Eritrea', capitalZh: '阿斯马拉', capitalEn: 'Asmara', loreZh: '红海边的国家。', loreEn: 'A country by the Red Sea.', rarity: 'epic', dropWeight: 1 },
  { slug: 'angola', iso2: 'ao', continent: 'africa', nameZh: '安哥拉', nameEn: 'Angola', capitalZh: '罗安达', capitalEn: 'Luanda', loreZh: '有大瀑布和野生动物。', loreEn: 'Waterfalls and wildlife.', rarity: 'epic', dropWeight: 1 },
  { slug: 'mozambique', iso2: 'mz', continent: 'africa', nameZh: '莫桑比克', nameEn: 'Mozambique', capitalZh: '马普托', capitalEn: 'Maputo', loreZh: '海里有珊瑚礁。', loreEn: 'Coral reefs in its seas.', rarity: 'epic', dropWeight: 1 },
  { slug: 'zambia', iso2: 'zm', continent: 'africa', nameZh: '赞比亚', nameEn: 'Zambia', capitalZh: '卢萨卡', capitalEn: 'Lusaka', loreZh: '有壮观的维多利亚瀑布。', loreEn: 'Shares the great Victoria Falls.', rarity: 'rare', dropWeight: 2 },
  { slug: 'zimbabwe', iso2: 'zw', continent: 'africa', nameZh: '津巴布韦', nameEn: 'Zimbabwe', capitalZh: '哈拉雷', capitalEn: 'Harare', loreZh: '有古老的石头城。', loreEn: 'Home of an old stone city.', rarity: 'rare', dropWeight: 2 },
  { slug: 'botswana', iso2: 'bw', continent: 'africa', nameZh: '博茨瓦纳', nameEn: 'Botswana', capitalZh: '哈博罗内', capitalEn: 'Gaborone', loreZh: '有很多大象。', loreEn: 'Home to many elephants.', rarity: 'rare', dropWeight: 2 },
  { slug: 'namibia', iso2: 'na', continent: 'africa', nameZh: '纳米比亚', nameEn: 'Namibia', capitalZh: '温得和克', capitalEn: 'Windhoek', loreZh: '有红色的大沙丘。', loreEn: 'Famous for tall red sand dunes.', rarity: 'rare', dropWeight: 2 },
  { slug: 'malawi', iso2: 'mw', continent: 'africa', nameZh: '马拉维', nameEn: 'Malawi', capitalZh: '利隆圭', capitalEn: 'Lilongwe', loreZh: '有清澈的大湖。', loreEn: 'Home of a clear, fish-filled lake.', rarity: 'epic', dropWeight: 1 },
  { slug: 'madagascar', iso2: 'mg', continent: 'africa', nameZh: '马达加斯加', nameEn: 'Madagascar', capitalZh: '塔那那利佛', capitalEn: 'Antananarivo', loreZh: '有可爱的狐猴。', loreEn: 'Home of the lemurs.', rarity: 'rare', dropWeight: 2 },
  { slug: 'mauritius', iso2: 'mu', continent: 'africa', nameZh: '毛里求斯', nameEn: 'Mauritius', capitalZh: '路易港', capitalEn: 'Port Louis', loreZh: '曾是渡渡鸟的家。', loreEn: 'Once home of the dodo bird.', rarity: 'epic', dropWeight: 1 },
  { slug: 'seychelles', iso2: 'sc', continent: 'africa', nameZh: '塞舌尔', nameEn: 'Seychelles', capitalZh: '维多利亚', capitalEn: 'Victoria', loreZh: '有粉白的沙滩。', loreEn: 'Famous for pink-white beaches.', rarity: 'epic', dropWeight: 1 },
  { slug: 'comoros', iso2: 'km', continent: 'africa', nameZh: '科摩罗', nameEn: 'Comoros', capitalZh: '莫罗尼', capitalEn: 'Moroni', loreZh: '香香的香草之岛。', loreEn: 'Islands fragrant with vanilla.', rarity: 'epic', dropWeight: 1 },
  { slug: 'gabon', iso2: 'ga', continent: 'africa', nameZh: '加蓬', nameEn: 'Gabon', capitalZh: '利伯维尔', capitalEn: 'Libreville', loreZh: '雨林里有森林象。', loreEn: 'Forest elephants live here.', rarity: 'epic', dropWeight: 1 },
  { slug: 'equatorial-guinea', iso2: 'gq', continent: 'africa', nameZh: '赤道几内亚', nameEn: 'Equatorial Guinea', capitalZh: '马拉博', capitalEn: 'Malabo', loreZh: '有热带雨林海岛。', loreEn: 'Tropical rainforest islands.', rarity: 'epic', dropWeight: 1 },
  { slug: 'sao-tome-and-principe', iso2: 'st', continent: 'africa', nameZh: '圣多美和普林西比', nameEn: 'São Tomé and Príncipe', capitalZh: '圣多美', capitalEn: 'São Tomé', loreZh: '赤道上的可可岛。', loreEn: 'Cocoa islands on the equator.', rarity: 'epic', dropWeight: 1 },
  { slug: 'central-african-republic', iso2: 'cf', continent: 'africa', nameZh: '中非共和国', nameEn: 'Central African Republic', capitalZh: '班吉', capitalEn: 'Bangui', loreZh: '雨林和大草原。', loreEn: 'Rainforests and savannas.', rarity: 'epic', dropWeight: 1 },
  { slug: 'benin', iso2: 'bj', continent: 'africa', nameZh: '贝宁', nameEn: 'Benin', capitalZh: '波多诺伏', capitalEn: 'Porto-Novo', loreZh: '有水上的村庄。', loreEn: 'Has a village built on water.', rarity: 'epic', dropWeight: 1 },
  { slug: 'togo', iso2: 'tg', continent: 'africa', nameZh: '多哥', nameEn: 'Togo', capitalZh: '洛美', capitalEn: 'Lomé', loreZh: '细长的小国家。', loreEn: 'A long, narrow country.', rarity: 'epic', dropWeight: 1 },
  { slug: 'guinea', iso2: 'gn', continent: 'africa', nameZh: '几内亚', nameEn: 'Guinea', capitalZh: '科纳克里', capitalEn: 'Conakry', loreZh: '有许多大河发源地。', loreEn: 'Where many rivers begin.', rarity: 'epic', dropWeight: 1 },
  { slug: 'guinea-bissau', iso2: 'gw', continent: 'africa', nameZh: '几内亚比绍', nameEn: 'Guinea-Bissau', capitalZh: '比绍', capitalEn: 'Bissau', loreZh: '有很多美丽小岛。', loreEn: 'Dotted with pretty islands.', rarity: 'epic', dropWeight: 1 },
  { slug: 'sierra-leone', iso2: 'sl', continent: 'africa', nameZh: '塞拉利昂', nameEn: 'Sierra Leone', capitalZh: '弗里敦', capitalEn: 'Freetown', loreZh: '有钻石和海滩。', loreEn: 'Famous for diamonds and beaches.', rarity: 'epic', dropWeight: 1 },
  { slug: 'liberia', iso2: 'lr', continent: 'africa', nameZh: '利比里亚', nameEn: 'Liberia', capitalZh: '蒙罗维亚', capitalEn: 'Monrovia', loreZh: '非洲最古老的共和国。', loreEn: "Africa's oldest republic.", rarity: 'epic', dropWeight: 1 },
  { slug: 'gambia', iso2: 'gm', continent: 'africa', nameZh: '冈比亚', nameEn: 'Gambia', capitalZh: '班珠尔', capitalEn: 'Banjul', loreZh: '非洲大陆最小的国家。', loreEn: "Africa's smallest mainland country.", rarity: 'epic', dropWeight: 1 },
  { slug: 'cape-verde', iso2: 'cv', continent: 'africa', nameZh: '佛得角', nameEn: 'Cape Verde', capitalZh: '普拉亚', capitalEn: 'Praia', loreZh: '大西洋上的火山岛。', loreEn: 'Volcanic islands in the Atlantic.', rarity: 'epic', dropWeight: 1 },
  { slug: 'lesotho', iso2: 'ls', continent: 'africa', nameZh: '莱索托', nameEn: 'Lesotho', capitalZh: '马塞卢', capitalEn: 'Maseru', loreZh: '完全在山上的国家。', loreEn: 'A whole country up in the mountains.', rarity: 'epic', dropWeight: 1 },
  { slug: 'eswatini', iso2: 'sz', continent: 'africa', nameZh: '斯威士兰', nameEn: 'Eswatini', capitalZh: '姆巴巴内', capitalEn: 'Mbabane', loreZh: '国王和传统舞蹈。', loreEn: 'Famous for its royal dances.', rarity: 'epic', dropWeight: 1 },

  // ------------------------------------------------------- North America (23)
  { slug: 'usa', iso2: 'us', continent: 'north_america', nameZh: '美国', nameEn: 'United States', capitalZh: '华盛顿', capitalEn: 'Washington, D.C.', loreZh: '有五十颗星星的国旗。', loreEn: 'Its flag has fifty stars.', rarity: 'common', dropWeight: 3 },
  { slug: 'canada', iso2: 'ca', continent: 'north_america', nameZh: '加拿大', nameEn: 'Canada', capitalZh: '渥太华', capitalEn: 'Ottawa', loreZh: '国旗上有一片枫叶。', loreEn: 'A maple leaf on the flag.', rarity: 'common', dropWeight: 3 },
  { slug: 'mexico', iso2: 'mx', continent: 'north_america', nameZh: '墨西哥', nameEn: 'Mexico', capitalZh: '墨西哥城', capitalEn: 'Mexico City', loreZh: '玉米饼和巧克力的故乡。', loreEn: 'Birthplace of tacos and chocolate!', rarity: 'rare', dropWeight: 2 },
  { slug: 'guatemala', iso2: 'gt', continent: 'north_america', nameZh: '危地马拉', nameEn: 'Guatemala', capitalZh: '危地马拉城', capitalEn: 'Guatemala City', loreZh: '有古老的玛雅金字塔。', loreEn: 'Home of ancient Maya pyramids.', rarity: 'rare', dropWeight: 2 },
  { slug: 'belize', iso2: 'bz', continent: 'north_america', nameZh: '伯利兹', nameEn: 'Belize', capitalZh: '贝尔莫潘', capitalEn: 'Belmopan', loreZh: '有大大的珊瑚礁。', loreEn: 'Famous for its big coral reef.', rarity: 'epic', dropWeight: 1 },
  { slug: 'honduras', iso2: 'hn', continent: 'north_america', nameZh: '洪都拉斯', nameEn: 'Honduras', capitalZh: '特古西加尔巴', capitalEn: 'Tegucigalpa', loreZh: '雨林里有玛雅古城。', loreEn: 'Maya ruins in the rainforest.', rarity: 'epic', dropWeight: 1 },
  { slug: 'el-salvador', iso2: 'sv', continent: 'north_america', nameZh: '萨尔瓦多', nameEn: 'El Salvador', capitalZh: '圣萨尔瓦多', capitalEn: 'San Salvador', loreZh: '有很多火山。', loreEn: 'Land of many volcanoes.', rarity: 'epic', dropWeight: 1 },
  { slug: 'nicaragua', iso2: 'ni', continent: 'north_america', nameZh: '尼加拉瓜', nameEn: 'Nicaragua', capitalZh: '马那瓜', capitalEn: 'Managua', loreZh: '有湖中的火山岛。', loreEn: 'Volcano islands in a lake.', rarity: 'epic', dropWeight: 1 },
  { slug: 'costa-rica', iso2: 'cr', continent: 'north_america', nameZh: '哥斯达黎加', nameEn: 'Costa Rica', capitalZh: '圣何塞', capitalEn: 'San José', loreZh: '雨林里有树懒。', loreEn: 'Sloths live in its rainforests.', rarity: 'rare', dropWeight: 2 },
  { slug: 'panama', iso2: 'pa', continent: 'north_america', nameZh: '巴拿马', nameEn: 'Panama', capitalZh: '巴拿马城', capitalEn: 'Panama City', loreZh: '有连接两大洋的运河。', loreEn: 'Famous for its great canal.', rarity: 'rare', dropWeight: 2 },
  { slug: 'cuba', iso2: 'cu', continent: 'north_america', nameZh: '古巴', nameEn: 'Cuba', capitalZh: '哈瓦那', capitalEn: 'Havana', loreZh: '有老爷车和音乐。', loreEn: 'Famous for old cars and music.', rarity: 'rare', dropWeight: 2 },
  { slug: 'jamaica', iso2: 'jm', continent: 'north_america', nameZh: '牙买加', nameEn: 'Jamaica', capitalZh: '金斯敦', capitalEn: 'Kingston', loreZh: '雷鬼音乐的故乡。', loreEn: 'Birthplace of reggae music.', rarity: 'rare', dropWeight: 2 },
  { slug: 'haiti', iso2: 'ht', continent: 'north_america', nameZh: '海地', nameEn: 'Haiti', capitalZh: '太子港', capitalEn: 'Port-au-Prince', loreZh: '加勒比海上的国家。', loreEn: 'A country in the Caribbean.', rarity: 'epic', dropWeight: 1 },
  { slug: 'dominican-republic', iso2: 'do', continent: 'north_america', nameZh: '多米尼加共和国', nameEn: 'Dominican Republic', capitalZh: '圣多明各', capitalEn: 'Santo Domingo', loreZh: '有阳光沙滩。', loreEn: 'Sunny Caribbean beaches.', rarity: 'rare', dropWeight: 2 },
  { slug: 'bahamas', iso2: 'bs', continent: 'north_america', nameZh: '巴哈马', nameEn: 'Bahamas', capitalZh: '拿骚', capitalEn: 'Nassau', loreZh: '有会游泳的小猪。', loreEn: 'Home of swimming pigs!', rarity: 'epic', dropWeight: 1 },
  { slug: 'barbados', iso2: 'bb', continent: 'north_america', nameZh: '巴巴多斯', nameEn: 'Barbados', capitalZh: '布里奇敦', capitalEn: 'Bridgetown', loreZh: '出产甘蔗和糖。', loreEn: 'Famous for sugar cane.', rarity: 'epic', dropWeight: 1 },
  { slug: 'trinidad-and-tobago', iso2: 'tt', continent: 'north_america', nameZh: '特立尼达和多巴哥', nameEn: 'Trinidad and Tobago', capitalZh: '西班牙港', capitalEn: 'Port of Spain', loreZh: '有热闹的狂欢节。', loreEn: 'Famous for its carnival.', rarity: 'epic', dropWeight: 1 },
  { slug: 'grenada', iso2: 'gd', continent: 'north_america', nameZh: '格林纳达', nameEn: 'Grenada', capitalZh: '圣乔治', capitalEn: "St. George's", loreZh: '被称为香料之岛。', loreEn: 'Called the "Spice Island".', rarity: 'epic', dropWeight: 1 },
  { slug: 'saint-lucia', iso2: 'lc', continent: 'north_america', nameZh: '圣卢西亚', nameEn: 'Saint Lucia', capitalZh: '卡斯特里', capitalEn: 'Castries', loreZh: '有两座尖尖的山。', loreEn: 'Famous for two pointy peaks.', rarity: 'epic', dropWeight: 1 },
  { slug: 'saint-vincent-and-the-grenadines', iso2: 'vc', continent: 'north_america', nameZh: '圣文森特和格林纳丁斯', nameEn: 'Saint Vincent and the Grenadines', capitalZh: '金斯敦', capitalEn: 'Kingstown', loreZh: '美丽的加勒比群岛。', loreEn: 'Beautiful Caribbean islands.', rarity: 'epic', dropWeight: 1 },
  { slug: 'antigua-and-barbuda', iso2: 'ag', continent: 'north_america', nameZh: '安提瓜和巴布达', nameEn: 'Antigua and Barbuda', capitalZh: '圣约翰', capitalEn: "Saint John's", loreZh: '有365个沙滩。', loreEn: 'Has 365 beaches, one a day!', rarity: 'epic', dropWeight: 1 },
  { slug: 'dominica', iso2: 'dm', continent: 'north_america', nameZh: '多米尼克', nameEn: 'Dominica', capitalZh: '罗索', capitalEn: 'Roseau', loreZh: '被称为自然之岛。', loreEn: 'Called the "Nature Island".', rarity: 'epic', dropWeight: 1 },
  { slug: 'saint-kitts-and-nevis', iso2: 'kn', continent: 'north_america', nameZh: '圣基茨和尼维斯', nameEn: 'Saint Kitts and Nevis', capitalZh: '巴斯特尔', capitalEn: 'Basseterre', loreZh: '美洲最小的国家。', loreEn: 'The smallest country in the Americas.', rarity: 'epic', dropWeight: 1 },

  // ------------------------------------------------------- South America (12)
  { slug: 'brazil', iso2: 'br', continent: 'south_america', nameZh: '巴西', nameEn: 'Brazil', capitalZh: '巴西利亚', capitalEn: 'Brasília', loreZh: '亚马逊雨林在这里。', loreEn: 'Home of the Amazon rainforest.', rarity: 'common', dropWeight: 3 },
  { slug: 'argentina', iso2: 'ar', continent: 'south_america', nameZh: '阿根廷', nameEn: 'Argentina', capitalZh: '布宜诺斯艾利斯', capitalEn: 'Buenos Aires', loreZh: '探戈舞很有名。', loreEn: 'Famous for the tango dance.', rarity: 'rare', dropWeight: 2 },
  { slug: 'chile', iso2: 'cl', continent: 'south_america', nameZh: '智利', nameEn: 'Chile', capitalZh: '圣地亚哥', capitalEn: 'Santiago', loreZh: '又长又窄的国家。', loreEn: 'A long, thin country.', rarity: 'rare', dropWeight: 2 },
  { slug: 'peru', iso2: 'pe', continent: 'south_america', nameZh: '秘鲁', nameEn: 'Peru', capitalZh: '利马', capitalEn: 'Lima', loreZh: '有马丘比丘古城。', loreEn: 'Home of Machu Picchu.', rarity: 'rare', dropWeight: 2 },
  { slug: 'colombia', iso2: 'co', continent: 'south_america', nameZh: '哥伦比亚', nameEn: 'Colombia', capitalZh: '波哥大', capitalEn: 'Bogotá', loreZh: '出产咖啡和鲜花。', loreEn: 'Famous for coffee and flowers.', rarity: 'rare', dropWeight: 2 },
  { slug: 'venezuela', iso2: 've', continent: 'south_america', nameZh: '委内瑞拉', nameEn: 'Venezuela', capitalZh: '加拉加斯', capitalEn: 'Caracas', loreZh: '有世界最高的瀑布。', loreEn: "Home of the world's tallest waterfall.", rarity: 'rare', dropWeight: 2 },
  { slug: 'ecuador', iso2: 'ec', continent: 'south_america', nameZh: '厄瓜多尔', nameEn: 'Ecuador', capitalZh: '基多', capitalEn: 'Quito', loreZh: '有神奇的加拉帕戈斯群岛。', loreEn: 'Home of the Galápagos Islands.', rarity: 'rare', dropWeight: 2 },
  { slug: 'bolivia', iso2: 'bo', continent: 'south_america', nameZh: '玻利维亚', nameEn: 'Bolivia', capitalZh: '苏克雷', capitalEn: 'Sucre', loreZh: '有白色的盐湖。', loreEn: 'Famous for a giant white salt flat.', rarity: 'rare', dropWeight: 2 },
  { slug: 'paraguay', iso2: 'py', continent: 'south_america', nameZh: '巴拉圭', nameEn: 'Paraguay', capitalZh: '亚松森', capitalEn: 'Asunción', loreZh: '用两种语言的国家。', loreEn: 'Speaks two languages.', rarity: 'epic', dropWeight: 1 },
  { slug: 'uruguay', iso2: 'uy', continent: 'south_america', nameZh: '乌拉圭', nameEn: 'Uruguay', capitalZh: '蒙得维的亚', capitalEn: 'Montevideo', loreZh: '爱踢足球的国家。', loreEn: 'Loves playing football.', rarity: 'rare', dropWeight: 2 },
  { slug: 'guyana', iso2: 'gy', continent: 'south_america', nameZh: '圭亚那', nameEn: 'Guyana', capitalZh: '乔治敦', capitalEn: 'Georgetown', loreZh: '有大瀑布和雨林。', loreEn: 'Big waterfalls and rainforest.', rarity: 'epic', dropWeight: 1 },
  { slug: 'suriname', iso2: 'sr', continent: 'south_america', nameZh: '苏里南', nameEn: 'Suriname', capitalZh: '帕拉马里博', capitalEn: 'Paramaribo', loreZh: '南美最小的国家。', loreEn: "South America's smallest country.", rarity: 'epic', dropWeight: 1 },

  // ------------------------------------------------------------ Oceania (14)
  { slug: 'australia', iso2: 'au', continent: 'oceania', nameZh: '澳大利亚', nameEn: 'Australia', capitalZh: '堪培拉', capitalEn: 'Canberra', loreZh: '袋鼠和考拉的家。', loreEn: 'Home of kangaroos and koalas.', rarity: 'common', dropWeight: 3 },
  { slug: 'new-zealand', iso2: 'nz', continent: 'oceania', nameZh: '新西兰', nameEn: 'New Zealand', capitalZh: '惠灵顿', capitalEn: 'Wellington', loreZh: '有不会飞的几维鸟。', loreEn: 'Home of the flightless kiwi bird.', rarity: 'rare', dropWeight: 2 },
  { slug: 'fiji', iso2: 'fj', continent: 'oceania', nameZh: '斐济', nameEn: 'Fiji', capitalZh: '苏瓦', capitalEn: 'Suva', loreZh: '有几百个热带小岛。', loreEn: 'Hundreds of tropical islands.', rarity: 'rare', dropWeight: 2 },
  { slug: 'papua-new-guinea', iso2: 'pg', continent: 'oceania', nameZh: '巴布亚新几内亚', nameEn: 'Papua New Guinea', capitalZh: '莫尔兹比港', capitalEn: 'Port Moresby', loreZh: '有美丽的天堂鸟。', loreEn: 'Home of birds-of-paradise.', rarity: 'rare', dropWeight: 2 },
  { slug: 'solomon-islands', iso2: 'sb', continent: 'oceania', nameZh: '所罗门群岛', nameEn: 'Solomon Islands', capitalZh: '霍尼亚拉', capitalEn: 'Honiara', loreZh: '太平洋上的群岛。', loreEn: 'Islands in the Pacific.', rarity: 'epic', dropWeight: 1 },
  { slug: 'vanuatu', iso2: 'vu', continent: 'oceania', nameZh: '瓦努阿图', nameEn: 'Vanuatu', capitalZh: '维拉港', capitalEn: 'Port Vila', loreZh: '有活火山的海岛。', loreEn: 'Islands with active volcanoes.', rarity: 'epic', dropWeight: 1 },
  { slug: 'samoa', iso2: 'ws', continent: 'oceania', nameZh: '萨摩亚', nameEn: 'Samoa', capitalZh: '阿皮亚', capitalEn: 'Apia', loreZh: '友好的太平洋岛国。', loreEn: 'Friendly Pacific islands.', rarity: 'epic', dropWeight: 1 },
  { slug: 'tonga', iso2: 'to', continent: 'oceania', nameZh: '汤加', nameEn: 'Tonga', capitalZh: '努库阿洛法', capitalEn: "Nuku'alofa", loreZh: '由很多珊瑚岛组成。', loreEn: 'Made of many coral islands.', rarity: 'epic', dropWeight: 1 },
  { slug: 'kiribati', iso2: 'ki', continent: 'oceania', nameZh: '基里巴斯', nameEn: 'Kiribati', capitalZh: '塔拉瓦', capitalEn: 'Tarawa', loreZh: '跨越赤道的岛国。', loreEn: 'Islands straddling the equator.', rarity: 'epic', dropWeight: 1 },
  { slug: 'micronesia', iso2: 'fm', continent: 'oceania', nameZh: '密克罗尼西亚', nameEn: 'Micronesia', capitalZh: '帕利基尔', capitalEn: 'Palikir', loreZh: '有很多小小的海岛。', loreEn: 'Made of many tiny islands.', rarity: 'epic', dropWeight: 1 },
  { slug: 'marshall-islands', iso2: 'mh', continent: 'oceania', nameZh: '马绍尔群岛', nameEn: 'Marshall Islands', capitalZh: '马朱罗', capitalEn: 'Majuro', loreZh: '有圆环形的珊瑚岛。', loreEn: 'Famous for ring-shaped reefs.', rarity: 'epic', dropWeight: 1 },
  { slug: 'palau', iso2: 'pw', continent: 'oceania', nameZh: '帕劳', nameEn: 'Palau', capitalZh: '恩吉鲁穆德', capitalEn: 'Ngerulmud', loreZh: '有水母湖。', loreEn: 'Home of a jellyfish lake.', rarity: 'epic', dropWeight: 1 },
  { slug: 'nauru', iso2: 'nr', continent: 'oceania', nameZh: '瑙鲁', nameEn: 'Nauru', capitalZh: '亚伦', capitalEn: 'Yaren', loreZh: '世界最小的岛国。', loreEn: "The world's smallest island nation.", rarity: 'epic', dropWeight: 1 },
  { slug: 'tuvalu', iso2: 'tv', continent: 'oceania', nameZh: '图瓦卢', nameEn: 'Tuvalu', capitalZh: '富纳富提', capitalEn: 'Funafuti', loreZh: '很小很低的海岛。', loreEn: 'Tiny, low islands in the sea.', rarity: 'epic', dropWeight: 1 },
];

export const FLAGS: FlagItem[] = RAW_FLAGS.map((f) => ({
  ...f,
  emoji: flagEmojiFromIso2(f.iso2),
}));

export const FLAGS_BY_SLUG: Record<string, FlagItem> = Object.fromEntries(
  FLAGS.map((f) => [f.slug, f]),
);
