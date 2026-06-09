import type { CollectibleItem } from '@/lib/db/collections';
import { CONTINENT_LABELS } from '@/lib/collections/flagsData';
import { LANDMARKS_BY_SLUG } from '@/lib/collections/landmarksData';

export interface LandmarkCardProps {
  item: CollectibleItem;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the location/lore lines on the small grid view. */
  compact?: boolean;
}

const sizeClasses: Record<NonNullable<LandmarkCardProps['size']>, string> = {
  sm: 'p-2 gap-1',
  md: 'p-3 gap-1.5',
  lg: 'p-6 gap-2',
};

const emojiSize: Record<NonNullable<LandmarkCardProps['size']>, string> = {
  sm: 'text-3xl',
  md: 'text-4xl',
  lg: 'text-7xl',
};

/**
 * One landmark tile. Renders the emoji, bilingual name, location (city·country),
 * a continent badge, and — at `lg` + owned — a bilingual fun fact.
 *
 * Yinuo is English-native — both languages render side-by-side. No toggle.
 */
export function LandmarkCard({
  item,
  owned,
  size = 'md',
  compact = false,
}: LandmarkCardProps) {
  const meta = LANDMARKS_BY_SLUG[item.slug];
  const emoji = meta?.emoji ?? item.imageUrl ?? '📍';
  const locationZh = meta?.locationZh ?? '';
  const locationEn = meta?.locationEn ?? '';
  const continent = meta?.continent;
  const continentLabel = continent ? CONTINENT_LABELS[continent] : null;

  return (
    <div
      data-testid="landmark-card"
      data-owned={owned ? 'true' : 'false'}
      data-size={size}
      className={[
        'relative flex flex-col items-center rounded-xl border-2',
        sizeClasses[size],
        owned
          ? 'border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100 shadow-[inset_0_0_0_2px_rgba(251,191,36,0.3),0_2px_4px_rgba(0,0,0,0.08)]'
          : 'border-stone-300 bg-stone-100',
      ].join(' ')}
    >
      <div
        className={[
          emojiSize[size],
          'leading-none',
          owned ? '' : 'opacity-40 grayscale',
        ].join(' ')}
        aria-label={`${meta?.nameEn ?? item.nameEn}`}
      >
        {emoji}
      </div>
      <div
        className={[
          'mt-0.5 flex flex-col items-center gap-0',
          owned ? 'text-stone-900' : 'text-stone-500',
        ].join(' ')}
      >
        <div
          className={[
            'font-hanzi font-bold leading-tight',
            size === 'sm' ? 'text-[12px]' : size === 'md' ? 'text-sm' : 'text-xl',
          ].join(' ')}
        >
          {item.nameZh}
        </div>
        <div
          className={[
            'leading-tight',
            size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-[11px]' : 'text-sm',
          ].join(' ')}
        >
          {item.nameEn}
        </div>
      </div>

      {!compact && continentLabel && (
        <div
          className={[
            'mt-1 flex items-center gap-1 rounded-full px-2 py-0.5',
            size === 'lg' ? 'text-xs' : 'text-[9px]',
            owned ? 'bg-amber-200 text-amber-900' : 'bg-stone-200 text-stone-500',
          ].join(' ')}
        >
          <span aria-hidden="true">{continentLabel.emoji}</span>
          <span className="font-hanzi">{continentLabel.zh}</span>
          <span aria-hidden="true">·</span>
          <span>{continentLabel.en}</span>
        </div>
      )}

      {!compact && locationZh && (
        <div
          className={[
            'mt-0.5 flex flex-col items-center text-center leading-tight',
            owned ? 'text-stone-700' : 'text-stone-400',
          ].join(' ')}
        >
          <div className={['font-hanzi', size === 'lg' ? 'text-sm' : 'text-[10px]'].join(' ')}>
            📍 {locationZh}
          </div>
          <div className={size === 'lg' ? 'text-xs' : 'text-[9px]'}>{locationEn}</div>
        </div>
      )}

      {size === 'lg' && owned && item.loreZh && (
        <p className="mt-2 max-w-xs px-2 text-center text-sm leading-relaxed text-stone-800">
          <span className="block font-hanzi">{item.loreZh}</span>
          <span className="block text-xs italic text-stone-600">{item.loreEn}</span>
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
