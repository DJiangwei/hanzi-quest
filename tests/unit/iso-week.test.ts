import { describe, expect, it } from 'vitest';
import { mondayOfIsoWeek } from '@/lib/utils/iso-week';

describe('mondayOfIsoWeek', () => {
  it('returns the same date when called with a Monday', () => {
    expect(mondayOfIsoWeek('2026-05-25')).toBe('2026-05-25'); // 2026-05-25 is a Monday
  });

  it('returns the previous Monday for any other day of the week', () => {
    expect(mondayOfIsoWeek('2026-05-26')).toBe('2026-05-25'); // Tuesday
    expect(mondayOfIsoWeek('2026-05-30')).toBe('2026-05-25'); // Saturday
    expect(mondayOfIsoWeek('2026-05-31')).toBe('2026-05-25'); // Sunday (must roll back to Mon, NOT forward)
  });

  it('handles year and month boundaries', () => {
    expect(mondayOfIsoWeek('2026-01-01')).toBe('2025-12-29'); // 2026-01-01 = Thursday
  });
});
