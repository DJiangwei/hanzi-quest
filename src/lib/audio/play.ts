// src/lib/audio/play.ts
import { getTheme } from './themes';

export type SoundName = 'ding' | 'buzz' | 'fanfare';

let ctx: AudioContext | null = null;
let muted = false;
let currentThemeSlug: string | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

// S1 streak pitch-ramp: consecutive correct answers (dings) raise the ding's
// pitch by 2 semitones per step, capped at +8; any buzz or fanfare resets it.
// Module-level per-tab state — the streak deliberately persists across scenes.
let dingStreak = 0;

/** Pitch multiplier for the Nth consecutive ding (1-based). Pure — tested. */
export function streakPitchMult(streak: number): number {
  const steps = Math.min(Math.max(streak - 1, 0), 4);
  return 2 ** ((2 * steps) / 12);
}

export function resetDingStreak(): void {
  dingStreak = 0;
}

export function playSound(name: SoundName): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const theme = getTheme(currentThemeSlug);
  if (name === 'ding') {
    dingStreak += 1;
    theme.ding(c, streakPitchMult(dingStreak));
    return;
  }
  dingStreak = 0;
  theme[name](c);
}

/** Shared audio state for auxiliary cue modules (boss battle sounds). */
export function getSharedAudio(): { ctx: AudioContext | null; muted: boolean } {
  if (muted) return { ctx: null, muted };
  return { ctx: getCtx(), muted };
}

export function setAudioMuted(value: boolean): void {
  muted = value;
}

export function setAudioTheme(slug: string | null): void {
  currentThemeSlug = slug;
}
