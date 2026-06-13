import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeasonCard } from '@/components/play/items/SeasonCard';
import { getPackMeta } from '@/lib/collections/packRegistry';

const item = {
  id: 'i1',
  slug: 'season-tortoise',
  nameZh: '海龟船长',
  nameEn: 'Captain Tortoise',
  loreZh: 'x',
  loreEn: 'y',
  imageUrl: null,
} as never;

describe('SeasonCard', () => {
  it('renders bilingual name; locked when unowned', () => {
    render(<SeasonCard item={item} owned={false} />);
    expect(screen.getByText('海龟船长')).toBeInTheDocument();
    expect(screen.getByText('Captain Tortoise')).toBeInTheDocument();
  });

  it('shows lore at lg when owned', () => {
    render(<SeasonCard item={item} owned size="lg" />);
    expect(screen.getByText('x')).toBeInTheDocument();
  });
});

describe('season pack registry', () => {
  it('registers season-summer-v1 as reward-only with a reveal emoji', () => {
    const meta = getPackMeta('season-summer-v1');
    expect(meta).not.toBeNull();
    expect(meta?.paidPullCost).toBe(0);
    expect(meta?.resolveRevealEmoji?.('season-tortoise')).toBe('🐢');
  });
});
