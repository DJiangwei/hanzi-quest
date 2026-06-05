'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * Shark — creature #4 in the boss roster.
 *
 * 4-state animation model:
 *  intro   — rises from below and scales in (~1.1s ease-out, one-shot)
 *  idle    — tail fin sweeps back-and-forth + gentle forward bob (loop)
 *  damage  — sharp sideways veer + brightness flash (~0.4s one-shot)
 *  defeat  — rolls belly-up (~180° rotate), sinks and fades (~1.1s ease-in)
 *
 * Reduced-motion: no loops or transitions; defeat = low-opacity sunk static pose.
 */
export function Shark({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Colours ─────────────────────────────────────────────────────────────
  const isDamaged = state === 'damage' || state === 'defeat';
  const bodyFill = isDamaged ? '#6b7a8a' : '#9ab0c4';
  const bellyFill = isDamaged ? '#b0bec8' : '#ddeaf4';
  const finFill = isDamaged ? '#5c6b78' : '#7a98ae';

  // ── Whole-creature wrapper motion ────────────────────────────────────────
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
    // intro / idle / damage → neutral upright, full opacity
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
        // Gentle forward bob
        wrapperProps = {
          animate: { y: [0, -3, 0], x: [0, 2, 0] },
          transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
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
        // Rolls belly-up (180°) and sinks
        wrapperProps = {
          animate: { y: 60, rotate: 180, scale: 0.7, opacity: 0 },
          transition: { duration: 1.1, ease: 'easeIn' },
        };
        break;
    }
  }

  // ── Tail sweep — idle only ───────────────────────────────────────────────
  const shouldSweep = !reduced && state === 'idle';
  const tailSweep = shouldSweep ? { rotate: [-18, 18, -18] } : undefined;
  const tailTransition = { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const };

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="shark"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* === Animated tail fin === */}
            <m.g
              style={{ originX: '22px', originY: '50px' }}
              animate={tailSweep}
              transition={tailSweep ? tailTransition : undefined}
            >
              {/* Upper tail lobe */}
              <path
                d="M 22 46 Q 6 32 8 22 Q 14 28 22 50 Z"
                fill={finFill}
              />
              {/* Lower tail lobe */}
              <path
                d="M 22 54 Q 6 68 8 78 Q 14 72 22 50 Z"
                fill={finFill}
              />
            </m.g>

            {/* === Torpedo body === */}
            <ellipse cx="52" cy="50" rx="30" ry="14" fill={bodyFill} />

            {/* === Belly (lighter underside) === */}
            <ellipse cx="52" cy="55" rx="22" ry="7" fill={bellyFill} />

            {/* === Dorsal fin (tall triangle) === */}
            <path
              d="M 46 36 L 58 36 L 54 20 Z"
              fill={finFill}
            />

            {/* === Pectoral fins === */}
            <path d="M 56 52 Q 66 60 70 58 Q 64 50 56 50 Z" fill={finFill} />
            <path d="M 38 52 Q 28 60 24 58 Q 30 50 38 50 Z" fill={finFill} />

            {/* === Gill slits (3 lines) === */}
            <line x1="62" y1="44" x2="60" y2="56" stroke={finFill} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <line x1="66" y1="44" x2="64" y2="56" stroke={finFill} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <line x1="70" y1="44" x2="68" y2="56" stroke={finFill} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />

            {/* === Eye === */}
            <circle cx="75" cy="47" r="3.5" fill="#fef9ef" />
            <circle cx="75" cy="47" r="1.8" fill="#0c0c0c" />

            {/* === Mouth (zigzag toothy grin) === */}
            <polyline
              points="80,52 76,55 73,52 70,55 67,52"
              stroke={finFill}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
