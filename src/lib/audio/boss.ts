// S2 boss signature sounds — procedural per-creature-family battle cues.
// Shares the ctx + mute state with play.ts (reduced-motion mutes everything).
// Fire-and-forget: any WebAudio failure is swallowed; a cue can never break
// the boss fight.
import { getSharedAudio } from './play';

export type BossSoundFamily = 'growl' | 'bubble' | 'zap' | 'snap';
export type BossCueKind = 'intro' | 'damage' | 'defeat';

const FAMILY_BY_CREATURE: Record<string, BossSoundFamily> = {
  kraken: 'growl',
  'sea-serpent': 'growl',
  'sea-dragon': 'growl',
  'jelly-swarm': 'bubble',
  'giant-clam': 'bubble',
  whirlpool: 'bubble',
  'electric-eel': 'zap',
  anglerfish: 'zap',
  'giant-crab': 'snap',
  shark: 'snap',
};

/** Pure — unknown keys (future creatures) degrade to the growl family. */
export function familyForCreature(key: string): BossSoundFamily {
  return FAMILY_BY_CREATURE[key] ?? 'growl';
}

/** Oscillator sweep: freq from→to over `dur`, gain envelope peak→0. */
function sweep(
  ctx: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  startOffset: number,
  dur: number,
  peak: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  const t0 = ctx.currentTime + startOffset;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Short band-passed noise burst — pops, snaps, splashes. */
function noiseBurst(
  ctx: AudioContext,
  centerFreq: number,
  startOffset: number,
  dur: number,
  peak: number,
) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = centerFreq;
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const RECIPES: Record<BossSoundFamily, Record<BossCueKind, (ctx: AudioContext) => void>> = {
  growl: {
    intro(ctx) {
      sweep(ctx, 'sawtooth', 70, 45, 0, 1.1, 0.12);
      sweep(ctx, 'sawtooth', 105, 68, 0.05, 1.0, 0.07);
    },
    damage(ctx) {
      sweep(ctx, 'sawtooth', 140, 90, 0, 0.3, 0.12);
    },
    defeat(ctx) {
      sweep(ctx, 'sawtooth', 110, 30, 0, 1.2, 0.13);
      noiseBurst(ctx, 300, 0.8, 0.4, 0.08);
    },
  },
  bubble: {
    intro(ctx) {
      for (let i = 0; i < 5; i++) noiseBurst(ctx, 600 + i * 220, i * 0.15, 0.12, 0.1);
    },
    damage(ctx) {
      noiseBurst(ctx, 900, 0, 0.15, 0.12);
      sweep(ctx, 'sine', 500, 900, 0, 0.15, 0.08);
    },
    defeat(ctx) {
      for (let i = 0; i < 7; i++) noiseBurst(ctx, 1200 - i * 130, i * 0.14, 0.12, 0.1);
    },
  },
  zap: {
    intro(ctx) {
      sweep(ctx, 'square', 220, 1800, 0, 0.35, 0.06);
      sweep(ctx, 'square', 180, 1500, 0.4, 0.35, 0.06);
    },
    damage(ctx) {
      sweep(ctx, 'square', 1600, 300, 0, 0.2, 0.08);
      noiseBurst(ctx, 2500, 0, 0.08, 0.06);
    },
    defeat(ctx) {
      sweep(ctx, 'square', 1200, 60, 0, 1.0, 0.08);
      noiseBurst(ctx, 1800, 0.2, 0.3, 0.05);
    },
  },
  snap: {
    intro(ctx) {
      noiseBurst(ctx, 1800, 0, 0.06, 0.14);
      noiseBurst(ctx, 1400, 0.25, 0.06, 0.14);
    },
    damage(ctx) {
      noiseBurst(ctx, 2200, 0, 0.05, 0.15);
    },
    defeat(ctx) {
      noiseBurst(ctx, 1600, 0, 0.06, 0.14);
      noiseBurst(ctx, 1100, 0.18, 0.08, 0.12);
      sweep(ctx, 'triangle', 400, 120, 0.3, 0.6, 0.1);
    },
  },
};

export function playBossCue(creatureKey: string, kind: BossCueKind): void {
  try {
    const { ctx, muted } = getSharedAudio();
    if (muted || !ctx) return;
    RECIPES[familyForCreature(creatureKey)][kind](ctx);
  } catch {
    // Cues are pure garnish — never let audio break the fight.
  }
}
