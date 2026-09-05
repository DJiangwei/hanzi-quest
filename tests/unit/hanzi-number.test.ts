// Week numbers are painted in hanzi so that navigating the board re-exposes
// her to 一 … 十, which map 1 teaches in its first weeks.
import { describe, expect, it } from 'vitest';
import { hanziNumber, hanziWeek } from '@/lib/i18n/hanzi-number';

describe('hanziNumber', () => {
  it('covers every week number a map actually has', () => {
    // A voyage map is exactly ten stops (pinned by map-boards.test.ts), so
    // these ten are the entire production range — and all are single glyphs,
    // which is why the medallion never needs to shrink its text.
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(hanziNumber)).toEqual([
      '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    ]);
  });

  it('writes the teens as 十X, never 一十X', () => {
    expect(hanziNumber(11)).toBe('十一');
    expect(hanziNumber(15)).toBe('十五');
    expect(hanziNumber(19)).toBe('十九');
  });

  it('writes round tens and compounds', () => {
    expect(hanziNumber(20)).toBe('二十');
    expect(hanziNumber(21)).toBe('二十一');
    expect(hanziNumber(42)).toBe('四十二');
    expect(hanziNumber(99)).toBe('九十九');
  });

  it('falls back to digits above its range rather than guessing', () => {
    // 一百零五 vs 一百五 is a real trap and nothing in this product exercises
    // it. An honest digit beats a numeral this function got wrong.
    expect(hanziNumber(100)).toBe('100');
    expect(hanziNumber(1.5)).toBe('1.5');
    expect(hanziNumber(-1)).toBe('-1');
  });
});

describe('hanziWeek', () => {
  it('reads as a week, the way she would say it', () => {
    expect(hanziWeek(1)).toBe('第一周');
    expect(hanziWeek(10)).toBe('第十周');
  });
});
