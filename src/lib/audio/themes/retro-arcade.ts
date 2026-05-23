import type { ThemeHandlers } from './index';

function blip(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  peak: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const retroArcadeTheme: ThemeHandlers = {
  ding(ctx) {
    blip(ctx, 1320, 0, 0.06, 0.1);
    blip(ctx, 1760, 0.06, 0.06, 0.1);
  },
  buzz(ctx) {
    blip(ctx, 200, 0, 0.2, 0.12);
  },
  fanfare(ctx) {
    const seq: Array<[number, number]> = [
      [660, 0],
      [880, 0.1],
      [1110, 0.2],
      [1320, 0.3],
    ];
    for (const [freq, offset] of seq) blip(ctx, freq, offset, 0.1, 0.1);
    blip(ctx, 1760, 0.4, 0.3, 0.1);
  },
};
