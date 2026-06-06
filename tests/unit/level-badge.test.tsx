import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LevelBadge } from '@/components/play/LevelBadge';

describe('LevelBadge', () => {
  it('renders the level number', () => {
    render(<LevelBadge level={5} title={{ zh: '副船长', en: 'First Mate' }} />);
    expect(screen.getByTestId('level-badge')).toHaveTextContent('Lv 5');
  });

  it('renders title.zh', () => {
    render(<LevelBadge level={3} title={{ zh: '水手', en: 'Sailor' }} />);
    expect(screen.getByTestId('level-badge')).toHaveTextContent('水手');
  });

  it('renders level 1 with cabin boy title', () => {
    render(<LevelBadge level={1} title={{ zh: '见习水手', en: 'Cabin Boy' }} />);
    const badge = screen.getByTestId('level-badge');
    expect(badge).toHaveTextContent('Lv 1');
    expect(badge).toHaveTextContent('见习水手');
  });
});
