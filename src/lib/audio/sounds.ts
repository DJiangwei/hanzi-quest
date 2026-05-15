// src/lib/audio/sounds.ts

function scheduleNote(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType,
  peak: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Three-tone triangle arpeggio C5-E5-G5 — pleasant "correct" chime. */
export function playDing(ctx: AudioContext): void {
  const notes: Array<[number, number]> = [
    [523, 0],
    [659, 0.08],
    [784, 0.16],
  ];
  for (const [freq, offset] of notes) {
    scheduleNote(ctx, freq, offset, 0.18, 'triangle', 0.15);
  }
}

/** Short descending sawtooth — "try again" buzz, not punishing. */
export function playBuzz(ctx: AudioContext): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.27);
}

/** Six-tone ascending fanfare — level cleared. */
export function playFanfare(ctx: AudioContext): void {
  const sequence: Array<[number, number]> = [
    [523, 0],     // C5
    [659, 0.12],  // E5
    [784, 0.24],  // G5
    [1047, 0.36], // C6
    [784, 0.55],  // G5
    [1047, 0.7],  // C6 hold
  ];
  for (const [freq, offset] of sequence) {
    scheduleNote(ctx, freq, offset, 0.22, 'triangle', 0.18);
  }
}
