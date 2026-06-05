'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * Jellyfish Swarm — creature #5 in the boss roster.
 *
 * 4-state animation model:
 *  intro   — three jellies float up together from below, scale in (~1.1s ease-out, one-shot)
 *  idle    — bells pulse (scaleY loop) + tentacles drift, staggered per jelly (loop)
 *  damage  — all bells contract + brightness flash (~0.4s one-shot)
 *  defeat  — bells deflate (scaleY→0.3), opacity→0, tentacles fall (y+) (~1.1s ease-in)
 *
 * Reduced-motion: no loops or transitions; defeat = low-opacity sunk static pose.
 */
export function JellySwarm({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Three jellies: [cx, cy, scale, hue] ─────────────────────────────────
  // Arranged at different depths / positions within the 100×100 viewBox
  const jellies = [
    { cx: 28, cy: 42, r: 14, fillColor: '#a78de8', tentacleColor: '#7c5ec4', delay: 0 },
    { cx: 58, cy: 52, r: 18, fillColor: '#7ec8e3', tentacleColor: '#4899b8', delay: 0.25 },
    { cx: 78, cy: 36, r: 11, fillColor: '#e87eb0', tentacleColor: '#c44880', delay: 0.5 },
  ];

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
        // Gentle overall drift
        wrapperProps = {
          animate: { y: [0, -2, 0] },
          transition: { duration: 3.0, repeat: Infinity, ease: 'easeInOut' },
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
          animate: { y: 60, scale: 0.7, opacity: 0 },
          transition: { duration: 1.1, ease: 'easeIn' },
        };
        break;
    }
  }

  // ── Per-jelly bell pulse (idle only) ────────────────────────────────────
  const shouldPulse = !reduced && state === 'idle';

  // ── Per-jelly tentacle drift (idle only) ────────────────────────────────
  const shouldDrift = !reduced && state === 'idle';

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="jelly-swarm"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {jellies.map((j) => {
              const tentacleBaseY = j.cy + j.r;

              // Bell pulse props
              const bellProps = shouldPulse
                ? {
                    animate: { scaleY: [1, 0.82, 1] },
                    transition: {
                      duration: 1.6,
                      repeat: Infinity,
                      ease: 'easeInOut' as const,
                      delay: j.delay,
                    },
                  }
                : {};

              // Tentacle drift props
              const tentacleProps = (offsetDelay: number) =>
                shouldDrift
                  ? {
                      animate: { y: [0, 3, -2, 0] },
                      transition: {
                        duration: 2.2,
                        repeat: Infinity,
                        ease: 'easeInOut' as const,
                        delay: j.delay + offsetDelay,
                      },
                    }
                  : {};

              // Defeat deflate
              const defeatBellProps =
                !reduced && state === 'defeat'
                  ? {
                      animate: { scaleY: 0.3, opacity: 0 },
                      transition: { duration: 1.1, ease: 'easeIn' as const },
                    }
                  : {};

              const activeBellProps =
                state === 'defeat' ? defeatBellProps : bellProps;

              return (
                <g key={j.cx}>
                  {/* === Bell === */}
                  <m.g
                    style={{ originX: `${j.cx}px`, originY: `${j.cy}px` }}
                    {...(activeBellProps as Parameters<typeof m.g>[0])}
                  >
                    {/* Dome (semi-ellipse) */}
                    <ellipse
                      cx={j.cx}
                      cy={j.cy}
                      rx={j.r}
                      ry={j.r * 0.65}
                      fill={j.fillColor}
                      opacity="0.62"
                    />
                    {/* Inner highlight */}
                    <ellipse
                      cx={j.cx - j.r * 0.18}
                      cy={j.cy - j.r * 0.15}
                      rx={j.r * 0.45}
                      ry={j.r * 0.28}
                      fill="#ffffff"
                      opacity="0.28"
                    />
                    {/* Rim */}
                    <ellipse
                      cx={j.cx}
                      cy={j.cy + j.r * 0.6}
                      rx={j.r}
                      ry={j.r * 0.18}
                      fill={j.tentacleColor}
                      opacity="0.45"
                    />
                  </m.g>

                  {/* === Tentacles (3-4 trailing lines, staggered drift) === */}
                  {[-j.r * 0.55, -j.r * 0.18, j.r * 0.18, j.r * 0.55].map((offset, ti) => (
                    <m.line
                      key={ti}
                      x1={j.cx + offset}
                      y1={tentacleBaseY}
                      x2={j.cx + offset * 0.7}
                      y2={tentacleBaseY + j.r * 1.4}
                      stroke={j.tentacleColor}
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      opacity="0.7"
                      {...(tentacleProps(ti * 0.1) as Parameters<typeof m.line>[0])}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
