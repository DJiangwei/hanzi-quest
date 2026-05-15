'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useMemo, type RefObject } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

interface Props {
  count?: number;
  originRect?: DOMRect | null;
  targetEl?: RefObject<HTMLElement | null>;
  onComplete?: () => void;
}

interface CoinSpec {
  id: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  delay: number;
}

const SCATTER_PX = 24;

function buildCoins(
  count: number,
  originRect: DOMRect | null | undefined,
  targetEl: RefObject<HTMLElement | null> | undefined,
): CoinSpec[] {
  const ox = originRect ? originRect.left + originRect.width / 2 : window.innerWidth / 2;
  const oy = originRect ? originRect.top + originRect.height / 2 : window.innerHeight / 2;

  let tx: number | null = null;
  let ty: number | null = null;
  if (targetEl?.current) {
    const r = targetEl.current.getBoundingClientRect();
    tx = r.left + r.width / 2;
    ty = r.top + r.height / 2;
  }

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    startX: ox,
    startY: oy,
    dx: tx !== null ? tx - ox : (Math.random() - 0.5) * SCATTER_PX,
    dy: ty !== null ? ty - oy : -120,
    delay: i * 0.08,
  }));
}

export function CoinShower({ count = 5, originRect, targetEl, onComplete }: Props) {
  const reduced = useReducedMotion();

  const coins = useMemo<CoinSpec[]>(() => {
    if (reduced) return [];
    return buildCoins(count, originRect, targetEl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduced) {
    onComplete?.();
    return null;
  }

  return (
    <LazyMotion features={domAnimation}>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
        {coins.map((c) => (
          <m.div
            key={c.id}
            data-testid="coin"
            initial={{ x: c.startX - 9, y: c.startY - 9, scale: 0.3, opacity: 0 }}
            animate={{
              x: c.startX - 9 + c.dx,
              y: c.startY - 9 + c.dy,
              scale: 1,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 0.9,
              delay: c.delay,
              ease: 'easeOut',
              times: [0, 0.2, 0.8, 1],
            }}
            onAnimationComplete={c.id === count - 1 ? onComplete : undefined}
            className="absolute h-[18px] w-[18px] rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, #f5d875, #c9930b 70%, #6b4720)',
            }}
          />
        ))}
      </div>
    </LazyMotion>
  );
}
