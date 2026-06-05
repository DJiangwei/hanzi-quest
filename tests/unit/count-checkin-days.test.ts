import { describe, expect, it } from 'vitest';
import { countCheckInDays, WEEKLY_CHECKIN_THRESHOLD } from '@/lib/db/checkins';
import type { ActivityDay } from '@/lib/db/activity';

function day(dateIso: string, dailyLoginBonus: boolean): ActivityDay {
  return { dateIso, played: dailyLoginBonus, dailyLoginBonus, freezeBurned: false, coinsEarned: 0 };
}

describe('countCheckInDays', () => {
  it('threshold is 5', () => {
    expect(WEEKLY_CHECKIN_THRESHOLD).toBe(5);
  });
  it('counts only days with a daily-login bonus', () => {
    const week = [day('2026-06-01', true), day('2026-06-02', true), day('2026-06-03', false), day('2026-06-04', true)];
    expect(countCheckInDays(week)).toBe(3);
  });
});
