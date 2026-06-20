/** 交通工具 / Transport collectible pack (`transport-v1`). Bilingual; grouped
 *  陆地/水上/天空. Emoji is the CardArt fallback; real flux art lives in image_url. */
export type TransportGroup = 'land' | 'water' | 'air';

export interface TransportItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  group: TransportGroup;
  loreZh: string;
  loreEn: string;
}

export const TRANSPORT_GROUP_ORDER: TransportGroup[] = ['land', 'water', 'air'];
export const TRANSPORT_GROUP_LABELS: Record<TransportGroup, { zh: string; en: string; emoji: string }> = {
  land: { zh: '陆地', en: 'Land', emoji: '🛣️' },
  water: { zh: '水上', en: 'Water', emoji: '🌊' },
  air: { zh: '天空', en: 'Air', emoji: '☁️' },
};

export const TRANSPORT: TransportItem[] = [
  { slug: 'car', nameZh: '汽车', nameEn: 'Car', emoji: '🚗', group: 'land', loreZh: '四个轮子，带我们去任何地方。', loreEn: 'Four wheels that take us anywhere.' },
  { slug: 'bus', nameZh: '公共汽车', nameEn: 'Bus', emoji: '🚌', group: 'land', loreZh: '一次能载很多人。', loreEn: 'Carries lots of people at once.' },
  { slug: 'train', nameZh: '火车', nameEn: 'Train', emoji: '🚆', group: 'land', loreZh: '在铁轨上轰隆隆地跑。', loreEn: 'Rumbles along on rails.' },
  { slug: 'bicycle', nameZh: '自行车', nameEn: 'Bicycle', emoji: '🚲', group: 'land', loreZh: '踩起脚踏板就能前进。', loreEn: 'Pedal and away you go.' },
  { slug: 'motorbike', nameZh: '摩托车', nameEn: 'Motorbike', emoji: '🏍️', group: 'land', loreZh: '两个轮子，跑得飞快。', loreEn: 'Two wheels and very fast.' },
  { slug: 'fire-engine', nameZh: '消防车', nameEn: 'Fire engine', emoji: '🚒', group: 'land', loreZh: '红色的车，去救火！', loreEn: 'The red truck that fights fires!' },
  { slug: 'ambulance', nameZh: '救护车', nameEn: 'Ambulance', emoji: '🚑', group: 'land', loreZh: '快快送病人去医院。', loreEn: 'Rushes people to hospital.' },
  { slug: 'police-car', nameZh: '警车', nameEn: 'Police car', emoji: '🚓', group: 'land', loreZh: '警察叔叔开的车。', loreEn: 'The car the police drive.' },
  { slug: 'truck', nameZh: '卡车', nameEn: 'Truck', emoji: '🚚', group: 'land', loreZh: '运送很重的东西。', loreEn: 'Carries heavy loads.' },
  { slug: 'ship', nameZh: '轮船', nameEn: 'Ship', emoji: '🚢', group: 'water', loreZh: '在大海上航行。', loreEn: 'Sails across the sea.' },
  { slug: 'sailboat', nameZh: '帆船', nameEn: 'Sailboat', emoji: '⛵', group: 'water', loreZh: '靠风吹着帆前进。', loreEn: 'The wind pushes its sail.' },
  { slug: 'airplane', nameZh: '飞机', nameEn: 'Airplane', emoji: '✈️', group: 'air', loreZh: '在云朵上面飞。', loreEn: 'Flies above the clouds.' },
  { slug: 'helicopter', nameZh: '直升机', nameEn: 'Helicopter', emoji: '🚁', group: 'air', loreZh: '头顶的螺旋桨转呀转。', loreEn: 'Its top blades spin round and round.' },
  { slug: 'hot-air-balloon', nameZh: '热气球', nameEn: 'Hot-air balloon', emoji: '🎈', group: 'air', loreZh: '热空气让它飘起来。', loreEn: 'Hot air lifts it into the sky.' },
];

export const TRANSPORT_BY_SLUG: Record<string, TransportItem> = Object.fromEntries(
  TRANSPORT.map((t) => [t.slug, t]),
);
