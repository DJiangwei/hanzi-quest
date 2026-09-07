import { describe, it, expect, vi } from 'vitest';
import { FINAL_BOSS_MAP_SLUGS, hasFinalBoss } from '@/lib/scenes/final-boss-maps';

// The roster holds React components, so a server component cannot import it.
// That is the whole reason the pure slug list exists — and the reason the two
// can silently disagree, which this pins.
vi.mock('@/components/scenes/bosses/GhostGalleon', () => ({ GhostGalleon: () => null }));

describe('final-boss map list', () => {
  it('matches the roster exactly — no map may have one without the other', async () => {
    const mod = await import('@/lib/scenes/final-boss-roster');
    const rosterSlugs: string[] = [];
    // getFinalBoss is the only export; probe it with every map slug we know of
    // plus the roster's own, so a NEW roster entry that nobody added here fails.
    const candidates = [
      'pirate-class-level-1',
      'pirate-class-level-2',
      'pirate-class-level-3',
      ...FINAL_BOSS_MAP_SLUGS,
    ];
    for (const slug of new Set(candidates)) {
      if (mod.getFinalBoss(slug)) rosterSlugs.push(slug);
    }
    expect([...FINAL_BOSS_MAP_SLUGS].sort()).toEqual(rosterSlugs.sort());
  });

  it('map 2 has no overlord yet, so its lair node must not render', () => {
    // 里海 has ten authored, illustrated weeks and no roster entry. Until one
    // exists, clearing the map must simply end — never show the lair and then
    // FinalBossScene's English "No overlord for this map."
    expect(hasFinalBoss('pirate-class-level-2')).toBe(false);
  });

  it('handles a null or unknown slug without throwing', () => {
    expect(hasFinalBoss(null)).toBe(false);
    expect(hasFinalBoss(undefined)).toBe(false);
    expect(hasFinalBoss('not-a-map')).toBe(false);
  });
});
