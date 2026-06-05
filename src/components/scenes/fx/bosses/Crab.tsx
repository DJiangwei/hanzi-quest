'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * Giant Crab — creature #1 in the boss roster.
 *
 * 4-state animation model:
 *  intro   — rises from below and scales in (~1.1s ease-out, one-shot)
 *  idle    — claws open/close (snap) on a loop + gentle side-to-side sway
 *  damage  — claws jerk back + brightness flash (~0.4s)
 *  defeat  — flips ~180°, legs curl (rotate), sinks and fades (~1.1s ease-in)
 *
 * Reduced-motion: no loops or transitions; defeat = low-opacity sunk static pose.
 */
export function Crab({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Colours ─────────────────────────────────────────────────────────────
  const isDamaged = state === 'damage' || state === 'defeat';
  const shellFill = isDamaged ? '#8b2500' : '#c84b0c';
  const clawFill = isDamaged ? '#7a2200' : '#b23d08';
  const legFill = isDamaged ? '#7a2200' : '#b23d08';
  const eyeFill = '#fef9ef';
  const pupilFill = '#0c0c0c';

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
    // intro / idle / damage → neutral, full opacity
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
        // Gentle side-to-side sway
        wrapperProps = {
          animate: { x: [0, 3, 0, -3, 0], y: [0, -1, 0] },
          transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
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
          animate: { y: 60, rotate: -180, scale: 0.7, opacity: 0 },
          transition: { duration: 1.1, ease: 'easeIn' },
        };
        break;
    }
  }

  // ── Claw snap (idle only) ────────────────────────────────────────────────
  const shouldSnap = !reduced && state === 'idle';
  const leftClawRotate = shouldSnap ? [0, -18, 0] : undefined;
  const rightClawRotate = shouldSnap ? [0, 18, 0] : undefined;
  const clawTransition = { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const };

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="giant-crab"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* === Legs (3 each side, behind carapace) === */}
            {/* Left legs */}
            <line x1="30" y1="56" x2="14" y2="64" stroke={legFill} strokeWidth="3" strokeLinecap="round" />
            <line x1="28" y1="58" x2="12" y2="70" stroke={legFill} strokeWidth="3" strokeLinecap="round" />
            <line x1="26" y1="61" x2="13" y2="76" stroke={legFill} strokeWidth="3" strokeLinecap="round" />
            {/* Right legs */}
            <line x1="70" y1="56" x2="86" y2="64" stroke={legFill} strokeWidth="3" strokeLinecap="round" />
            <line x1="72" y1="58" x2="88" y2="70" stroke={legFill} strokeWidth="3" strokeLinecap="round" />
            <line x1="74" y1="61" x2="87" y2="76" stroke={legFill} strokeWidth="3" strokeLinecap="round" />

            {/* === Carapace (wide rounded trapezoid) === */}
            <path
              d="M 22 65 Q 18 45 50 38 Q 82 45 78 65 Q 72 75 50 76 Q 28 75 22 65 Z"
              fill={shellFill}
            />
            {/* Carapace highlight ridge */}
            <path
              d="M 36 48 Q 50 42 64 48"
              stroke={clawFill}
              strokeWidth="2"
              fill="none"
              opacity="0.5"
            />

            {/* === Stalked eyes === */}
            {/* Left eye stalk + ball */}
            <line x1="40" y1="42" x2="36" y2="35" stroke={shellFill} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="35" cy="33" r="3.5" fill={eyeFill} />
            <circle cx="35" cy="33" r="1.8" fill={pupilFill} />
            {/* Right eye stalk + ball */}
            <line x1="60" y1="42" x2="64" y2="35" stroke={shellFill} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="65" cy="33" r="3.5" fill={eyeFill} />
            <circle cx="65" cy="33" r="1.8" fill={pupilFill} />

            {/* === Left claw on stalk === */}
            <m.g
              style={{ originX: '24px', originY: '52px' }}
              animate={leftClawRotate ? { rotate: leftClawRotate } : undefined}
              transition={leftClawRotate ? clawTransition : undefined}
            >
              {/* stalk */}
              <line x1="30" y1="52" x2="18" y2="46" stroke={clawFill} strokeWidth="4" strokeLinecap="round" />
              {/* upper pincer */}
              <path d="M 18 46 Q 8 40 6 34 Q 9 30 14 33 Q 12 38 16 42 Z" fill={clawFill} />
              {/* lower pincer */}
              <path d="M 18 46 Q 10 50 7 46 Q 9 40 14 42 Z" fill={clawFill} />
            </m.g>

            {/* === Right claw on stalk === */}
            <m.g
              style={{ originX: '76px', originY: '52px' }}
              animate={rightClawRotate ? { rotate: rightClawRotate } : undefined}
              transition={rightClawRotate ? clawTransition : undefined}
            >
              {/* stalk */}
              <line x1="70" y1="52" x2="82" y2="46" stroke={clawFill} strokeWidth="4" strokeLinecap="round" />
              {/* upper pincer */}
              <path d="M 82 46 Q 92 40 94 34 Q 91 30 86 33 Q 88 38 84 42 Z" fill={clawFill} />
              {/* lower pincer */}
              <path d="M 82 46 Q 90 50 93 46 Q 91 40 86 42 Z" fill={clawFill} />
            </m.g>
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
