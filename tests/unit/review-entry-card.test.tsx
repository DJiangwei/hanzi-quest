import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyReviewCard } from '@/components/play/DailyReviewCard';

describe('DailyReviewCard', () => {
  it('links to the review route when there is enough to review', () => {
    render(<DailyReviewCard childId="c1" available />);
    expect(screen.getByTestId('daily-review-card')).toHaveAttribute(
      'href',
      '/play/c1/review',
    );
  });

  it('renders NOTHING when she has too little cleared material', () => {
    // A brand-new child, or one who has cleared no week. An entry point to an
    // empty session is worse than no entry point.
    const { container } = render(<DailyReviewCard childId="c1" available={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is bilingual', () => {
    render(<DailyReviewCard childId="c1" available />);
    const card = screen.getByTestId('daily-review-card');
    expect(card.textContent).toMatch(/温故/);
    expect(card.textContent).toMatch(/Review/i);
  });

  it('never frames the session as a test or a streak', () => {
    // 温故 gates nothing and must not acquire pressure. This product exists
    // partly to soften 畏难情绪 — a "don't break the chain" counter here would
    // re-add exactly what boss_courage and T3's reward-preview removed.
    render(<DailyReviewCard childId="c1" available />);
    const text = screen.getByTestId('daily-review-card').textContent ?? '';
    expect(text).not.toMatch(/连续|streak|考|test|day [0-9]/i);
  });
});
