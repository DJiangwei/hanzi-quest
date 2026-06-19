import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapHeaderPill } from '@/components/play/MapHeaderPill';

describe('MapHeaderPill', () => {
  it('renders nameZh + nameEn + Links to /maps', () => {
    render(
      <MapHeaderPill
        childId="child_1"
        currentMap={{
          slug: 'pirate-class-level-1',
          nameZh: '加勒比海',
          nameEn: 'Caribbean Sea',
        }}
      />,
    );
    expect(screen.getByText('加勒比海')).toBeInTheDocument();
    expect(screen.getByText(/Caribbean Sea/)).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/play/child_1/maps');
  });

  it('applies the map-specific accent colour (Indian Ocean ≠ default)', () => {
    render(
      <MapHeaderPill
        childId="child_1"
        currentMap={{
          slug: 'pirate-class-level-2',
          nameZh: '印度洋',
          nameEn: 'Indian Ocean',
        }}
      />,
    );
    // Warm spice accent bg (#fde4cf), not the turquoise default.
    expect(screen.getByRole('link')).toHaveStyle({ backgroundColor: '#fde4cf' });
  });

  it('renders nothing when currentMap is null', () => {
    const { container } = render(
      <MapHeaderPill childId="child_1" currentMap={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
