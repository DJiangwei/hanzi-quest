import type { CollectibleItem } from '@/lib/db/collections';
import {
  SOLAR_BODIES_BY_SLUG,
  TYPE_LABELS,
  type SolarBodyType,
} from '@/lib/collections/solarSystemData';
import { CardArt } from './CardArt';

export interface SolarBodyCardProps {
  item: CollectibleItem;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the type/lore lines on the small grid view. */
  compact?: boolean;
}

const sizeClasses: Record<NonNullable<SolarBodyCardProps['size']>, string> = {
  sm: 'p-2 gap-1',
  md: 'p-3 gap-1.5',
  lg: 'p-6 gap-2',
};


/**
 * Type → owned-state card classes. Helps the card distinguish stars from gas
 * giants from rocky planets from moons in the grid.
 */
const typeClassesOwned: Record<SolarBodyType, string> = {
  rocky:
    'border-stone-400 bg-gradient-to-b from-stone-50 to-stone-200 shadow-[inset_0_0_0_2px_rgba(168,162,158,0.35),0_2px_4px_rgba(0,0,0,0.08)]',
  gas:
    'border-amber-400 bg-gradient-to-b from-amber-50 to-orange-100 shadow-[inset_0_0_0_2px_rgba(251,191,36,0.35),0_2px_4px_rgba(0,0,0,0.08)]',
  ice:
    'border-sky-400 bg-gradient-to-b from-sky-50 to-blue-100 shadow-[inset_0_0_0_2px_rgba(56,189,248,0.35),0_2px_4px_rgba(0,0,0,0.08)]',
  star:
    'border-yellow-400 bg-gradient-to-b from-yellow-100 to-orange-200 shadow-[inset_0_0_0_2px_rgba(250,204,21,0.45),0_2px_4px_rgba(0,0,0,0.1)]',
  moon:
    'border-indigo-300 bg-gradient-to-b from-indigo-50 to-slate-100 shadow-[inset_0_0_0_2px_rgba(165,180,252,0.35),0_2px_4px_rgba(0,0,0,0.08)]',
};

const typeBadgeClass: Record<SolarBodyType, string> = {
  rocky: 'bg-stone-200 text-stone-800',
  gas: 'bg-amber-200 text-amber-900',
  ice: 'bg-sky-200 text-sky-900',
  star: 'bg-yellow-200 text-yellow-900',
  moon: 'bg-indigo-200 text-indigo-900',
};

/**
 * One solar-system body tile. Renders the emoji, bilingual name, type badge,
 * and (on `lg` + owned) bilingual lore.
 *
 * Kids are English-native — both languages render side-by-side by default.
 */
export function SolarBodyCard({
  item,
  owned,
  size = 'md',
  compact = false,
}: SolarBodyCardProps) {
  const meta = SOLAR_BODIES_BY_SLUG[item.slug];
  const emoji = meta?.emoji ?? '✨';
  const type = meta?.type;
  const typeLabel = type ? TYPE_LABELS[type] : null;

  return (
    <div
      data-testid="solar-body-card"
      data-owned={owned ? 'true' : 'false'}
      data-size={size}
      data-type={type ?? 'unknown'}
      className={[
        'relative flex flex-col items-center rounded-xl border-2',
        sizeClasses[size],
        owned
          ? type
            ? typeClassesOwned[type]
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
      {!compact && typeLabel && type && (
        <div
          className={[
            'mt-1 flex items-center gap-1 rounded-full px-2 py-0.5',
            size === 'lg' ? 'text-xs' : 'text-[9px]',
            owned ? typeBadgeClass[type] : 'bg-stone-200 text-stone-500',
          ].join(' ')}
        >
          <span className="font-hanzi">{typeLabel.zh}</span>
          <span aria-hidden="true">·</span>
          <span>{typeLabel.en}</span>
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
