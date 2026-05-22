import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Hoist the theme mocks so `play.ts`'s top-level import sees them.
const dingDefault = vi.fn();
const dingNautical = vi.fn();

vi.mock('@/lib/audio/themes', () => ({
  getTheme: (slug: string | null | undefined) => {
    if (slug === 'theme-nautical') {
      return { ding: dingNautical, buzz: vi.fn(), fanfare: vi.fn() };
    }
    return { ding: dingDefault, buzz: vi.fn(), fanfare: vi.fn() };
  },
}));

const audioCtxMock = {
  state: 'running',
  currentTime: 0,
  destination: {},
  createOscillator: vi.fn(() => ({
    type: 'sine',
    frequency: { value: 0 },
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn() }, connect: vi.fn().mockReturnThis() })),
  resume: vi.fn(),
};

// jsdom doesn't have AudioContext.
beforeAll(() => {
  globalThis.AudioContext = function AudioContext() { return audioCtxMock; } as unknown as typeof AudioContext;
});

import { playSound, setAudioMuted, setAudioTheme } from '@/lib/audio/play';

afterEach(() => {
  dingDefault.mockClear();
  dingNautical.mockClear();
  setAudioMuted(false);
  setAudioTheme(null); // reset to default
});

describe('setAudioTheme', () => {
  it('playSound uses default theme handlers when no theme set', () => {
    playSound('ding');
    expect(dingDefault).toHaveBeenCalledTimes(1);
    expect(dingNautical).not.toHaveBeenCalled();
  });

  it('setAudioTheme swaps which handler playSound calls', () => {
    setAudioTheme('theme-nautical');
    playSound('ding');
    expect(dingNautical).toHaveBeenCalledTimes(1);
    expect(dingDefault).not.toHaveBeenCalled();
  });

  it('setAudioTheme(null) reverts to default', () => {
    setAudioTheme('theme-nautical');
    setAudioTheme(null);
    playSound('ding');
    expect(dingDefault).toHaveBeenCalledTimes(1);
    expect(dingNautical).not.toHaveBeenCalled();
  });

  it('muted state suppresses all sounds regardless of theme', () => {
    setAudioTheme('theme-nautical');
    setAudioMuted(true);
    playSound('ding');
    expect(dingDefault).not.toHaveBeenCalled();
    expect(dingNautical).not.toHaveBeenCalled();
  });
});
