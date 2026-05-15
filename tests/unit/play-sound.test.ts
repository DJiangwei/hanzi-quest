// tests/unit/play-sound.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/audio/sounds', () => ({
  playDing: vi.fn(),
  playBuzz: vi.fn(),
  playFanfare: vi.fn(),
}));

describe('playSound', () => {
  let ctorCalls = 0;

  beforeEach(async () => {
    vi.resetModules();
    ctorCalls = 0;
    class FakeCtx {
      currentTime = 0;
      state = 'running' as AudioContextState;
      destination = {};
      constructor() {
        ctorCalls++;
      }
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      createOscillator() {
        return { type: 'sine', frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, start: vi.fn(), stop: vi.fn(), connect: () => ({ connect: () => undefined }) };
      }
      createGain() {
        return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: () => ({ connect: () => undefined }) };
      }
    }
    vi.stubGlobal('window', {
      AudioContext: FakeCtx,
    });
    vi.stubGlobal('AudioContext', FakeCtx);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('no-ops when called before muted=false set', async () => {
    const { playSound } = await import('@/lib/audio/play');
    const { playDing } = await import('@/lib/audio/sounds');
    playSound('ding');
    expect(playDing).toHaveBeenCalledTimes(1);
    expect(ctorCalls).toBe(1);
  });

  it('no-ops when muted=true', async () => {
    const { playSound, setAudioMuted } = await import('@/lib/audio/play');
    const { playDing } = await import('@/lib/audio/sounds');
    setAudioMuted(true);
    playSound('ding');
    expect(playDing).not.toHaveBeenCalled();
    expect(ctorCalls).toBe(0);
  });

  it('routes to the right generator', async () => {
    const { playSound } = await import('@/lib/audio/play');
    const { playDing, playBuzz, playFanfare } = await import('@/lib/audio/sounds');
    playSound('ding');
    playSound('buzz');
    playSound('fanfare');
    expect(playDing).toHaveBeenCalledTimes(1);
    expect(playBuzz).toHaveBeenCalledTimes(1);
    expect(playFanfare).toHaveBeenCalledTimes(1);
  });

  it('creates AudioContext only once across multiple calls', async () => {
    const { playSound } = await import('@/lib/audio/play');
    playSound('ding');
    playSound('buzz');
    playSound('fanfare');
    expect(ctorCalls).toBe(1);
  });
});
