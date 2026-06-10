import { Solar } from 'lunar-typescript';

export interface LunarInfo {
  /** Chinese lunar day, e.g. 初一 / 十五 / 廿五. */
  dayZh: string;
  /** Chinese lunar month, e.g. 正 / 八. */
  monthZh: string;
  /** A festival or 节气 name worth badging, if any (festival wins over 节气). */
  label: string | null;
  /** Emoji for the badge, if `label` is a known festival / 节气. */
  emoji: string | null;
  /** What `label` is. */
  kind: 'festival' | 'term' | null;
}

/** Kid-relevant festival / 节气 → badge emoji. */
const BADGE_EMOJI: Record<string, string> = {
  // Lunar festivals
  春节: '🧧',
  除夕: '🧨',
  元宵节: '🏮',
  端午节: '🐲',
  七夕: '🐦',
  中秋节: '🌕',
  重阳节: '🌼',
  腊八节: '🥣',
  寒衣节: '🧥',
  中元节: '🪷',
  龙头节: '🐉',
  // Solar / Gregorian festivals
  元旦: '🎆',
  劳动节: '🌷',
  儿童节: '🎈',
  国庆节: '🇨🇳',
  教师节: '📚',
  // 24 节气 (a kid-friendly subset; others fall back to a generic sun)
  立春: '🌱',
  春分: '🌸',
  清明: '🌿',
  谷雨: '🌧️',
  立夏: '🍃',
  夏至: '☀️',
  立秋: '🍂',
  秋分: '🌾',
  立冬: '⛄',
  冬至: '🥟',
  小寒: '❄️',
  大寒: '🧊',
};

/** Generic fallback badge for any other 节气. */
const TERM_FALLBACK = '🌤️';

/**
 * Lunar (农历) info for a Gregorian ISO date (`yyyy-mm-dd`). Pure + deterministic
 * (no network). Festivals take precedence over 节气 for the badge. Compute this
 * server-side and pass plain data to the client grid — `lunar-typescript` should
 * not ship in the client bundle.
 */
export function lunarInfo(iso: string): LunarInfo {
  const [y, m, d] = iso.split('-').map(Number);
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();

  const festivals = [
    ...lunar.getFestivals(),
    ...solar.getFestivals(),
  ].filter(Boolean);
  const jieqi = lunar.getJieQi();

  let label: string | null = null;
  let kind: LunarInfo['kind'] = null;
  let emoji: string | null = null;

  if (festivals.length > 0) {
    label = festivals[0];
    kind = 'festival';
    emoji = BADGE_EMOJI[label] ?? '🎏';
  } else if (jieqi) {
    label = jieqi;
    kind = 'term';
    emoji = BADGE_EMOJI[jieqi] ?? TERM_FALLBACK;
  }

  return {
    dayZh: lunar.getDayInChinese(),
    monthZh: lunar.getMonthInChinese(),
    label,
    emoji,
    kind,
  };
}
