import type { ThemeHandlers } from './index';

function bell(ctx: AudioContext, freq: number, startOffset: number, duration: number, peak: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function foghorn(ctx: AudioContext, startOffset: number, duration: number, peak: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 110;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const nauticalTheme: ThemeHandlers = {
  ding(ctx) {
    bell(ctx, 880, 0, 1.2, 0.12);
    bell(ctx, 1320, 0, 1.2, 0.08);
  },
  buzz(ctx) {
    foghorn(ctx, 0, 0.4, 0.1);
  },
  fanfare(ctx) {
    foghorn(ctx, 0, 0.3, 0.08);
    bell(ctx, 660, 0.1, 0.6, 0.1);
    bell(ctx, 990, 0.1, 0.6, 0.1);
    bell(ctx, 1320, 0.1, 0.6, 0.1);
  },
};
