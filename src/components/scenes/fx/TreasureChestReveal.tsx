'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useEffect, useState } from 'react';
import { playSound } from '@/lib/audio/play';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { ZodiacIcon, type ZodiacSlug } from '@/components/play/zodiac-icons';

interface RevealItem {
  id: string;
  slug: ZodiacSlug;
  nameZh: string;
  nameEn: string;
  loreZh: string | null;
  loreEn: string | null;
}

interface Props {
  item: RevealItem;
  wasDuplicate: boolean;
  shardsAfter: number | null;
}

type Phase = 'shake' | 'open' | 'reveal';

export function TreasureChestReveal({ item, wasDuplicate, shardsAfter }: Props) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduced ? 'reveal' : 'shake');

  useEffect(() => {
    if (reduced) return;
    playSound('fanfare');
    const t1 = setTimeout(() => setPhase('open'), 800);
    const t2 = setTimeout(() => setPhase('reveal'), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reduced]);

  return (
    <LazyMotion features={domAnimation}>
      <div className="flex flex-col items-center gap-4 py-6">
        {phase !== 'reveal' && (
          <m.div
            className="text-7xl"
            animate={phase === 'shake' ? { x: [-4, 4, -4, 4, -2, 2, 0] } : undefined}
            transition={phase === 'shake' ? { duration: 0.8, repeat: Infinity } : undefined}
            aria-hidden="true"
          >
            🎁
          </m.div>
        )}

        {phase === 'reveal' && (
          <m.div
            initial={reduced ? false : { scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="rounded-2xl border-[3px] border-[#c89f5e] p-6 shadow-[inset_0_0_0_2px_rgba(245,197,55,0.6),0_4px_10px_rgba(0,0,0,0.15)] [background:radial-gradient(ellipse_at_center,#fef9ef_0%,#fef9ef_70%,#f5d875_100%)]"
            style={{ width: 260 }}
          >
            <div className="mx-auto mb-3 h-32 w-32">
              <ZodiacIcon slug={item.slug} className="h-full w-full" />
            </div>
            <div className="text-center font-hanzi text-4xl font-bold text-[#0c3d3a]">
              {item.nameZh}
            </div>
            <div className="mt-1 text-center text-base font-medium text-[#6b4720]">
              {item.nameEn}
            </div>
            {item.loreZh && (
              <div className="mt-2 text-center text-xs text-[#6b4720]">
                {item.loreZh}
              </div>
            )}

            {wasDuplicate && (
              <div className="mt-3 text-center text-sm font-semibold text-[#d05a1c]">
                +1 卡屑{shardsAfter !== null ? ` · ${shardsAfter}/100` : ''}
              </div>
            )}
          </m.div>
        )}
      </div>
    </LazyMotion>
  );
}
