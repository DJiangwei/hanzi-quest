// tests/unit/treasure-map-backdrop.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TreasureMapBackdrop } from '@/components/ui/TreasureMapBackdrop';

describe('TreasureMapBackdrop', () => {
  it('renders children', () => {
    render(
      <TreasureMapBackdrop>
        <p>hi</p>
      </TreasureMapBackdrop>,
    );
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('includes compass + route SVG when intensity=medium (default)', () => {
    const { container } = render(<TreasureMapBackdrop><p /></TreasureMapBackdrop>);
    expect(container.querySelector('[data-testid="map-compass"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="map-route"]')).toBeTruthy();
  });

  it('omits compass + route when intensity=subtle', () => {
    const { container } = render(
      <TreasureMapBackdrop intensity="subtle"><p /></TreasureMapBackdrop>,
    );
    expect(container.querySelector('[data-testid="map-compass"]')).toBeNull();
    expect(container.querySelector('[data-testid="map-route"]')).toBeNull();
  });
});
