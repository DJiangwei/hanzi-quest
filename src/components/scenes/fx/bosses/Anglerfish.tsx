'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * Anglerfish — creature #2 in the boss roster.
 *
 * 4-state animation model:
 *  intro   — rises from below and scales in (~1.1s ease-out, one-shot)
 *  idle    — bioluminescent lure bobs up/down + glow pulses (opacity/scale loop)
 *  damage  — lure flickers (glow → dim) + whole-body recoil shake (~0.4s)
 *  defeat  — mouth gapes open (lure glow→0), body sinks and fades (~1.1s ease-in)
 *
 * Reduced-motion: no loops or transitions; defeat = low-opacity sunk static pose.
 */
export function Anglerfish({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Colours ─────────────────────────────────────────────────────────────
  const isDamaged = state === 'damage' || state === 'defeat';
  const bodyFill = isDamaged ? '#1a0d2e' : '#2a1050';
  const finFill = isDamaged ? '#140a24' : '#1e0c3c';
  const eyeFill = '#c8f060';
  const pupilFill = '#0c0c0c';
  const toothFill = '#f0e8d8';
  const lureFill = '#4ade80';          // bright green
  const glowColor = 'rgba(74,222,128,0.55)';

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
        // Gentle bob
        wrapperProps = {
          animate: { y: [0, -3, 0] },
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
        wrapperProps = {
          animate: { y: 60, rotate: -25, scale: 0.7, opacity: 0 },
          transition: { duration: 1.1, ease: 'easeIn' },
        };
        break;
    }
  }

  // ── Lure bob (idle only) ─────────────────────────────────────────────────
  const shouldPulse = !reduced && state === 'idle';
  const lureBobTransition = { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const };

  // ── Lure glow opacity (damage → flicker; defeat → off; idle → pulse) ────
  let glowOpacity: number | number[] = 0.75;
  let glowScale: number | number[] = 1;
  let glowTransition: Record<string, unknown> | undefined;

  if (!reduced) {
    if (shouldPulse) {
      glowOpacity = [0.6, 1, 0.6];
      glowScale = [1, 1.3, 1];
      glowTransition = lureBobTransition;
    } else if (state === 'damage') {
      glowOpacity = [0.75, 0.1, 0.75];
      glowTransition = { duration: 0.4 };
    } else if (state === 'defeat') {
      glowOpacity = 0;
    }
  }

  // Mouth open on defeat
  const mouthOpenExtra = !reduced && state === 'defeat' ? 6 : 0;

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="anglerfish"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* === Lure stalk + glowing bulb (above head) === */}
            <m.g
              animate={shouldPulse ? { y: [0, -4, 0] } : undefined}
              transition={shouldPulse ? lureBobTransition : undefined}
            >
              {/* stalk */}
              <path
                d="M 50 30 Q 56 22 58 14"
                stroke={bodyFill}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              {/* glow aura */}
              <m.circle
                cx="58"
                cy="12"
                r="6"
                fill={glowColor}
                animate={{ opacity: glowOpacity, scale: glowScale }}
                transition={glowTransition}
                style={{ originX: '58px', originY: '12px' }}
              />
              {/* lure core */}
              <circle cx="58" cy="12" r="3.5" fill={lureFill} />
            </m.g>

            {/* === Dorsal fin === */}
            <path
              d="M 38 34 Q 42 24 50 26 Q 58 24 62 34"
              fill={finFill}
              opacity="0.8"
            />

            {/* === Body (round, slightly flattened) === */}
            <ellipse cx="50" cy="55" rx="26" ry="22" fill={bodyFill} />

            {/* === Pectoral fins === */}
            <path d="M 26 58 Q 14 62 16 72 Q 22 68 28 64 Z" fill={finFill} />
            <path d="M 74 58 Q 86 62 84 72 Q 78 68 72 64 Z" fill={finFill} />

            {/* === Tail fin === */}
            <path d="M 74 55 Q 88 44 90 38 M 74 55 Q 88 62 90 68" stroke={finFill} strokeWidth="5" strokeLinecap="round" fill="none" />

            {/* === Big eye === */}
            <circle cx="40" cy="46" r="7" fill={eyeFill} />
            <circle cx="40" cy="46" r="4" fill={pupilFill} />
            <circle cx="38" cy="44" r="1.5" fill="#ffffff" opacity="0.7" />

            {/* === Gaping mouth (zigzag / toothy) === */}
            {/* Jaw */}
            <path
              d={`M 30 ${60 + mouthOpenExtra} Q 50 ${68 + mouthOpenExtra} 72 ${60 + mouthOpenExtra}`}
              fill="none"
              stroke={bodyFill}
              strokeWidth="0"
            />
            <path
              d={`M 30 60 Q 50 ${54 - mouthOpenExtra} 72 60 Q 50 ${68 + mouthOpenExtra} 30 60 Z`}
              fill="#1a0520"
            />
            {/* Upper teeth (zigzag) */}
            {[35, 43, 51, 59, 67].map((x, i) => (
              <polygon
                key={`ut-${i}`}
                points={`${x},60 ${x + 3},52 ${x + 6},60`}
                fill={toothFill}
              />
            ))}
            {/* Lower teeth */}
            {[38, 46, 54, 62].map((x, i) => (
              <polygon
                key={`lt-${i}`}
                points={`${x},${60 + mouthOpenExtra} ${x + 3},${66 + mouthOpenExtra} ${x + 6},${60 + mouthOpenExtra}`}
                fill={toothFill}
                opacity="0.85"
              />
            ))}
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
