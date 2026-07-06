import { beforeEach, describe, expect, it, vi } from 'vitest';

const ding = vi.fn();
vi.mock('@/lib/audio/themes', () => ({
  getTheme: () => ({ ding, buzz: vi.fn(), fanfare: vi.fn() }),
}));

class FakeCtx {
  state = 'running';
  resume = vi.fn();
}
vi.stubGlobal('AudioContext', FakeCtx as unknown as typeof AudioContext);

import { playSound, resetDingStreak, setAudioMuted, streakPitchMult } from '@/lib/audio/play';

describe('streakPitchMult', () => {
  it('ramps 2 semitones per consecutive correct, capped at +8', () => {
    expect(streakPitchMult(1)).toBeCloseTo(1);
    expect(streakPitchMult(2)).toBeCloseTo(2 ** (2 / 12));
    expect(streakPitchMult(5)).toBeCloseTo(2 ** (8 / 12));
    expect(streakPitchMult(9)).toBeCloseTo(2 ** (8 / 12)); // cap
  });

  it('never goes below 1 for degenerate input', () => {
    expect(streakPitchMult(0)).toBeCloseTo(1);
    expect(streakPitchMult(-3)).toBeCloseTo(1);
  });
});

describe('playSound streak state', () => {
  beforeEach(() => {
    ding.mockClear();
    resetDingStreak();
    setAudioMuted(false);
  });

  it('ding pitch rises with consecutive dings and buzz resets it', () => {
    playSound('ding');
    playSound('ding');
    expect(ding.mock.calls[0][1]).toBeCloseTo(1);
    expect(ding.mock.calls[1][1]).toBeCloseTo(2 ** (2 / 12));
    playSound('buzz');
    playSound('ding');
    expect(ding.mock.calls[2][1]).toBeCloseTo(1);
  });

  it('fanfare also resets the streak', () => {
    playSound('ding');
    playSound('fanfare');
    playSound('ding');
    expect(ding.mock.calls.at(-1)![1]).toBeCloseTo(1);
  });
});
