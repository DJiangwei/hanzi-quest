'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * Electric Eel — creature #6 in the boss roster.
 *
 * 4-state animation model:
 *  intro   — rises from below, scales in (~1.1s ease-out, one-shot)
 *  idle    — body undulates (wave via rotate loop) + spark glyphs flicker (opacity pulse)
 *  damage  — spark burst (scale+opacity pop) + body recoil (x shake) (~0.4s one-shot)
 *  defeat  — sparks fizzle (opacity→0), body sinks and fades (~1.1s ease-in)
 *
 * Reduced-motion: no loops or transitions; defeat = low-opacity sunk static pose.
 */
export function ElectricEel({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Colours ─────────────────────────────────────────────────────────────
  const isDamaged = state === 'damage' || state === 'defeat';
  const bodyFill = isDamaged ? '#a0b800' : '#c8e000';
  const bodyStroke = isDamaged ? '#7a8c00' : '#98ab00';
  const sparkColor = isDamaged ? '#ffe066' : '#fff200';

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
        // Gentle overall undulation (wave motion via slight rotate + y bob)
        wrapperProps = {
          animate: { rotate: [-2, 2, -2], y: [0, -2, 0] },
          transition: { duration: 2.0, repeat: Infinity, ease: 'easeInOut' },
        };
        break;

      case 'damage':
        // Big spark burst feel: sharp recoil + flash
        wrapperProps = {
          animate: {
            x: [-6, 6, -4, 4, 0],
            filter: [
              'brightness(1)',
              'brightness(2.2)',
              'brightness(1.6)',
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

  // ── Body segment wave — idle only ────────────────────────────────────────
  // Each body segment gets a slight phase-staggered scaleX pulse to simulate
  // serpentine undulation.
  const shouldUndulate = !reduced && state === 'idle';
  const undulateTransition = { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const };

  // ── Spark flicker — idle only ────────────────────────────────────────────
  const shouldFlicker = !reduced && state === 'idle';

  // ── Spark burst — damage only ─────────────────────────────────────────────
  const shouldBurst = !reduced && state === 'damage';

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="electric-eel"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* === Long serpentine body (3 segments, thick wavy path) === */}
            {/* Tail segment */}
            <m.path
              d="M 8 62 Q 20 52 28 58 Q 36 65 44 55"
              stroke={bodyFill}
              strokeWidth="9"
              strokeLinecap="round"
              fill="none"
              style={{ originX: '28px', originY: '58px' }}
              animate={shouldUndulate ? { scaleX: [1, 0.96, 1.02, 1] } : undefined}
              transition={shouldUndulate ? { ...undulateTransition, delay: 0.3 } : undefined}
            />
            {/* Mid segment */}
            <m.path
              d="M 28 58 Q 40 46 52 52 Q 60 58 68 48"
              stroke={bodyFill}
              strokeWidth="11"
              strokeLinecap="round"
              fill="none"
              style={{ originX: '48px', originY: '52px' }}
              animate={shouldUndulate ? { scaleX: [1, 1.02, 0.97, 1] } : undefined}
              transition={shouldUndulate ? { ...undulateTransition, delay: 0.15 } : undefined}
            />
            {/* Head segment */}
            <m.path
              d="M 52 52 Q 68 40 80 44 Q 90 46 92 50"
              stroke={bodyFill}
              strokeWidth="13"
              strokeLinecap="round"
              fill="none"
              style={{ originX: '72px', originY: '48px' }}
              animate={shouldUndulate ? { scaleX: [1, 1.01, 0.98, 1] } : undefined}
              transition={shouldUndulate ? { ...undulateTransition, delay: 0 } : undefined}
            />

            {/* Body highlight stripe */}
            <path
              d="M 30 56 Q 50 46 70 44"
              stroke={bodyStroke}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.5"
            />

            {/* === Eyes (near head) === */}
            <circle cx="86" cy="46" r="3.2" fill="#fef9ef" />
            <circle cx="86" cy="46" r="1.6" fill="#0c0c0c" />
            <circle cx="80" cy="43" r="2.5" fill="#fef9ef" />
            <circle cx="80" cy="43" r="1.2" fill="#0c0c0c" />

            {/* === Zigzag spark glyphs near head === */}
            {/* Spark 1 */}
            <m.path
              d="M 74 34 L 70 38 L 73 38 L 69 44"
              stroke={sparkColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              animate={
                shouldFlicker
                  ? { opacity: [1, 0.2, 1, 0.5, 1] }
                  : shouldBurst
                  ? { opacity: [1, 0], scale: [1, 1.6] }
                  : state === 'defeat'
                  ? { opacity: 0 }
                  : undefined
              }
              transition={
                shouldFlicker
                  ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0 }
                  : shouldBurst
                  ? { duration: 0.35, ease: 'easeOut' }
                  : state === 'defeat'
                  ? { duration: 0.8 }
                  : undefined
              }
            />
            {/* Spark 2 */}
            <m.path
              d="M 84 30 L 81 35 L 84 35 L 80 41"
              stroke={sparkColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              animate={
                shouldFlicker
                  ? { opacity: [0.5, 1, 0.2, 1, 0.4] }
                  : shouldBurst
                  ? { opacity: [1, 0], scale: [1, 1.6] }
                  : state === 'defeat'
                  ? { opacity: 0 }
                  : undefined
              }
              transition={
                shouldFlicker
                  ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }
                  : shouldBurst
                  ? { duration: 0.35, ease: 'easeOut' }
                  : state === 'defeat'
                  ? { duration: 0.6 }
                  : undefined
              }
            />
            {/* Spark 3 (small accent) */}
            <m.path
              d="M 92 35 L 90 38 L 93 38 L 91 42"
              stroke={sparkColor}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              animate={
                shouldFlicker
                  ? { opacity: [0.3, 0.9, 0.1, 0.7, 0.3] }
                  : shouldBurst
                  ? { opacity: [1, 0], scale: [1, 1.8] }
                  : state === 'defeat'
                  ? { opacity: 0 }
                  : undefined
              }
              transition={
                shouldFlicker
                  ? { duration: 1.0, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }
                  : shouldBurst
                  ? { duration: 0.35, ease: 'easeOut' }
                  : state === 'defeat'
                  ? { duration: 0.5 }
                  : undefined
              }
            />
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
