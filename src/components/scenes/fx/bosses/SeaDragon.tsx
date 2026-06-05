'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * Sea Dragon (Leafy Seadragon) — creature #8 in the boss roster.
 *
 * 4-state animation model:
 *  intro   — dragon rises from below, scales in (~1.1s ease-out, one-shot)
 *  idle    — leaf fins flutter (staggered rotate loops) + gentle whole-body drift
 *  damage  — body curls (rotate pop) + brightness flash (~0.4s one-shot)
 *  defeat  — fins droop, body sinks slowly and fades (~1.1s ease-in)
 *
 * Reduced-motion: all loops and transitions disabled; defeat = low-opacity sunk static pose.
 */
export function SeaDragon({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Colours ─────────────────────────────────────────────────────────────
  const bodyColor = '#3a8c5c';
  const bodyDark = '#256040';
  const finColor = '#5cbf7a';
  const finDark = '#3a9a58';
  const eyeWhite = '#fef9ef';

  // ── Wrapper (whole-creature) motion props ────────────────────────────────
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
  } else {
    switch (state) {
      case 'intro':
        wrapperProps = {
          initial: { y: 40, scale: 0.6, opacity: 0 },
          animate: { y: 0, scale: 1, opacity: 1 },
          transition: { duration: 1.1, ease: 'easeOut' },
        };
        break;

      case 'idle':
        wrapperProps = {
          animate: { y: [0, -2.5, 0] },
          transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
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
          animate: { y: 60, rotate: 25, scale: 0.7, opacity: 0 },
          transition: { duration: 1.1, ease: 'easeIn' },
        };
        break;
    }
  }

  // ── Leaf fin flutter props (staggered, idle only) ────────────────────────
  const shouldFlutter = !reduced && state === 'idle';

  const finProps = (delay: number, amplitude: number = 8): MotionProps =>
    shouldFlutter
      ? {
          animate: { rotate: [-amplitude, amplitude, -amplitude] },
          transition: {
            duration: 1.4,
            repeat: Infinity,
            ease: 'easeInOut' as const,
            delay,
          },
        }
      : {};

  // ── Defeat fin droop ─────────────────────────────────────────────────────
  const defeatFinProps: MotionProps =
    !reduced && state === 'defeat'
      ? {
          animate: { rotate: 30, opacity: 0.3 },
          transition: { duration: 1.0, ease: 'easeIn' as const },
        }
      : {};

  const activeFin = (delay: number, amplitude?: number): MotionProps =>
    state === 'defeat' ? defeatFinProps : finProps(delay, amplitude);

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="sea-dragon"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* ── S-curved body ── */}
            {/* Upper body segment */}
            <path
              d="M 52 20 C 68 24 72 36 58 44 C 44 52 40 62 54 72 C 60 76 58 82 52 84"
              stroke={bodyColor}
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
            />
            {/* Body center line (darker) */}
            <path
              d="M 52 20 C 68 24 72 36 58 44 C 44 52 40 62 54 72 C 60 76 58 82 52 84"
              stroke={bodyDark}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              opacity="0.5"
            />

            {/* ── Long horse-like snout ── */}
            <path
              d="M 52 20 C 50 14 44 10 40 8"
              stroke={bodyColor}
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Nostril tip */}
            <circle cx="40" cy="8" r="2" fill={bodyDark} />

            {/* ── Leaf fin fronds along the body (staggered origins) ── */}
            {/* Fin 1 — upper body, left */}
            <m.path
              d="M 60 28 C 70 22 78 18 74 28 C 70 36 62 34 60 28 Z"
              fill={finColor}
              opacity="0.85"
              style={{ originX: '60px', originY: '28px' }}
              {...(activeFin(0, 9) as Parameters<typeof m.path>[0])}
            />
            {/* Fin 2 — upper body, right */}
            <m.path
              d="M 56 33 C 44 26 36 22 40 32 C 44 40 54 40 56 33 Z"
              fill={finDark}
              opacity="0.8"
              style={{ originX: '56px', originY: '33px' }}
              {...(activeFin(0.2, 10) as Parameters<typeof m.path>[0])}
            />
            {/* Fin 3 — mid body, left */}
            <m.path
              d="M 58 46 C 70 40 80 36 76 46 C 72 54 60 52 58 46 Z"
              fill={finColor}
              opacity="0.85"
              style={{ originX: '58px', originY: '46px' }}
              {...(activeFin(0.35, 11) as Parameters<typeof m.path>[0])}
            />
            {/* Fin 4 — mid body, right */}
            <m.path
              d="M 48 52 C 36 44 28 42 32 52 C 36 60 48 60 48 52 Z"
              fill={finDark}
              opacity="0.75"
              style={{ originX: '48px', originY: '52px' }}
              {...(activeFin(0.5, 9) as Parameters<typeof m.path>[0])}
            />
            {/* Fin 5 — lower body, left */}
            <m.path
              d="M 54 64 C 66 58 76 56 72 66 C 68 74 56 72 54 64 Z"
              fill={finColor}
              opacity="0.8"
              style={{ originX: '54px', originY: '64px' }}
              {...(activeFin(0.65, 8) as Parameters<typeof m.path>[0])}
            />
            {/* Fin 6 — tail curl frond */}
            <m.path
              d="M 50 78 C 40 72 32 70 36 80 C 40 88 50 86 50 78 Z"
              fill={finDark}
              opacity="0.7"
              style={{ originX: '50px', originY: '78px' }}
              {...(activeFin(0.8, 7) as Parameters<typeof m.path>[0])}
            />

            {/* ── Eye ── */}
            <circle cx="46" cy="18" r="3.5" fill={eyeWhite} />
            <circle cx="46" cy="18" r="2" fill="#0c1a0c" />
            {/* Eye highlight */}
            <circle cx="45" cy="17" r="0.8" fill="#ffffff" opacity="0.7" />
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
