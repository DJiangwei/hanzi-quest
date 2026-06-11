import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SurfacePicker } from '@/components/home/SurfacePicker';

describe('SurfacePicker', () => {
  it('shows default + owned surfaces, hides un-owned buyables, bilingual', () => {
    render(
      <SurfacePicker
        ownedSurfaceSlugs={['wall-stars']}
        wallpaperSlug="wall-peach"
        floorSlug="floor-honey"
        onSelect={vi.fn()}
      />,
    );
    // Default wallpaper (free) is listed.
    expect(screen.getByTestId('surface-wall-peach')).toBeInTheDocument();
    // Owned buyable is listed.
    expect(screen.getByTestId('surface-wall-stars')).toBeInTheDocument();
    // Un-owned buyable is NOT listed.
    expect(screen.queryByTestId('surface-wall-mint-stripe')).not.toBeInTheDocument();
    // Bilingual labels render.
    expect(screen.getByText('星空墙')).toBeInTheDocument();
    expect(screen.getByText('Starry Night')).toBeInTheDocument();
  });

  it('marks the equipped surface as selected', () => {
    render(
      <SurfacePicker
        ownedSurfaceSlugs={[]}
        wallpaperSlug="wall-peach"
        floorSlug="floor-honey"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId('surface-wall-peach')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('surface-floor-stone')).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onSelect(kind, slug) when a swatch is tapped', () => {
    const onSelect = vi.fn();
    render(
      <SurfacePicker
        ownedSurfaceSlugs={[]}
        wallpaperSlug="wall-peach"
        floorSlug="floor-honey"
        onSelect={onSelect}
      />,
    );
    screen.getByTestId('surface-floor-seafoam').click();
    expect(onSelect).toHaveBeenCalledWith('floor', 'floor-seafoam');
  });
});
