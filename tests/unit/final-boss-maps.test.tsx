import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { FINAL_BOSS_MAP_SLUGS, hasFinalBoss } from '@/lib/scenes/final-boss-maps';
import { getFinalBoss } from '@/lib/scenes/final-boss-roster';
import type { BossAnimState } from '@/components/scenes/fx/bosses/types';

const STATES: BossAnimState[] = ['intro', 'idle', 'damage', 'defeat'];

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

// Every map slug that exists or is held in reserve. A roster entry for a map
// nobody added to the pure list must fail, so probe wider than either.
const ALL_KNOWN_MAPS = [
  'pirate-class-level-1',
  'pirate-class-level-2',
  'pirate-class-level-3',
];

describe('final-boss map list', () => {
  it('matches the roster exactly — no map may have one without the other', () => {
    // The roster holds React components, so a server component cannot import
    // it; that is why the pure slug list exists, and why the two can silently
    // drift. The home board reads the LIST, the scene reads the ROSTER — a map
    // in only one of them either advertises a lair with nothing behind it or
    // hides a boss that exists.
    const inRoster = [...new Set([...ALL_KNOWN_MAPS, ...FINAL_BOSS_MAP_SLUGS])]
      .filter((slug) => getFinalBoss(slug) !== null);
    expect([...FINAL_BOSS_MAP_SLUGS].sort()).toEqual(inRoster.sort());
  });

  it('both shipped maps have an overlord', () => {
    expect(hasFinalBoss('pirate-class-level-1')).toBe(true);
    expect(hasFinalBoss('pirate-class-level-2')).toBe(true);
  });

  it('map 3 is a reserve config with no overlord, so it must not claim one', () => {
    expect(hasFinalBoss('pirate-class-level-3')).toBe(false);
  });

  it('handles a null or unknown slug without throwing', () => {
    expect(hasFinalBoss(null)).toBe(false);
    expect(hasFinalBoss(undefined)).toBe(false);
    expect(hasFinalBoss('not-a-map')).toBe(false);
  });
});

// The weekly BOSS_ROSTER has had a parametrized smoke test since it shipped;
// the FINAL boss roster never did, so GhostGalleon was uncovered too. Same
// shape, so any future overlord is auto-covered the moment it is registered.
describe('final boss creatures (roster smoke)', () => {
  for (const slug of FINAL_BOSS_MAP_SLUGS) {
    const entry = getFinalBoss(slug)!;
    for (const state of STATES) {
      it(`${entry.key} renders state="${state}"`, () => {
        const { getByTestId } = render(<entry.Component state={state} />);
        const el = getByTestId('boss-creature');
        expect(el).toHaveAttribute('data-state', state);
        expect(el).toHaveAttribute('data-creature', entry.key);
      });
    }

    it(`${entry.key} honors reduced motion`, async () => {
      const mod = await import('@/lib/hooks/use-reduced-motion');
      vi.mocked(mod.useReducedMotion).mockReturnValue(true);
      const { getByTestId } = render(<entry.Component state="defeat" />);
      expect(getByTestId('boss-creature')).toHaveAttribute('data-reduced', 'true');
      vi.mocked(mod.useReducedMotion).mockReturnValue(false);
    });

    it(`${entry.key} is named in both languages`, () => {
      expect(entry.nameZh).toBeTruthy();
      expect(entry.nameEn).toBeTruthy();
      expect(entry.nameZh).not.toEqual(entry.nameEn);
    });
  }
});
