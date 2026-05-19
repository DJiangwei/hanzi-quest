import type { CollectibleItem } from '@/lib/db/collections';
import { FLAGS_BY_SLUG } from '@/lib/collections/flagsData';

export interface FlagCardProps {
  item: CollectibleItem;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the capital/lore lines on the small grid view. */
  compact?: boolean;
}

const sizeClasses: Record<NonNullable<FlagCardProps['size']>, string> = {
  sm: 'p-2 gap-1',
  md: 'p-3 gap-1.5',
  lg: 'p-6 gap-2',
};

const flagSize: Record<NonNullable<FlagCardProps['size']>, string> = {
  sm: 'text-3xl',
  md: 'text-4xl',
  lg: 'text-7xl',
};

/**
 * One country tile. Renders the emoji flag, country name (CN+EN), and
 * (when not compact) the capital + a one-line bilingual lore.
 *
 * Yinuo is English-native — both languages render side-by-side by default.
 * No language toggle.
 */
export function FlagCard({
  item,
  owned,
  size = 'md',
  compact = false,
}: FlagCardProps) {
  const flagMeta = FLAGS_BY_SLUG[item.slug];
  const emoji = flagMeta?.emoji ?? item.imageUrl ?? '🏳️';
  const capitalZh = flagMeta?.capitalZh ?? '';
  const capitalEn = flagMeta?.capitalEn ?? '';

  return (
    <div
      data-testid="flag-card"
      data-owned={owned ? 'true' : 'false'}
      data-size={size}
      className={[
        'relative flex flex-col items-center rounded-xl border-2',
        sizeClasses[size],
        owned
          ? 'border-sky-400 bg-gradient-to-b from-sky-50 to-sky-100 shadow-[inset_0_0_0_2px_rgba(56,189,248,0.3),0_2px_4px_rgba(0,0,0,0.08)]'
          : 'border-stone-300 bg-stone-100',
      ].join(' ')}
    >
      <div
        className={[
          flagSize[size],
          'leading-none',
          owned ? '' : 'opacity-40 grayscale',
        ].join(' ')}
        aria-label={`${flagMeta?.nameEn ?? item.nameEn} flag`}
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
      {!compact && capitalZh && (
        <div
          className={[
            'mt-1 flex flex-col items-center text-center leading-tight',
            owned ? 'text-stone-700' : 'text-stone-400',
          ].join(' ')}
        >
          <div
            className={[
              'font-hanzi',
              size === 'lg' ? 'text-sm' : 'text-[10px]',
            ].join(' ')}
          >
            首都·{capitalZh}
          </div>
          <div
            className={size === 'lg' ? 'text-xs' : 'text-[9px]'}
          >
            Capital · {capitalEn}
          </div>
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
