import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentlyObtainedStrip } from '@/components/play/RecentlyObtainedStrip';
import type { RecentItem } from '@/lib/db/recent-obtained';

const now = Date.now();

function item(overrides: Partial<RecentItem>): RecentItem {
  return {
    kind: 'collection',
    obtainedAt: new Date(now),
    displayEmoji: '🎁',
    nameZh: '测试',
    nameEn: 'Test',
    href: '/play/c1/collection/festivals-v1',
    ...overrides,
  };
}

describe('RecentlyObtainedStrip', () => {
  it('renders an <img> (not raw text) when displayEmoji is a real image URL', () => {
    const url = 'https://blob.example.com/collectibles/abc.jpg';
    const { container } = render(
      <RecentlyObtainedStrip items={[item({ displayEmoji: url })]} nowMs={now} />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', url);
    // The bug: the URL must NOT appear as visible text anywhere.
    expect(screen.queryByText(url)).not.toBeInTheDocument();
  });

  it('renders the emoji glyph as text when displayEmoji is an emoji', () => {
    const { container } = render(
      <RecentlyObtainedStrip items={[item({ displayEmoji: '🐲' })]} nowMs={now} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('🐲')).toBeInTheDocument();
  });
});
