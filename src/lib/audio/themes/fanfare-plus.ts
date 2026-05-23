import { playBuzz, playDing } from '../sounds';
import type { ThemeHandlers } from './index';

export const fanfarePlusTheme: ThemeHandlers = {
  ding: playDing,
  buzz: playBuzz,
  fanfare(ctx) {
    const arpeggio: Array<[number, number]> = [
      [660, 0],
      [880, 0.2],
      [1100, 0.4],
      [1320, 0.6],
    ];
    for (const [freq, offset] of arpeggio) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.18, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.22);
    }
    for (const freq of [660, 880, 1100]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + 0.8;
      gain.gain.setValueAtTime(0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.82);
    }
  },
};
