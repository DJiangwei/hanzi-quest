import { describe, expect, it } from 'vitest';
import { lunarInfo } from '@/lib/calendar/lunar';

describe('lunarInfo', () => {
  it('marks Spring Festival (2026-02-17 = 农历正月初一)', () => {
    const info = lunarInfo('2026-02-17');
    expect(info.dayZh).toBe('初一');
    expect(info.label).toBe('春节');
    expect(info.kind).toBe('festival');
    expect(info.emoji).toBe('🧧');
  });

  it('marks Mid-Autumn (2026-09-25 = 农历八月十五)', () => {
    const info = lunarInfo('2026-09-25');
    expect(info.label).toBe('中秋节');
    expect(info.emoji).toBe('🌕');
  });

  it('marks Dragon Boat (2026-06-19 = 农历五月初五)', () => {
    const info = lunarInfo('2026-06-19');
    expect(info.label).toBe('端午节');
    expect(info.kind).toBe('festival');
  });

  it('marks a 节气 (2026-04-05 = 清明) as a term, not a festival', () => {
    const info = lunarInfo('2026-04-05');
    expect(info.label).toBe('清明');
    expect(info.kind).toBe('term');
    expect(info.emoji).toBe('🌿');
  });

  it('returns lunar day with no badge on an ordinary day', () => {
    const info = lunarInfo('2026-06-10');
    expect(info.dayZh).toBeTruthy();
    expect(info.label).toBeNull();
    expect(info.emoji).toBeNull();
    expect(info.kind).toBeNull();
  });
});
