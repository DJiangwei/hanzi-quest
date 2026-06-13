import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AtlasHub,
  type AtlasHallSummary,
} from '@/components/play/AtlasHub';
import { getPackMeta } from '@/lib/collections/packRegistry';

const zodiacMeta = getPackMeta('zodiac-v1')!;
const flagsMeta = getPackMeta('flags-v1')!;

const halls: AtlasHallSummary[] = [
  {
    packSlug: 'zodiac-v1',
    meta: zodiacMeta,
    ownedCount: 5,
    totalCount: 12,
  },
  {
    packSlug: 'flags-v1',
    meta: flagsMeta,
    ownedCount: 0,
    totalCount: 30,
  },
];

describe('AtlasHub', () => {
  it('renders one hall card per pack (story library hidden 2026-06-13)', () => {
    const { container } = render(<AtlasHub childId="c1" halls={halls} />);
    const list = container.querySelector('[data-testid="atlas-hall-list"]');
    // 2 pack cards, no story-library card.
    expect(list?.children.length).toBe(2);
  });

  it('does NOT render the story-library card (story mode hidden)', () => {
    const { container } = render(<AtlasHub childId="c1" halls={halls} />);
    expect(
      container.querySelector('[data-testid="atlas-hall-story-library"]'),
    ).toBeNull();
  });

  it('renders both Chinese and English display names for each hall', () => {
    render(<AtlasHub childId="c1" halls={halls} />);
    expect(screen.getByText('十二生肖')).toBeInTheDocument();
    expect(screen.getByText('Twelve Zodiac')).toBeInTheDocument();
    expect(screen.getByText('世界国旗')).toBeInTheDocument();
    expect(screen.getByText('World Flags')).toBeInTheDocument();
  });

  it('shows aggregate progress in the lobby header', () => {
    render(<AtlasHub childId="c1" halls={halls} />);
    // 5 + 0 owned, 12 + 30 total
    expect(screen.getByText(/5 \/ 42/)).toBeInTheDocument();
  });

  it('hall card links route to the per-pack page', () => {
    const { container } = render(<AtlasHub childId="c1" halls={halls} />);
    const zodiacLink = container.querySelector('[data-testid="atlas-hall-zodiac-v1"]');
    expect(zodiacLink?.getAttribute('href')).toBe(
      '/play/c1/collection/zodiac-v1',
    );
    const flagsLink = container.querySelector('[data-testid="atlas-hall-flags-v1"]');
    expect(flagsLink?.getAttribute('href')).toBe(
      '/play/c1/collection/flags-v1',
    );
  });

  it('shows the per-pack progress ratio on each card', () => {
    render(<AtlasHub childId="c1" halls={halls} />);
    expect(screen.getByText(/5 \/ 12/)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 30/)).toBeInTheDocument();
  });
});
