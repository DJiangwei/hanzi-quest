'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * Giant Clam — creature #7 in the boss roster.
 *
 * 4-state animation model:
 *  intro   — shell rises closed then top half opens to reveal pearl (~1.1s ease-out, one-shot)
 *  idle    — top shell "breathes" (open/close rotate loop) + pearl shimmer (opacity/scale pulse)
 *  damage  — shell snaps shut (top rotates closed) + brightness flash (~0.4s one-shot)
 *  defeat  — shell cracks fully open, pearl dims, whole creature sinks (~1.1s ease-in)
 *
 * Reduced-motion: all loops and transitions disabled; defeat = low-opacity sunk static pose.
 */
export function GiantClam({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Colours ─────────────────────────────────────────────────────────────
  const shellOuter = '#c97c3a';
  const shellInner = '#f7cfa0';
  const shellRidge = '#a8602a';
  const pearlColor = '#e8e4f4';
  const pearlAura = '#c8b8e8';

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
          animate: { y: [0, -1.5, 0] },
          transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
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

  // ── Top shell motion (idle: breathe open/close; damage: snap shut) ───────
  let topShellProps: MotionProps = {};
  if (!reduced) {
    if (state === 'idle') {
      topShellProps = {
        animate: { rotate: [-18, -4, -18] },
        transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
      };
    } else if (state === 'damage') {
      topShellProps = {
        animate: { rotate: [0, -18] },
        transition: { duration: 0.2, ease: 'easeIn' },
      };
    } else if (state === 'defeat') {
      topShellProps = {
        animate: { rotate: [0, -38] },
        transition: { duration: 0.8, ease: 'easeOut' },
      };
    }
  }

  // ── Pearl shimmer (idle only) ────────────────────────────────────────────
  const pearlProps =
    !reduced && state === 'idle'
      ? {
          animate: { scale: [1, 1.1, 1], opacity: [0.85, 1, 0.85] },
          transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const },
        }
      : {};

  const pearlVisible = state !== 'damage';

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="giant-clam"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* ── Bottom shell half ── */}
            <ellipse cx="50" cy="68" rx="34" ry="16" fill={shellOuter} />
            {/* Bottom shell inner lip */}
            <ellipse cx="50" cy="64" rx="28" ry="10" fill={shellInner} opacity="0.7" />
            {/* Bottom ridges */}
            {[-18, -9, 0, 9, 18].map((offset, i) => (
              <line
                key={i}
                x1={50 + offset}
                y1={68}
                x2={50 + offset * 1.3}
                y2={82}
                stroke={shellRidge}
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.6"
              />
            ))}

            {/* ── Top shell half (rotates open/closed around hinge at cx=50 cy=68) ── */}
            <m.g
              style={{ originX: '50px', originY: '68px' }}
              {...(topShellProps as Parameters<typeof m.g>[0])}
            >
              <ellipse cx="50" cy="50" rx="34" ry="20" fill={shellOuter} />
              {/* Top shell inner */}
              <ellipse cx="50" cy="54" rx="28" ry="14" fill={shellInner} opacity="0.55" />
              {/* Top ridges */}
              {[-18, -9, 0, 9, 18].map((offset, i) => (
                <line
                  key={i}
                  x1={50 + offset}
                  y1={34}
                  x2={50 + offset * 0.7}
                  y2={50}
                  stroke={shellRidge}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  opacity="0.6"
                />
              ))}
              {/* Shell opening edge highlight */}
              <ellipse cx="50" cy="68" rx="34" ry="5" fill={shellRidge} opacity="0.35" />
            </m.g>

            {/* ── Pearl (inside the shell) ── */}
            {pearlVisible && (
              <m.g
                style={{ originX: '50px', originY: '60px' }}
                {...(pearlProps as Parameters<typeof m.g>[0])}
              >
                {/* Aura glow */}
                <circle cx="50" cy="60" r="10" fill={pearlAura} opacity="0.35" />
                {/* Pearl body */}
                <circle cx="50" cy="60" r="7" fill={pearlColor} />
                {/* Pearl highlight */}
                <circle cx="47" cy="57" r="2.5" fill="#ffffff" opacity="0.65" />
              </m.g>
            )}

            {/* ── Eyes inside the shell ── */}
            <circle cx="43" cy="61" r="2.5" fill="#ffffff" />
            <circle cx="57" cy="61" r="2.5" fill="#ffffff" />
            <circle cx="43" cy="61" r="1.2" fill="#1a1a1a" />
            <circle cx="57" cy="61" r="1.2" fill="#1a1a1a" />
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
