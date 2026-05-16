// tests/unit/zodiac-card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ZodiacCard } from '@/components/play/ZodiacCard';
import { ZodiacIconDefs } from '@/components/play/zodiac-icons';

describe('ZodiacCard', () => {
  it('renders the hanzi caption and an SVG referencing the slug', () => {
    const { container } = render(
      <>
        <ZodiacIconDefs />
        <ZodiacCard slug="rabbit" owned />
      </>,
    );
    expect(screen.getByText('兔')).toBeInTheDocument();
    expect(container.querySelector('use[href="#z-rabbit"]')).toBeTruthy();
  });

  it('locked variant applies grayscale filter style', () => {
    const { container } = render(
      <>
        <ZodiacIconDefs />
        <ZodiacCard slug="dragon" owned={false} />
      </>,
    );
    const card = container.querySelector('[data-testid="zodiac-card"]');
    expect(card?.getAttribute('data-owned')).toBe('false');
  });

  it('size="lg" applies the large card class', () => {
    const { container } = render(
      <>
        <ZodiacIconDefs />
        <ZodiacCard slug="rat" owned size="lg" />
      </>,
    );
    const card = container.querySelector('[data-testid="zodiac-card"]');
    expect(card?.getAttribute('data-size')).toBe('lg');
  });
});
