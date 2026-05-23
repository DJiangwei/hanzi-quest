import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrophyCard } from '@/components/play/TrophyCard';
import type { TrophyRow } from '@/lib/db/trophies';

const trophy = {
  id: 't1',
  slug: 'first-boss',
  emoji: '🐙',
  nameZh: '首战告捷',
  nameEn: 'First Voyage',
  descriptionZh: '第一次打败海怪',
  descriptionEn: 'Defeat your first kraken boss',
  loreZh: '勇敢的小海盗',
  loreEn: 'Brave little pirate',
  category: 'mastery' as const,
} as unknown as TrophyRow;

describe('TrophyCard', () => {
  it('earned: full color, shows lore + date stamp', () => {
    const earnedAt = new Date('2026-05-20T10:00:00Z');
    const { container } = render(
      <TrophyCard trophy={trophy} earned earnedAt={earnedAt} />,
    );
    expect(screen.getByText('🐙')).toBeInTheDocument();
    expect(screen.getByText('首战告捷')).toBeInTheDocument();
    expect(screen.getByText('勇敢的小海盗')).toBeInTheDocument();
    // earned has no grayscale class
    expect(container.firstChild).not.toHaveClass('grayscale');
  });

  it('locked: shows description, hides lore, has grayscale styling', () => {
    const { container } = render(<TrophyCard trophy={trophy} earned={false} />);
    expect(screen.getByText('🐙')).toBeInTheDocument();
    expect(screen.getByText(/第一次打败海怪/)).toBeInTheDocument();
    expect(screen.queryByText('勇敢的小海盗')).not.toBeInTheDocument();
    expect((container.firstChild as HTMLElement).className).toContain('grayscale');
  });
});
