// Week numbers rendered as Chinese numerals.
//
// PURE and client-safe. This is a small piece of teaching hidden in the chrome:
// the numbers 一 … 十 are the very first characters map 1 teaches, and the
// voyage board shows a week number on every island, on every visit, all year.
// Painting those in hanzi turns navigation she performs dozens of times a week
// into passive re-exposure at zero cost to the play loop — the same reasoning
// behind A2's stale distractors, applied to the furniture instead of the game.
//
// English keeps its digits. The rule is bilingual chrome, not translated
// chrome: `十周 · 10 weeks` teaches the pairing; `十周 · 十 weeks` teaches
// nothing and reads as a bug.

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;

/**
 * 1 → 一, 10 → 十, 11 → 十一, 20 → 二十, 42 → 四十二.
 *
 * Above 99 it returns the Arabic digits unchanged. No map is remotely near
 * that, and an honest digit beats a numeral this function got wrong — the
 * hundreds rule (一百零五, not 一百五) is a real trap and there is nothing here
 * to test it against.
 */
export function hanziNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (n < 10) return DIGITS[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  // 10-19 are 十, 十一 … 十九 — never 一十.
  const head = tens === 1 ? '十' : `${DIGITS[tens]}十`;
  return ones === 0 ? head : `${head}${DIGITS[ones]}`;
}

/** 3 → 第三周. */
export function hanziWeek(n: number): string {
  return `第${hanziNumber(n)}周`;
}
