import { describe, expect, it, vi } from 'vitest';

const shared = vi.hoisted(() => ({ ctx: null as unknown, muted: false }));
vi.mock('@/lib/audio/play', () => ({
  getSharedAudio: () => ({ ctx: shared.ctx, muted: shared.muted }),
}));

import { familyForCreature, playBossCue } from '@/lib/audio/boss';

describe('familyForCreature', () => {
  it('maps the 10 roster creatures to their sound families', () => {
    expect(familyForCreature('kraken')).toBe('growl');
    expect(familyForCreature('sea-serpent')).toBe('growl');
    expect(familyForCreature('sea-dragon')).toBe('growl');
    expect(familyForCreature('jelly-swarm')).toBe('bubble');
    expect(familyForCreature('giant-clam')).toBe('bubble');
    expect(familyForCreature('whirlpool')).toBe('bubble');
    expect(familyForCreature('electric-eel')).toBe('zap');
    expect(familyForCreature('anglerfish')).toBe('zap');
    expect(familyForCreature('giant-crab')).toBe('snap');
    expect(familyForCreature('shark')).toBe('snap');
  });

  it('falls back to growl for unknown creatures (future roster additions)', () => {
    expect(familyForCreature('ghost-galleon')).toBe('growl');
  });
});

describe('playBossCue', () => {
  it('no-ops without throwing when the audio context is unavailable', () => {
    shared.ctx = null;
    expect(() => playBossCue('kraken', 'intro')).not.toThrow();
    expect(() => playBossCue('shark', 'damage')).not.toThrow();
    expect(() => playBossCue('whirlpool', 'defeat')).not.toThrow();
  });
});
