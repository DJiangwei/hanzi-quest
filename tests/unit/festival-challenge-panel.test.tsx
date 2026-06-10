import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/actions/festival', () => ({
  claimFestivalRewardAction: vi.fn(),
}));
vi.mock('@/components/scenes/fx/CardChestReveal', () => ({
  CardChestReveal: () => <div data-testid="card-chest-reveal" />,
}));

import { FestivalChallengePanel } from '@/components/play/FestivalChallengePanel';

const base = {
  childId: 'c1',
  yyyymm: '2026-06',
  nameZh: '端午节',
  nameEn: 'Dragon Boat Festival',
  emoji: '🐲',
  blurbZh: '划龙舟',
  blurbEn: 'Row the boat',
};

describe('FestivalChallengePanel', () => {
  it('renders bilingual festival header + blurb', () => {
    render(
      <FestivalChallengePanel
        {...base}
        activeDays={4}
        threshold={12}
        claimed={false}
        eligible={false}
      />,
    );
    expect(screen.getByText(/端午节/)).toBeInTheDocument();
    expect(screen.getByText(/Dragon Boat Festival/)).toBeInTheDocument();
  });

  it('shows a partial progress bar and a "more days" hint below threshold', () => {
    render(
      <FestivalChallengePanel
        {...base}
        activeDays={3}
        threshold={12}
        claimed={false}
        eligible={false}
      />,
    );
    const fill = screen.getByTestId('festival-progress-fill');
    expect(fill.style.width).toBe('25%'); // 3/12
    expect(screen.getByText(/more day/i)).toBeInTheDocument();
  });

  it('shows the claim button when eligible', () => {
    render(
      <FestivalChallengePanel
        {...base}
        activeDays={12}
        threshold={12}
        claimed={false}
        eligible
      />,
    );
    expect(
      screen.getByRole('button', { name: /领取奖励|Claim reward/i }),
    ).toBeInTheDocument();
  });

  it('shows the claimed state (no button) once claimed', () => {
    render(
      <FestivalChallengePanel
        {...base}
        activeDays={20}
        threshold={12}
        claimed
        eligible={false}
      />,
    );
    expect(screen.getByText(/已领取|Claimed/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
