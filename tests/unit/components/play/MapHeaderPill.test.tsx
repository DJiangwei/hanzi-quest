import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapHeaderPill } from '@/components/play/MapHeaderPill';

describe('MapHeaderPill', () => {
  it('renders nameZh + nameEn + Links to /maps', () => {
    render(
      <MapHeaderPill
        childId="child_1"
        currentMap={{ nameZh: '加勒比海', nameEn: 'Caribbean Sea' }}
      />,
    );
    expect(screen.getByText('加勒比海')).toBeInTheDocument();
    expect(screen.getByText(/Caribbean Sea/)).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/play/child_1/maps');
  });

  it('renders nothing when currentMap is null', () => {
    const { container } = render(
      <MapHeaderPill childId="child_1" currentMap={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
