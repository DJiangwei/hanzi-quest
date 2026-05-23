import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

import { TrophyToast } from '@/components/play/TrophyToast';

const trophy = {
  slug: 'first-boss',
  nameZh: '首战告捷',
  nameEn: 'First Voyage',
  emoji: '🐙',
};

describe('TrophyToast', () => {
  it('renders the emoji + bilingual name when trophies array is non-empty', () => {
    render(<TrophyToast trophies={[trophy]} onDone={vi.fn()} />);
    expect(screen.getByText('🐙')).toBeInTheDocument();
    expect(screen.getByText('首战告捷')).toBeInTheDocument();
    expect(screen.getByText('First Voyage')).toBeInTheDocument();
  });

  it('renders nothing when array is empty', () => {
    const { container } = render(<TrophyToast trophies={[]} onDone={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows trophy unlocked label', () => {
    render(<TrophyToast trophies={[trophy]} onDone={vi.fn()} />);
    expect(screen.getByText(/解锁|Unlocked/i)).toBeInTheDocument();
  });
});
