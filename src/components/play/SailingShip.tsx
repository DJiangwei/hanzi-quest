'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import type { VoyagePoint } from '@/lib/play/voyage-layout';

interface Props {
  /** Ordered stop centres (same array the medallions use). */
  points: VoyagePoint[];
  /** Index of the current (first not-yet-cleared) stop. */
  currentIndex: number;
}

/**
 * A little ship that sails the route. With motion enabled it glides through the
 * ordered stop points on a slow back-and-forth loop; with reduced-motion it
 * parks statically at the current stop. Purely decorative overlay (no pointer
 * events). Positioned by `left/top` % to match the medallion coordinate space.
 */
export function SailingShip({ points, currentIndex }: Props) {
  const reduced = useReducedMotion();
  if (points.length === 0) return null;

  const idx = Math.min(Math.max(currentIndex, 0), points.length - 1);
  const here = points[idx];

  if (reduced) {
    return (
      <div
        data-testid="sailing-ship"
        aria-hidden="true"
        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 text-2xl drop-shadow"
        style={{ left: `${here.xPct}%`, top: `${here.yPct}%` }}
      >
        ⛵
      </div>
    );
  }

  return (
    <motion.div
      data-testid="sailing-ship"
      aria-hidden="true"
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 text-2xl drop-shadow"
      initial={{ left: `${points[0].xPct}%`, top: `${points[0].yPct}%` }}
      animate={{
        left: points.map((p) => `${p.xPct}%`),
        top: points.map((p) => `${p.yPct}%`),
        rotate: [-5, 5, -5, 5, -5],
      }}
      transition={{
        duration: Math.max(8, points.length * 1.4),
        ease: 'easeInOut',
        repeat: Infinity,
        repeatType: 'reverse',
      }}
    >
      ⛵
    </motion.div>
  );
}
