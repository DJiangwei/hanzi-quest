// tests/unit/sounds.test.ts
import { describe, expect, it, vi } from 'vitest';
import { playDing, playBuzz, playFanfare } from '@/lib/audio/sounds';

function makeMockCtx() {
  const oscs: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; frequency: { value: number; setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; type: string }> = [];
  const gains: Array<{ gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> } }> = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: {
          value: 440,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(() => ({ connect: vi.fn() })),
      };
      oscs.push(osc as never);
      return osc;
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(() => ({ connect: vi.fn() })),
      };
      gains.push(gain as never);
      return gain;
    }),
  } as unknown as AudioContext;
  return { ctx, oscs, gains };
}

describe('sounds', () => {
  it('playDing schedules 3 oscillators (arpeggio C5-E5-G5)', () => {
    const { ctx, oscs } = makeMockCtx();
    playDing(ctx);
    expect(oscs).toHaveLength(3);
    expect(oscs.map((o) => o.frequency.value)).toEqual([523, 659, 784]);
    expect(oscs.every((o) => o.type === 'triangle')).toBe(true);
  });

  it('playBuzz schedules 1 sawtooth oscillator', () => {
    const { ctx, oscs } = makeMockCtx();
    playBuzz(ctx);
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe('sawtooth');
  });

  it('playFanfare schedules 6 oscillators', () => {
    const { ctx, oscs } = makeMockCtx();
    playFanfare(ctx);
    expect(oscs).toHaveLength(6);
  });
});
