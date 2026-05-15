'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import type { ReactNode } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

interface Props {
  triggerKey: number;
  children: ReactNode;
}

const shake = {
  x: [0, -8, 8, -8, 8, -4, 4, 0],
};

export function ShakeWrap({ triggerKey, children }: Props) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        key={triggerKey}
        animate={shake}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
