'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * 幽灵旗舰 / Ghost Galleon — the Caribbean map overlord.
 *
 * Bigger + ship-shaped, distinct from the weekly sea creatures. Mirrors the
 * `Kraken` prop/animation contract (LazyMotion + per-state wrapper motion +
 * reduced-motion static fallback) so it composes identically in the roster.
 *
 * 4-state animation model:
 *  intro   — galleon rises from below, fades in (~1.1s one-shot)
 *  idle    — hull rocks gently on the swell (2.4s loop)
 *  damage  — whole ship shakes horizontally + brightness flash (~0.4s one-shot)
 *  defeat  — ship sinks, rolls, fades out (~1.1s one-shot)
 *
 * Reduced-motion: all loops/transitions disabled; defeat renders as a static
 * low-opacity sunk pose.
 */
export function GhostGalleon({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Colour ──────────────────────────────────────────────────────────────
  const isDamaged = state === 'damage' || state === 'defeat';
  const tint = isDamaged
    ? state === 'defeat'
      ? '#5b6770'
      : '#b34b4b'
    : '#3a4a5a';
  const glowOpacity = state === 'defeat' ? 0.05 : 0.15;

  // ── Wrapper (whole-ship) motion props ────────────────────────────────────
  type MotionProps = {
    initial?: Record<string, unknown>;
    animate?: Record<string, unknown>;
    transition?: Record<string, unknown>;
    style?: Record<string, unknown>;
  };

  let wrapperProps: MotionProps = {};

  if (reduced) {
    if (state === 'defeat') {
      wrapperProps = { style: { opacity: 0.3, transform: 'translateY(32px)' } };
    }
    // intro / idle / damage → neutral upright, full opacity (default)
  } else {
    switch (state) {
      case 'intro':
        wrapperProps = {
          initial: { y: 40, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          transition: { duration: 1.1, ease: 'easeOut' },
        };
        break;

      case 'idle':
        wrapperProps = {
          animate: { y: [0, -4, 0], rotate: [-1.5, 1.5, -1.5] },
          transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
        };
        break;

      case 'damage':
        wrapperProps = {
          animate: {
            x: [-6, 6, -4, 4, 0],
            filter: [
              'brightness(1)',
              'brightness(1.8)',
              'brightness(1.5)',
              'brightness(1)',
            ],
          },
          transition: { duration: 0.4, ease: 'easeOut' },
        };
        break;

      case 'defeat':
        wrapperProps = {
          animate: { y: 60, rotate: -18, scale: 0.75, opacity: 0 },
          transition: { duration: 1.1, ease: 'easeIn' },
        };
        break;
    }
  }

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="ghost-galleon"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* ghost glow beneath the hull */}
            <ellipse cx="50" cy="66" rx="36" ry="9" fill="#7fe3d6" opacity={glowOpacity} />
            {/* hull */}
            <path
              d="M 18 58 Q 50 78 82 58 L 75 70 Q 50 86 25 70 Z"
              fill={tint}
              stroke="#1f2a36"
              strokeWidth="1.5"
            />
            {/* deck line */}
            <path d="M 18 58 Q 50 66 82 58" fill="none" stroke="#1f2a36" strokeWidth="1" opacity="0.6" />
            {/* main mast */}
            <rect x="48.5" y="20" width="3" height="40" fill="#26323e" />
            {/* fore mast */}
            <rect x="34" y="30" width="2.4" height="30" fill="#26323e" opacity="0.85" />
            {/* aft mast */}
            <rect x="64" y="30" width="2.4" height="30" fill="#26323e" opacity="0.85" />
            {/* tattered sails */}
            <path d="M 52 26 Q 68 32 65 48 L 52 45 Z" fill="#cdd6dd" opacity="0.82" />
            <path d="M 48 26 Q 32 32 35 48 L 48 45 Z" fill="#cdd6dd" opacity="0.82" />
            {/* skull flag */}
            <rect x="50.5" y="14" width="11" height="8" fill="#1f2a36" />
            <circle cx="56" cy="18" r="1.8" fill="#e8e8e8" />
            <circle cx="53.5" cy="17.5" r="0.7" fill="#1f2a36" />
            <circle cx="58.5" cy="17.5" r="0.7" fill="#1f2a36" />
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
