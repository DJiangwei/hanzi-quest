import { describe, expect, it, vi } from 'vitest';
import {
  THEME_REGISTRY,
  THEME_SLUGS,
  getTheme,
  type ThemeSlug,
} from '@/lib/audio/themes';

function makeMockContext() {
  const oscNodes: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscNodes.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
    })),
  };
  return { ctx: ctx as unknown as AudioContext, oscNodes };
}

describe('audio themes', () => {
  it('registry contains the 5 expected slugs', () => {
    expect(THEME_SLUGS).toEqual([
      'default',
      'theme-music-box',
      'theme-retro-arcade',
      'theme-nautical',
      'theme-fanfare-plus',
    ]);
    for (const slug of THEME_SLUGS) {
      expect(THEME_REGISTRY[slug]).toBeDefined();
      expect(typeof THEME_REGISTRY[slug].ding).toBe('function');
      expect(typeof THEME_REGISTRY[slug].buzz).toBe('function');
      expect(typeof THEME_REGISTRY[slug].fanfare).toBe('function');
    }
  });

  it('getTheme returns the named theme', () => {
    expect(getTheme('theme-nautical')).toBe(THEME_REGISTRY['theme-nautical']);
  });

  it('getTheme falls back to default for unknown / null / undefined slugs', () => {
    expect(getTheme('not-a-theme' as ThemeSlug)).toBe(THEME_REGISTRY.default);
    expect(getTheme(null)).toBe(THEME_REGISTRY.default);
    expect(getTheme(undefined)).toBe(THEME_REGISTRY.default);
  });

  it.each(['default', 'theme-music-box', 'theme-retro-arcade', 'theme-nautical', 'theme-fanfare-plus'] as const)(
    '%s handlers schedule at least one oscillator without throwing (ding/buzz/fanfare)',
    (slug) => {
      const theme = THEME_REGISTRY[slug];
      for (const evt of ['ding', 'buzz', 'fanfare'] as const) {
        const { ctx, oscNodes } = makeMockContext();
        expect(() => theme[evt](ctx)).not.toThrow();
        expect(oscNodes.length).toBeGreaterThan(0);
      }
    },
  );
});
