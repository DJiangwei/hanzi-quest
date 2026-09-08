'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * 火焰山巨兽 / The Flame Titan — the 里海 map overlord.
 *
 * The key vault's lore already says 十把钥匙点亮了火焰山 ("ten keys lit the
 * Burning Mountain"), so the two rewards are written to reinforce rather than
 * repeat: collecting the map's ten keys WAKES what sleeps inside it. The
 * subject is a mountain, which is also why it reads differently from every
 * weekly creature — no eyes-and-limbs silhouette, just a mass with a fire in
 * it. Azerbaijan means "land of fire"; that is the fact the season's 火之城
 * 巴库 card teaches, and this is where it pays off.
 *
 * Mirrors `GhostGalleon`'s contract exactly (LazyMotion + per-state wrapper
 * motion + reduced-motion static fallback) so it composes identically in the
 * roster.
 *
 * 4-state animation model:
 *  intro   — the mountain surges up as the crater ignites (~1.1s one-shot)
 *  idle    — flame breathes, lava cracks pulse (2.6s loop)
 *  damage  — shakes; the fire gutters instead of flaring, so a hit visibly
 *            COSTS it something (~0.4s one-shot)
 *  defeat  — fire goes out, the mountain greys and settles (~1.1s one-shot)
 *
 * Reduced-motion: no loops or transitions; defeat is a static dimmed pose.
 */
export function FlameTitan({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  const isDefeated = state === 'defeat';
  const isHurt = state === 'damage';

  // Rock darkens when hurt and drains to grey stone when beaten.
  const rock = isDefeated ? '#6b6560' : isHurt ? '#4a352f' : '#3f2b28';
  const rockLit = isDefeated ? '#837c75' : '#5c3a31';
  // The fire is the health bar: bright → dim → out.
  const flameOuter = isDefeated ? '#8d8d8d' : isHurt ? '#d9641f' : '#ff7a18';
  const flameInner = isDefeated ? '#b0b0b0' : isHurt ? '#f7c04a' : '#ffd54a';
  const emberOpacity = isDefeated ? 0 : isHurt ? 0.45 : 1;
  const glowOpacity = isDefeated ? 0.04 : isHurt ? 0.14 : 0.28;

  type MotionProps = {
    initial?: Record<string, unknown>;
    animate?: Record<string, unknown>;
    transition?: Record<string, unknown>;
    style?: Record<string, unknown>;
  };

  let wrapperProps: MotionProps = {};
  let flameProps: MotionProps = {};

  if (reduced) {
    if (isDefeated) {
      wrapperProps = { style: { opacity: 0.35, transform: 'translateY(10px)' } };
    }
    // intro / idle / damage → neutral upright, full opacity (default)
  } else {
    switch (state) {
      case 'intro':
        wrapperProps = {
          initial: { y: 34, opacity: 0, scale: 0.9 },
          animate: { y: 0, opacity: 1, scale: 1 },
          transition: { duration: 1.1, ease: 'easeOut' },
        };
        flameProps = {
          initial: { scaleY: 0.2, opacity: 0 },
          animate: { scaleY: 1, opacity: 1 },
          transition: { duration: 0.9, delay: 0.3, ease: 'easeOut' },
        };
        break;

      case 'idle':
        wrapperProps = {
          animate: { y: [0, -2.5, 0] },
          transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
        };
        flameProps = {
          animate: { scaleY: [1, 1.18, 0.94, 1], opacity: [1, 0.88, 1] },
          transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
        };
        break;

      case 'damage':
        wrapperProps = {
          animate: { x: [-6, 6, -4, 4, 0] },
          transition: { duration: 0.4, ease: 'easeOut' },
        };
        // Gutters rather than flares — a hit should look like it cost it fuel.
        flameProps = {
          animate: { scaleY: [1, 0.45, 0.8], opacity: [1, 0.5, 0.85] },
          transition: { duration: 0.4, ease: 'easeOut' },
        };
        break;

      case 'defeat':
        wrapperProps = {
          animate: { y: 14, scale: 0.94, opacity: 0.25 },
          transition: { duration: 1.1, ease: 'easeIn' },
        };
        flameProps = {
          animate: { scaleY: 0, opacity: 0 },
          transition: { duration: 0.7, ease: 'easeIn' },
        };
        break;
    }
  }

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="flame-titan"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* heat glow */}
            <ellipse cx="50" cy="42" rx="34" ry="26" fill="#ff7a18" opacity={glowOpacity} />

            {/* flame in the crater — scales from its base, so it shrinks
                downward like a dying fire rather than floating away */}
            <m.g
              style={{ transformOrigin: '50px 42px' }}
              {...(flameProps as Parameters<typeof m.g>[0])}
            >
              <path
                d="M 50 8 Q 60 24 57 34 Q 55 42 50 44 Q 45 42 43 34 Q 40 24 50 8 Z"
                fill={flameOuter}
              />
              <path
                d="M 50 18 Q 55 28 53 35 Q 51 40 50 41 Q 49 40 47 35 Q 45 28 50 18 Z"
                fill={flameInner}
              />
            </m.g>

            {/* mountain mass */}
            <path
              d="M 12 84 L 38 40 Q 44 31 50 40 L 62 40 L 88 84 Z"
              fill={rock}
              stroke="#241715"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* sunlit right face */}
            <path d="M 50 40 L 62 40 L 88 84 L 58 84 Z" fill={rockLit} opacity="0.55" />

            {/* lava cracks — the fire showing through the rock */}
            <path
              d="M 46 52 L 42 64 L 47 70 L 43 82"
              fill="none"
              stroke={flameOuter}
              strokeWidth="2"
              strokeLinecap="round"
              opacity={emberOpacity}
            />
            <path
              d="M 60 54 L 66 66 L 61 72 L 66 82"
              fill="none"
              stroke={flameOuter}
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity={emberOpacity * 0.8}
            />

            {/* crater rim */}
            <path
              d="M 38 40 Q 50 34 62 40"
              fill="none"
              stroke="#241715"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
