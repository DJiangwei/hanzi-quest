'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * Sea Serpent — creature #3 in the boss roster.
 *
 * 4-state animation model:
 *  intro   — rises from below and scales in (~1.1s ease-out, one-shot)
 *  idle    — sinuous travelling wave: 4 body segments animate with staggered
 *            y offsets giving a flowing S-curve undulation (infinite loop)
 *  damage  — whole body snaps taut + brightness flash (~0.4s)
 *  defeat  — body goes limp, coils (rotate) and sinks/fades (~1.1s ease-in)
 *
 * Reduced-motion: no loops or transitions; defeat = low-opacity sunk static pose.
 */
export function SeaSerpent({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Colours ─────────────────────────────────────────────────────────────
  const isDamaged = state === 'damage' || state === 'defeat';
  const bodyFill = isDamaged ? '#1a4a1a' : '#1e7040';
  const scaleFill = isDamaged ? '#145014' : '#16603a';
  const finFill = isDamaged ? '#0e3a0e' : '#0c5030';
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
        // Gentle vertical bob at the wrapper level; segments handle the wave below
        wrapperProps = {
          animate: { y: [0, -2, 0] },
          transition: { duration: 2.0, repeat: Infinity, ease: 'easeInOut' },
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

  // ── Sinuous wave — body segments (idle only) ─────────────────────────────
  const shouldWave = !reduced && state === 'idle';
  // 4 segments at different x positions along the S-curve; staggered delays
  const segmentWave = shouldWave ? { y: [0, 6, 0, -6, 0] } : undefined;
  const waveBase = { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const };

  // Segment data: [cx, cy, rx, ry] for each body ring (S-curve layout)
  const segments: [number, number, number, number, number][] = [
    // index, cx, cy, rx, ry
    [0, 50, 28, 10, 8],   // head-neck junction (top)
    [1, 42, 44, 11, 9],   // upper body
    [2, 56, 60, 11, 9],   // mid body
    [3, 44, 74, 10, 8],   // lower body / tail
  ];

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="sea-serpent"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* === Body segments (back to front, S-curve) === */}
            {segments.map(([idx, cx, cy, rx, ry]) => (
              <m.g
                key={idx}
                animate={segmentWave}
                transition={
                  segmentWave
                    ? { ...waveBase, delay: idx * 0.14 }
                    : undefined
                }
              >
                {/* Main segment ellipse */}
                <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={bodyFill} />
                {/* Scale ridge */}
                <ellipse
                  cx={cx}
                  cy={cy - 2}
                  rx={rx * 0.55}
                  ry={ry * 0.4}
                  fill={scaleFill}
                  opacity="0.45"
                />
                {/* Dorsal fin nub on alternate segments */}
                {idx % 2 === 0 && (
                  <path
                    d={`M ${cx - 4} ${cy - ry} Q ${cx} ${cy - ry - 8} ${cx + 4} ${cy - ry} Z`}
                    fill={finFill}
                  />
                )}
              </m.g>
            ))}

            {/* === Tail tip === */}
            <m.g
              animate={segmentWave}
              transition={
                segmentWave
                  ? { ...waveBase, delay: 4 * 0.14 }
                  : undefined
              }
            >
              <path
                d="M 40 82 Q 30 92 28 98 M 40 82 Q 52 92 50 98"
                stroke={bodyFill}
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
            </m.g>

            {/* === Finned Head (on top of neck segment, static position) === */}
            {/* Head ellipse */}
            <ellipse cx="50" cy="18" rx="13" ry="11" fill={bodyFill} />
            {/* Head crest / fin */}
            <path
              d="M 42 10 Q 50 0 58 10"
              fill={finFill}
            />
            {/* Nostril snout */}
            <ellipse cx="50" cy="24" rx="6" ry="4" fill={scaleFill} opacity="0.6" />
            {/* Eye */}
            <circle cx="43" cy="16" r="4" fill={eyeFill} />
            <circle cx="43" cy="16" r="2.2" fill={pupilFill} />
            <circle cx="42" cy="15" r="0.9" fill="#ffffff" opacity="0.7" />
            {/* Tongue */}
            <path
              d="M 48 27 Q 48 32 44 34 M 48 27 Q 48 32 52 34"
              stroke="#e83030"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
