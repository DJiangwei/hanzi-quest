import type { ThemeHandlers } from './index';

function bellTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  peak: number,
) {
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

export const musicBoxTheme: ThemeHandlers = {
  ding(ctx) {
    bellTone(ctx, 1200, 0, 0.8, 0.12);
    bellTone(ctx, 1800, 0, 0.8, 0.08);
  },
  buzz(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.24);
  },
  fanfare(ctx) {
    const seq: Array<[number, number]> = [
      [800, 0],
      [1200, 0.15],
      [1600, 0.3],
    ];
    for (const [freq, offset] of seq) bellTone(ctx, freq, offset, 0.6, 0.1);
    for (const [freq, offset] of seq) bellTone(ctx, freq, offset + 0.4, 0.4, 0.05);
  },
};
