import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrophiesBody } from '@/components/play/TrophiesBody';
import type { TrophyRow } from '@/lib/db/trophies';

const trophies = [
  { id: 't1', slug: 'first-boss', emoji: '🐙', nameZh: '首战告捷', nameEn: 'First Voyage', descriptionZh: 'desc', descriptionEn: 'desc', loreZh: null, loreEn: null, category: 'mastery', displayOrder: 1 },
  { id: 't2', slug: 'streak-7', emoji: '🔥', nameZh: '一周打卡', nameEn: 'Week Streak', descriptionZh: 'desc', descriptionEn: 'desc', loreZh: null, loreEn: null, category: 'streak', displayOrder: 10 },
] as unknown as TrophyRow[];

describe('TrophiesBody', () => {
  it('groups trophies by category and shows earned count per section', () => {
    render(
      <TrophiesBody
        childId="c1"
        trophies={trophies}
        earnedMap={new Map([['t1', new Date()]])}
      />,
    );
    expect(screen.getByText(/首战告捷/)).toBeInTheDocument();
    expect(screen.getByText(/一周打卡/)).toBeInTheDocument();
    // The earned count "1 / 2" appears at the top header
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  });
});
