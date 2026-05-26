import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentlyObtainedStrip } from '@/components/play/RecentlyObtainedStrip';
import type { RecentItem } from '@/lib/db/recent-obtained';

describe('RecentlyObtainedStrip', () => {
  const NOW_MS = Date.parse('2026-05-26T12:00:00Z');

  it('renders nothing when items array is empty', () => {
    const { container } = render(<RecentlyObtainedStrip items={[]} nowMs={NOW_MS} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders items + NEW sticker for items obtained within 24h', () => {
    const items: RecentItem[] = [
      {
        kind: 'collection',
        obtainedAt: new Date(NOW_MS),
        displayEmoji: '🐉',
        nameZh: '龙',
        nameEn: 'Dragon',
        href: '/play/c1/collection/zodiac',
      },
      {
        kind: 'pet',
        obtainedAt: new Date(NOW_MS - 48 * 3600 * 1000),
        displayEmoji: '🦜',
        nameZh: '鹦鹉',
        nameEn: 'Parrot',
        href: '/play/c1/shop?tab=pet',
      },
    ];
    render(<RecentlyObtainedStrip items={items} nowMs={NOW_MS} />);
    expect(screen.getByText('龙')).toBeInTheDocument();
    expect(screen.getByText('Parrot')).toBeInTheDocument();
    const newStickers = screen.getAllByText(/新 NEW/);
    expect(newStickers).toHaveLength(1);
  });

  it('renders Links with the correct href per item', () => {
    const items: RecentItem[] = [
      {
        kind: 'collection',
        obtainedAt: new Date(NOW_MS),
        displayEmoji: '🐉',
        nameZh: '龙',
        nameEn: 'Dragon',
        href: '/play/c1/collection/zodiac',
      },
    ];
    render(<RecentlyObtainedStrip items={items} nowMs={NOW_MS} />);
    const link = screen.getByRole('link', { name: /龙/ });
    expect(link).toHaveAttribute('href', '/play/c1/collection/zodiac');
  });
});
