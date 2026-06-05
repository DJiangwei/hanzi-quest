'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { BossCreatureProps } from './types';

/**
 * Whirlpool Spirit — creature #9 in the boss roster.
 *
 * 4-state animation model:
 *  intro   — whirlpool rises from below, scales in (~1.1s ease-out, one-shot)
 *  idle    — the entire spiral rotates continuously (rotate: 360, infinite linear) — its signature
 *  damage  — vortex wobbles (scale/skew pop) + brightness flash (~0.4s one-shot)
 *  defeat  — spiral unwinds (scale up + opacity→0) and disperses (~1.1s ease-in)
 *
 * Reduced-motion: all loops and transitions disabled; defeat = low-opacity sunk static pose.
 */
export function Whirlpool({ state, size = 200 }: BossCreatureProps) {
  const reduced = useReducedMotion();

  // ── Colours ─────────────────────────────────────────────────────────────
  const outerBlue = '#1a6aa8';
  const midBlue = '#2a8fd6';
  const innerBlue = '#4ab8f0';
  const foamWhite = '#c8eaf8';

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
        // Signature: continuous rotation
        wrapperProps = {
          animate: { rotate: 360 },
          transition: { duration: 4.0, repeat: Infinity, ease: 'linear' },
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
        // Spiral unwinds — scale up + fade out
        wrapperProps = {
          animate: { scale: 1.8, opacity: 0 },
          transition: { duration: 1.1, ease: 'easeIn' },
        };
        break;
    }
  }

  // ── Spiral arc helper — produces partial circle paths for vortex rings ───
  // Each ring is a thick arc arc occupying ~270° of a circle.
  // Using SVG arc commands: M start A rx ry 0 large-arc-flag sweep x2 y2
  const spiralArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-creature"
        data-creature="whirlpool"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <m.div
          className="h-full w-full"
          {...(wrapperProps as Parameters<typeof m.div>[0])}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
            {/* ── Outer spiral arc (270°, outermost ring) ── */}
            <path
              d={spiralArc(50, 50, 38, -60, 210)}
              stroke={outerBlue}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              opacity="0.85"
            />
            {/* Foam crest on outer arc */}
            <path
              d={spiralArc(50, 50, 38, -30, 30)}
              stroke={foamWhite}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.55"
            />

            {/* ── Mid spiral arc (240°, mid ring) ── */}
            <path
              d={spiralArc(50, 50, 25, -90, 150)}
              stroke={midBlue}
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              opacity="0.9"
            />
            {/* Foam crest on mid arc */}
            <path
              d={spiralArc(50, 50, 25, -60, 0)}
              stroke={foamWhite}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.5"
            />

            {/* ── Inner spiral arc (210°, innermost ring) ── */}
            <path
              d={spiralArc(50, 50, 13, -120, 90)}
              stroke={innerBlue}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              opacity="0.95"
            />

            {/* ── Dark vortex center pool ── */}
            <circle cx="50" cy="50" r="7" fill={outerBlue} opacity="0.7" />
            <circle cx="50" cy="50" r="4" fill="#0a2a40" opacity="0.9" />

            {/* ── Eyes near the center ── */}
            {/* Eyes must be outside the rotating group to stay upright —
                but since the whole wrapper rotates, eyes are intentionally
                part of the vortex design and rotate with it (surreal effect) */}
            <circle cx="46" cy="48" r="2.5" fill="#fef9ef" />
            <circle cx="54" cy="48" r="2.5" fill="#fef9ef" />
            <circle cx="46" cy="48" r="1.3" fill="#0c0c1a" />
            <circle cx="54" cy="48" r="1.3" fill="#0c0c1a" />
            {/* Tiny eye gleam */}
            <circle cx="45.4" cy="47.4" r="0.5" fill="#ffffff" opacity="0.8" />
            <circle cx="53.4" cy="47.4" r="0.5" fill="#ffffff" opacity="0.8" />
          </svg>
        </m.div>
      </div>
    </LazyMotion>
  );
}
