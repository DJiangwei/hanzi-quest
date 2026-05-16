// tests/unit/zodiac-icons.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ZODIAC_SLUGS, ZodiacIconDefs } from '@/components/play/zodiac-icons';

describe('ZodiacIconDefs', () => {
  it('renders 12 <symbol> elements with id="z-{slug}"', () => {
    const { container } = render(<ZodiacIconDefs />);
    const symbols = container.querySelectorAll('symbol');
    expect(symbols).toHaveLength(12);
    for (const slug of ZODIAC_SLUGS) {
      expect(container.querySelector(`#z-${slug}`)).toBeTruthy();
    }
  });

  it('the defs SVG is visually hidden but DOM-present', () => {
    const { container } = render(<ZodiacIconDefs />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('width')).toBe('0');
    expect(svg?.getAttribute('height')).toBe('0');
  });
});

describe('ZODIAC_SLUGS', () => {
  it('exports 12 ordered slugs starting with rat and ending with pig', () => {
    expect(ZODIAC_SLUGS).toHaveLength(12);
    expect(ZODIAC_SLUGS[0]).toBe('rat');
    expect(ZODIAC_SLUGS[11]).toBe('pig');
  });
});
