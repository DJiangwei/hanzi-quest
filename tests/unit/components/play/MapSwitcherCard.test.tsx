// The way into 航海图 from home. It was a status-shaped pill and the child
// could not find it; the test that matters now is that it NAMES ITS ACTION,
// not that it renders the sea's name (which the old pill already did).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapSwitcherCard } from '@/components/play/MapSwitcherCard';

const caribbean = {
  slug: 'pirate-class-level-1',
  nameZh: '加勒比海',
  nameEn: 'Caribbean Sea',
};

describe('MapSwitcherCard', () => {
  it('renders nameZh + nameEn and links to /maps', () => {
    render(<MapSwitcherCard childId="child_1" currentMap={caribbean} />);
    expect(screen.getByText('加勒比海')).toBeInTheDocument();
    expect(screen.getByText('Caribbean Sea')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/play/child_1/maps');
  });

  it('says what tapping it DOES, in both languages', () => {
    // The old pill read `📍 加勒比海 / Caribbean Sea ⬇` — a fact, shaped like
    // the coin and level pills beside it, which report facts and do nothing.
    // A child cannot discover an action that never names itself.
    render(<MapSwitcherCard childId="child_1" currentMap={caribbean} />);
    expect(screen.getByText('换海域')).toBeInTheDocument();
    expect(screen.getByText('Switch')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAccessibleName(/换海域 \/ Switch sea/);
  });

  it('labels the sea as current, so the name is not mistaken for the action', () => {
    render(<MapSwitcherCard childId="child_1" currentMap={caribbean} />);
    expect(screen.getByText('当前海域')).toBeInTheDocument();
    expect(screen.getByText(/Current sea/)).toBeInTheDocument();
  });

  it('applies the map-specific accent colour (Caspian ≠ default)', () => {
    render(
      <MapSwitcherCard
        childId="child_1"
        currentMap={{ slug: 'pirate-class-level-2', nameZh: '里海', nameEn: 'Caspian Sea' }}
      />,
    );
    // Night-sea indigo (#e2e0f0), not the turquoise default. Map 2 was
    // re-themed from the Indian Ocean on 2026-09-05; the accent moved with it.
    expect(screen.getByRole('link')).toHaveStyle({ backgroundColor: '#e2e0f0' });
  });

  it('renders nothing when currentMap is null', () => {
    const { container } = render(<MapSwitcherCard childId="child_1" currentMap={null} />);
    expect(container.firstChild).toBeNull();
  });
});
