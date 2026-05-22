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

export function playSound(name: SoundName): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const theme = getTheme(currentThemeSlug);
  theme[name](c);
}

export function setAudioMuted(value: boolean): void {
  muted = value;
}

export function setAudioTheme(slug: string | null): void {
  currentThemeSlug = slug;
}
