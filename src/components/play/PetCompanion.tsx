'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

interface Pet {
  emoji: string;
  nameZh: string;
  nameEn: string;
  speechZh: string[];
  speechEn: string[];
}

interface Props {
  pet: Pet | null;
  size?: number;
}

export function PetCompanion({ pet, size = 56 }: Props) {
  const reduced = useReducedMotion();
  const [bubbleIndex, setBubbleIndex] = useState<number | null>(null);

  useEffect(() => {
    if (bubbleIndex === null) return;
    const t = setTimeout(() => setBubbleIndex(null), 2500);
    return () => clearTimeout(t);
  }, [bubbleIndex]);

  if (!pet) return null;

  const onTap = () => {
    if (pet.speechZh.length === 0) return;
    const i = Math.floor(Math.random() * pet.speechZh.length);
    setBubbleIndex(i);
  };

  return (
    <div className="relative">
      {bubbleIndex !== null && (
        <div
          className={`absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-xl border-2 border-amber-300 bg-white px-3 py-2 text-center shadow-lg ${reduced ? '' : 'animate-pet-bubble'}`}
          style={{ minWidth: 120 }}
        >
          <div className="text-sm font-bold text-amber-950">{pet.speechZh[bubbleIndex]}</div>
          <div className="text-xs text-amber-800">{pet.speechEn[bubbleIndex]}</div>
        </div>
      )}
      <button
        type="button"
        onClick={onTap}
        aria-label={`${pet.nameZh} / ${pet.nameEn}`}
        className={`flex items-center justify-center rounded-full bg-amber-100 shadow-sm transition-transform active:scale-95 ${reduced ? '' : 'animate-pet-bob'}`}
        style={{ width: size, height: size, fontSize: size * 0.6 }}
      >
        <span aria-hidden>{pet.emoji}</span>
      </button>
    </div>
  );
}
