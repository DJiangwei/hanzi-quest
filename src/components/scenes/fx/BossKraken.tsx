'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

type KrakenState = 'fighting' | 'winning';

interface Props {
  state: KrakenState;
  size?: number;
}

export function BossKraken({ state, size = 200 }: Props) {
  const reduced = useReducedMotion();
  const fill = state === 'winning' ? '#a83232' : '#1e4040';
  const inkFill = state === 'winning' ? '#7a2020' : '#0c2424';

  const tentacleWave = !reduced && state === 'fighting'
    ? { rotate: [-6, 6, -6] }
    : undefined;
  const transitionLoop = { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const };

  return (
    <LazyMotion features={domAnimation}>
      <div
        data-testid="boss-kraken"
        data-state={state}
        data-reduced={reduced ? 'true' : 'false'}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
          {/* Body */}
          <ellipse cx="50" cy="42" rx="22" ry="20" fill={fill} />
          {/* Body highlight */}
          <ellipse cx="50" cy="38" rx="14" ry="10" fill={inkFill} opacity="0.4" />
          {/* Two large eyes */}
          <circle cx="42" cy="40" r="4" fill="#fef9ef" />
          <circle cx="58" cy="40" r="4" fill="#fef9ef" />
          <circle cx="42" cy="40" r="2" fill="#0c0c0c" />
          <circle cx="58" cy="40" r="2" fill="#0c0c0c" />
          {/* Tentacles — 5 wavy paths anchored at body bottom */}
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
              transition={tentacleWave ? { ...transitionLoop, delay: i * 0.12 } : undefined}
            />
          ))}
        </svg>
      </div>
    </LazyMotion>
  );
}
