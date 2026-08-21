/** 奥运会 / Olympics collectible pack (`olympics-v1`). Bilingual; grouped
 *  水上/球类/力量格斗/竞速技巧. Summer disciplines — the vocabulary is the point,
 *  not any one host city's programme. Emoji is the CardArt fallback; real flux
 *  art lives in image_url. */
export type OlympicGroup = 'water' | 'ball' | 'combat' | 'skill';

export interface OlympicItem {
  slug: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  group: OlympicGroup;
  loreZh: string;
  loreEn: string;
}

export const OLYMPIC_GROUP_ORDER: OlympicGroup[] = ['water', 'ball', 'combat', 'skill'];

export const OLYMPIC_GROUP_LABELS: Record<OlympicGroup, { zh: string; en: string; emoji: string }> = {
  water: { zh: '水上', en: 'Water', emoji: '🌊' },
  ball: { zh: '球类', en: 'Ball', emoji: '⚽' },
  combat: { zh: '力量格斗', en: 'Strength & Combat', emoji: '🥋' },
  skill: { zh: '竞速技巧', en: 'Speed & Skill', emoji: '🏃' },
};

export const OLYMPIC_SPORTS: OlympicItem[] = [
  { slug: 'swimming', nameZh: '游泳', nameEn: 'Swimming', emoji: '🏊', group: 'water', loreZh: '在水里划呀划，游得最快的赢。', loreEn: 'Race through the water — the fastest swimmer wins.' },
  { slug: 'diving', nameZh: '跳水', nameEn: 'Diving', emoji: '🤿', group: 'water', loreZh: '从高台跳下去，水花越小越好。', loreEn: 'Leap from the high board — the smaller the splash, the better.' },
  { slug: 'kayaking', nameZh: '皮划艇', nameEn: 'Kayaking', emoji: '🛶', group: 'water', loreZh: '用桨划开水面，一路向前。', loreEn: 'Paddle hard and cut through the water.' },
  { slug: 'football', nameZh: '足球', nameEn: 'Football', emoji: '⚽', group: 'ball', loreZh: '用脚把球踢进球门。', loreEn: 'Kick the ball into the goal.' },
  { slug: 'basketball', nameZh: '篮球', nameEn: 'Basketball', emoji: '🏀', group: 'ball', loreZh: '把球投进高高的篮筐。', loreEn: 'Throw the ball through the high hoop.' },
  { slug: 'table-tennis', nameZh: '乒乓球', nameEn: 'Table tennis', emoji: '🏓', group: 'ball', loreZh: '小小的球，飞得特别快。', loreEn: 'A tiny ball that flies very fast.' },
  { slug: 'badminton', nameZh: '羽毛球', nameEn: 'Badminton', emoji: '🏸', group: 'ball', loreZh: '羽毛球轻轻的，会在空中飘。', loreEn: 'The shuttlecock floats through the air.' },
  { slug: 'volleyball', nameZh: '排球', nameEn: 'Volleyball', emoji: '🏐', group: 'ball', loreZh: '球不能落地，大家一起托。', loreEn: 'Keep the ball off the floor — together.' },
  { slug: 'tennis', nameZh: '网球', nameEn: 'Tennis', emoji: '🎾', group: 'ball', loreZh: '隔着球网你来我往。', loreEn: 'Back and forth across the net.' },
  { slug: 'fencing', nameZh: '击剑', nameEn: 'Fencing', emoji: '🤺', group: 'combat', loreZh: '穿上白衣服，用剑轻轻一点。', loreEn: 'In white armour, a quick touch of the blade.' },
  { slug: 'judo', nameZh: '柔道', nameEn: 'Judo', emoji: '🥋', group: 'combat', loreZh: '借力打力，把对手轻轻放倒。', loreEn: 'Use their own strength to take them down.' },
  { slug: 'boxing', nameZh: '拳击', nameEn: 'Boxing', emoji: '🥊', group: 'combat', loreZh: '戴上大手套，出拳又快又准。', loreEn: 'Big gloves, fast and accurate punches.' },
  { slug: 'weightlifting', nameZh: '举重', nameEn: 'Weightlifting', emoji: '🏋️', group: 'combat', loreZh: '把很重很重的杠铃举过头顶。', loreEn: 'Lift the heavy bar right over your head.' },
  { slug: 'running', nameZh: '跑步', nameEn: 'Running', emoji: '🏃', group: 'skill', loreZh: '谁先冲过终点线谁就赢。', loreEn: 'First across the line wins.' },
  { slug: 'gymnastics', nameZh: '体操', nameEn: 'Gymnastics', emoji: '🤸', group: 'skill', loreZh: '翻跟头、转圈圈，稳稳落地。', loreEn: 'Flip, spin, and land steady.' },
  { slug: 'archery', nameZh: '射箭', nameEn: 'Archery', emoji: '🏹', group: 'skill', loreZh: '拉满弓，瞄准红心。', loreEn: 'Draw the bow and aim for the bullseye.' },
  { slug: 'cycling', nameZh: '自行车', nameEn: 'Cycling', emoji: '🚴', group: 'skill', loreZh: '蹬得越快，车跑得越远。', loreEn: 'The harder you pedal, the further you fly.' },
  { slug: 'equestrian', nameZh: '马术', nameEn: 'Equestrian', emoji: '🏇', group: 'skill', loreZh: '和马儿一起跳过栏杆。', loreEn: 'Jump the fences together with your horse.' },
  { slug: 'skateboarding', nameZh: '滑板', nameEn: 'Skateboarding', emoji: '🛹', group: 'skill', loreZh: '踩着滑板飞起来。', loreEn: 'Fly into the air on your board.' },
  { slug: 'climbing', nameZh: '攀岩', nameEn: 'Climbing', emoji: '🧗', group: 'skill', loreZh: '手脚并用，爬到最高的地方。', loreEn: 'Hands and feet — climb right to the top.' },
];

export const OLYMPICS_BY_SLUG: Record<string, OlympicItem> = Object.fromEntries(
  OLYMPIC_SPORTS.map((s) => [s.slug, s]),
);
