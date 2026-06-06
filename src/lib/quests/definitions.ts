export interface QuestContext { bossUnlocked: boolean; }
export interface QuestDef {
  key: string; labelZh: string; labelEn: string; emoji: string;
  target: number; xp: number; feasible: (ctx: QuestContext) => boolean;
}
const always = () => true;
export const QUEST_DEFS: QuestDef[] = [
  { key: 'complete_scenes',   labelZh: '小小探险家', labelEn: 'Explorer',      emoji: '🧭', target: 3, xp: 20, feasible: always },
  { key: 'perfect_scores',    labelZh: '完美之星',   labelEn: 'Perfectionist', emoji: '⭐', target: 2, xp: 20, feasible: always },
  { key: 'spend_coins',       labelZh: '购物达人',   labelEn: 'Shopper',       emoji: '🛒', target: 50, xp: 20, feasible: always },
  { key: 'earn_card',         labelZh: '收藏家',     labelEn: 'Collector',     emoji: '🎴', target: 1, xp: 20, feasible: always },
  { key: 'boss_clear',        labelZh: 'Boss 猎人',  labelEn: 'Boss Hunter',   emoji: '🐙', target: 1, xp: 20, feasible: (c) => c.bossUnlocked },
  { key: 'practice_scenes',   labelZh: '练习生',     labelEn: 'Trainee',       emoji: '✍️', target: 2, xp: 20, feasible: always },
  { key: 'review_flashcards', labelZh: '复习时间',   labelEn: 'Reviewer',      emoji: '🔁', target: 3, xp: 15, feasible: always },
  { key: 'full_level',        labelZh: '大冒险家',   labelEn: 'Adventurer',    emoji: '🏝️', target: 1, xp: 30, feasible: always },
];
export const QUEST_BY_KEY = new Map(QUEST_DEFS.map((q) => [q.key, q]));
export function getQuestDef(key: string): QuestDef | undefined { return QUEST_BY_KEY.get(key); }
