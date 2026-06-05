'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * Kraken — creature #0 in the boss roster.
 *
 * 4-state animation model:
 *  intro   — creature rises from below, scales up from 60 % → 100 % opacity (one-shot ~1.1s)
 *  idle    — tentacles wave continuously (1.8 s loop), body bobs gently
 *  damage  — whole creature shakes horizontally + brightness flash (~0.4 s one-shot)
 *  defeat  — creature sinks, rotates, fades out (~1.1 s one-shot)
 *
 * Reduced-motion: all loops and transitions disabled; defeat renders as a
 * static low-opacity sunk pose instead.
 */
export function Kraken({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Colour ──────────────────────────────────────────────────────────────
  const isDamaged = state === 'damage' || state === 'defeat';
  const fill = isDamaged ? '#6b2424' : '#1e4040';
  const inkFill = isDamaged ? '#4a1616' : '#0c2424';

  // ── Tentacle wave — only during idle/intro, full motion ─────────────────
  const waveStates: typeof state[] = ['idle', 'intro'];
  const shouldWave = !reduced && waveStates.includes(state);
  const tentacleWave = shouldWave ? { rotate: [-6, 6, -6] } : undefined;
  const tentacleTransition = { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const };

  // ── Wrapper (whole-creature) motion props ────────────────────────────────
  type MotionProps = {
    initial?: Record<string, unknown>;
    animate?: Record<string, unknown>;
    transition?: Record<string, unknown>;
    style?: Record<string, unknown>;
  };

  let wrapperProps: MotionProps = {};

  if (reduced) {
    // Static poses only — no animation whatsoever
    if (state === 'defeat') {
      wrapperProps = { style: { opacity: 0.3, transform: 'translateY(32px)' } };
    }
    // intro / idle / damage → neutral upright, full opacity (default)
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
          animate: { y: [0, -2, 0] },
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
          animate: { y: 60, rotate: 25, scale: 0.7, opacity: 0 },
          transition: { duration: 1.1, ease: 'easeIn' },
        };
        break;
    }
  }

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="kraken"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* Body */}
            <ellipse cx="50" cy="42" rx="22" ry="20" fill={fill} />
            {/* Body highlight */}
            <ellipse cx="50" cy="38" rx="14" ry="10" fill={inkFill} opacity="0.4" />
            {/* Eyes — whites */}
            <circle cx="42" cy="40" r="4" fill="#fef9ef" />
            <circle cx="58" cy="40" r="4" fill="#fef9ef" />
            {/* Eyes — pupils */}
            <circle cx="42" cy="40" r="2" fill="#0c0c0c" />
            <circle cx="58" cy="40" r="2" fill="#0c0c0c" />
            {/* Tentacles — 5 wavy paths */}
            {[20, 35, 50, 65, 80].map((x, i) => (
              <m.path
                key={x}
                d={`M ${x} 62 Q ${x - 4} 75 ${x + 2} 85 Q ${x - 2} 92 ${x} 96`}
                stroke={fill}
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
                style={{ originX: `${x}px`, originY: '62px' }}
                animate={tentacleWave}
                transition={
                  tentacleWave
                    ? { ...tentacleTransition, delay: i * 0.12 }
                    : undefined
                }
              />
            ))}
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
