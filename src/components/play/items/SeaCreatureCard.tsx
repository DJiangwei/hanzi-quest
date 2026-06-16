import type { CollectibleItem } from '@/lib/db/collections';
import { SEA_CREATURES_BY_SLUG } from '@/lib/collections/seaCreaturesData';
import { CardArt } from './CardArt';

export interface SeaCreatureCardProps {
  item: CollectibleItem;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the habitat/lore lines on the small grid view. */
  compact?: boolean;
}

const sizeClasses: Record<NonNullable<SeaCreatureCardProps['size']>, string> = {
  sm: 'p-2 gap-1',
  md: 'p-3 gap-1.5',
  lg: 'p-6 gap-2',
};

/**
 * One sea creature tile. Renders the emoji creature, name (CN+EN), and
 * (when not compact) the habitat + a one-line bilingual lore.
 *
 * Kids are English-native — both languages render side-by-side by default.
 * No language toggle.
 */
export function SeaCreatureCard({
  item,
  owned,
  size = 'md',
  compact = false,
}: SeaCreatureCardProps) {
  const meta = SEA_CREATURES_BY_SLUG[item.slug];
  const emoji = meta?.emoji ?? '🐚';
  const habitatZh = meta?.habitatZh ?? '';
  const habitatEn = meta?.habitatEn ?? '';

  return (
    <div
      data-testid="sea-creature-card"
      data-owned={owned ? 'true' : 'false'}
      data-size={size}
      className={[
        'relative flex flex-col items-center rounded-xl border-2',
        sizeClasses[size],
        owned
          ? 'border-teal-400 bg-gradient-to-b from-cyan-50 to-teal-100 shadow-[inset_0_0_0_2px_rgba(45,212,191,0.35),0_2px_4px_rgba(0,0,0,0.08)]'
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
      {!compact && habitatZh && (
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
            栖息地·{habitatZh}
          </div>
          <div className={size === 'lg' ? 'text-xs' : 'text-[9px]'}>
            Habitat · {habitatEn}
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
