// src/lib/audio/play.ts
import { playBuzz, playDing, playFanfare } from './sounds';

export type SoundName = 'ding' | 'buzz' | 'fanfare';

let ctx: AudioContext | null = null;
let muted = false;

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

const handlers: Record<SoundName, (ctx: AudioContext) => void> = {
  ding: playDing,
  buzz: playBuzz,
  fanfare: playFanfare,
};

export function playSound(name: SoundName): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  handlers[name](c);
}

export function setAudioMuted(value: boolean): void {
  muted = value;
}
