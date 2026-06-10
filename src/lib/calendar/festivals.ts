import { FESTIVALS_BY_SLUG } from '@/lib/collections/festivalsData';

export interface FestivalTheme {
  /** Gregorian month 1–12 this theme covers. */
  month: number;
  /** Slug into the `festivals-v1` pack (the reward card). */
  cardSlug: string;
  /** Avatar item `unlockRef` (festival cosmetic) granted alongside the card. */
  avatarItemRef: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  /** Active days required this month to claim the reward. */
  thresholdDays: number;
  blurbZh: string;
  blurbEn: string;
}

/**
 * Fixed Gregorian-month → festival theme for the **monthly challenge**. Kept
 * fixed (not 农历-accurate) so the goal is predictable for a 6yo; the calendar
 * GRID still shows real 农历 festival dates via `lunarInfo`. Card identity
 * (name/emoji) is derived from `festivals-v1` data by slug to stay DRY.
 */
const MONTH_PLAN: { month: number; cardSlug: string; avatarRef: string; threshold: number; blurbZh: string; blurbEn: string }[] = [
  { month: 1, cardSlug: 'newyear', avatarRef: 'festival-newyear', threshold: 12, blurbZh: '新年快乐！坚持学习。', blurbEn: 'Happy New Year! Keep learning.' },
  { month: 2, cardSlug: 'spring-festival', avatarRef: 'festival-spring', threshold: 12, blurbZh: '春节到，多多练习收红包！', blurbEn: 'Spring Festival — practice for your red packet!' },
  { month: 3, cardSlug: 'lantern', avatarRef: 'festival-lantern', threshold: 12, blurbZh: '元宵节，点亮你的花灯。', blurbEn: 'Lantern Festival — light up your lantern.' },
  { month: 4, cardSlug: 'qingming', avatarRef: 'festival-qingming', threshold: 12, blurbZh: '清明踏青，天天学习。', blurbEn: 'Qingming — study every day this spring.' },
  { month: 5, cardSlug: 'start-summer', avatarRef: 'festival-summer', threshold: 12, blurbZh: '立夏啦，像小苗一样成长。', blurbEn: 'Start of Summer — grow like a sprout.' },
  { month: 6, cardSlug: 'dragon-boat', avatarRef: 'festival-dragon', threshold: 12, blurbZh: '端午节，划起学习的龙舟！', blurbEn: 'Dragon Boat Festival — row your learning boat!' },
  { month: 7, cardSlug: 'summer-solstice', avatarRef: 'festival-sun', threshold: 12, blurbZh: '夏至，白天最长，学得最多。', blurbEn: 'Summer Solstice — the longest day to learn.' },
  { month: 8, cardSlug: 'qixi', avatarRef: 'festival-qixi', threshold: 12, blurbZh: '七夕，搭起你的学习鹊桥。', blurbEn: 'Qixi — build your bridge of learning.' },
  { month: 9, cardSlug: 'mid-autumn', avatarRef: 'festival-rabbit', threshold: 12, blurbZh: '中秋团圆，月圆人也圆满。', blurbEn: 'Mid-Autumn — a full moon and a full month.' },
  { month: 10, cardSlug: 'double-ninth', avatarRef: 'festival-chrys', threshold: 12, blurbZh: '重阳登高，越学越高。', blurbEn: 'Double Ninth — climb higher as you learn.' },
  { month: 11, cardSlug: 'start-winter', avatarRef: 'festival-winter', threshold: 12, blurbZh: '立冬了，暖暖地坚持学习。', blurbEn: 'Start of Winter — keep learning, stay warm.' },
  { month: 12, cardSlug: 'winter-solstice', avatarRef: 'festival-dumpling', threshold: 12, blurbZh: '冬至吃饺子，团团圆圆。', blurbEn: 'Winter Solstice — dumplings and reunion.' },
];

export const FESTIVAL_THEMES: Record<number, FestivalTheme> = Object.fromEntries(
  MONTH_PLAN.map((p) => {
    const card = FESTIVALS_BY_SLUG[p.cardSlug];
    if (!card) throw new Error(`festivals.ts: unknown cardSlug ${p.cardSlug}`);
    return [
      p.month,
      {
        month: p.month,
        cardSlug: p.cardSlug,
        avatarItemRef: p.avatarRef,
        nameZh: card.nameZh,
        nameEn: card.nameEn,
        emoji: card.emoji,
        thresholdDays: p.threshold,
        blurbZh: p.blurbZh,
        blurbEn: p.blurbEn,
      },
    ];
  }),
);

/** Theme for a `yyyy-mm` month key. */
export function festivalThemeForMonth(yyyymm: string): FestivalTheme {
  const month = Number(yyyymm.slice(5, 7));
  const theme = FESTIVAL_THEMES[month];
  if (!theme) throw new Error(`festivals.ts: no theme for month ${yyyymm}`);
  return theme;
}
