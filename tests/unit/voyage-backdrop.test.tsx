import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { VoyageBackdrop } from '@/components/play/VoyageBackdrop';

describe('VoyageBackdrop', () => {
  it('renders the illustrated <img> when an imageUrl is provided', () => {
    const { container } = render(
      <VoyageBackdrop imageUrl="https://blob.example.com/maps/pirate-class-level-1.jpg" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute(
      'src',
      'https://blob.example.com/maps/pirate-class-level-1.jpg',
    );
  });

  it('draws a procedural sea-chart (svg, no img) when no imageUrl', () => {
    const { container } = render(<VoyageBackdrop />);
    expect(container.querySelector('img')).toBeNull();
    // Compass rose / islands / sea-monster are inline SVGs.
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });
});
