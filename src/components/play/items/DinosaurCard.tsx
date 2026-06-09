import type { CollectibleItem } from '@/lib/db/collections';
import {
  DINOSAURS_BY_SLUG,
  ERA_LABELS,
  type DinosaurEra,
} from '@/lib/collections/dinosaursData';
import { CardArt } from './CardArt';

export interface DinosaurCardProps {
  item: CollectibleItem;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the era/lore lines on the small grid view. */
  compact?: boolean;
}

const sizeClasses: Record<NonNullable<DinosaurCardProps['size']>, string> = {
  sm: 'p-2 gap-1',
  md: 'p-3 gap-1.5',
  lg: 'p-6 gap-2',
};

/**
 * Era → owned-state classes. Only two dinosaur emojis exist (🦖, 🦕), so
 * the visual distinction between cards comes from era color-coding.
 */
const eraClassesOwned: Record<DinosaurEra, string> = {
  triassic:
    'border-orange-400 bg-gradient-to-b from-orange-50 to-amber-100 shadow-[inset_0_0_0_2px_rgba(251,146,60,0.35),0_2px_4px_rgba(0,0,0,0.08)]',
  jurassic:
    'border-emerald-400 bg-gradient-to-b from-emerald-50 to-green-100 shadow-[inset_0_0_0_2px_rgba(52,211,153,0.35),0_2px_4px_rgba(0,0,0,0.08)]',
  cretaceous:
    'border-rose-400 bg-gradient-to-b from-rose-50 to-amber-100 shadow-[inset_0_0_0_2px_rgba(251,113,133,0.35),0_2px_4px_rgba(0,0,0,0.08)]',
};

const eraBadgeClass: Record<DinosaurEra, string> = {
  triassic: 'bg-orange-200 text-orange-900',
  jurassic: 'bg-emerald-200 text-emerald-900',
  cretaceous: 'bg-rose-200 text-rose-900',
};

/**
 * One dinosaur tile. Renders the emoji, bilingual name, era badge, and
 * (on `lg` + owned) bilingual lore.
 *
 * Yinuo is English-native — both languages render side-by-side by default.
 */
export function DinosaurCard({
  item,
  owned,
  size = 'md',
  compact = false,
}: DinosaurCardProps) {
  const meta = DINOSAURS_BY_SLUG[item.slug];
  const emoji = meta?.emoji ?? '🦴';
  const era = meta?.era;
  const eraLabel = era ? ERA_LABELS[era] : null;

  return (
    <div
      data-testid="dinosaur-card"
      data-owned={owned ? 'true' : 'false'}
      data-size={size}
      data-era={era ?? 'unknown'}
      className={[
        'relative flex flex-col items-center rounded-xl border-2',
        sizeClasses[size],
        owned
          ? era
            ? eraClassesOwned[era]
            : 'border-stone-300 bg-stone-50'
          : 'border-stone-300 bg-stone-100',
      ].join(' ')}
    >
      <CardArt
        imageUrl={item.imageUrl}
        emoji={emoji}
        owned={owned}
        size={size}
        alt={meta?.nameEn ?? item.nameEn}
      />
      <div
        className={[
          'mt-0.5 flex flex-col items-center gap-0',
          owned ? 'text-stone-900' : 'text-stone-500',
        ].join(' ')}
      >
        <div
          className={[
            'font-hanzi font-bold leading-tight',
            size === 'sm'
              ? 'text-[12px]'
              : size === 'md'
                ? 'text-sm'
                : 'text-xl',
          ].join(' ')}
        >
          {item.nameZh}
        </div>
        <div
          className={[
            'leading-tight',
            size === 'sm'
              ? 'text-[10px]'
              : size === 'md'
                ? 'text-[11px]'
                : 'text-sm',
          ].join(' ')}
        >
          {item.nameEn}
        </div>
      </div>
      {!compact && eraLabel && era && (
        <div
          className={[
            'mt-1 flex items-center gap-1 rounded-full px-2 py-0.5',
            size === 'lg' ? 'text-xs' : 'text-[9px]',
            owned ? eraBadgeClass[era] : 'bg-stone-200 text-stone-500',
          ].join(' ')}
        >
          <span className="font-hanzi">{eraLabel.zh}</span>
          <span aria-hidden="true">·</span>
          <span>{eraLabel.en}</span>
        </div>
      )}
      {size === 'lg' && owned && item.loreZh && (
        <p className="mt-2 max-w-xs px-2 text-center text-sm leading-relaxed text-stone-800">
          <span className="block font-hanzi">{item.loreZh}</span>
          <span className="block text-xs italic text-stone-600">
            {item.loreEn}
          </span>
        </p>
      )}
      {!owned && (
        <span className="absolute right-1 top-1 text-sm" aria-hidden="true">
          🔒
        </span>
      )}
    </div>
  );
}
