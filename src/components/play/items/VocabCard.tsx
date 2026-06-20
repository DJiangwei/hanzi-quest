import type { CollectibleItem } from '@/lib/db/collections';
import { CardArt } from './CardArt';

interface VocabMetaEntry {
  nameZh: string;
  nameEn: string;
  emoji: string;
  group?: string;
}

interface GroupLabel {
  zh: string;
  en: string;
  emoji: string;
}

export interface VocabCardProps {
  item: CollectibleItem;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

const sizeClasses: Record<NonNullable<VocabCardProps['size']>, string> = {
  sm: 'p-2 gap-1',
  md: 'p-3 gap-1.5',
  lg: 'p-6 gap-2',
};

/**
 * Factory producing a per-pack collectible card. Mirrors LandmarkCard: emoji /
 * real art via CardArt, bilingual name, an optional group badge (陆地/水上/天空,
 * 西洋/民族…), and a bilingual lore line at lg+owned. Keeps all 4 vocab packs
 * DRY — each pack file is a 3-line factory call.
 */
export function makeVocabCard(opts: {
  bySlug: Record<string, VocabMetaEntry>;
  fallbackEmoji: string;
  groupLabels?: Record<string, GroupLabel>;
  testId: string;
}) {
  return function VocabCard({ item, owned, size = 'md', compact = false }: VocabCardProps) {
    const meta = opts.bySlug[item.slug];
    const emoji = meta?.emoji ?? opts.fallbackEmoji;
    const groupLabel = meta?.group && opts.groupLabels ? opts.groupLabels[meta.group] : null;
    return (
      <div
        data-testid={opts.testId}
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
        <CardArt imageUrl={item.imageUrl} emoji={emoji} owned={owned} size={size} alt={meta?.nameEn ?? item.nameEn} />
        <div className={['mt-0.5 flex flex-col items-center gap-0', owned ? 'text-stone-900' : 'text-stone-500'].join(' ')}>
          <div className={['font-hanzi font-bold leading-tight', size === 'sm' ? 'text-[12px]' : size === 'md' ? 'text-sm' : 'text-xl'].join(' ')}>
            {item.nameZh}
          </div>
          <div className={['leading-tight', size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-[11px]' : 'text-sm'].join(' ')}>
            {item.nameEn}
          </div>
        </div>

        {!compact && groupLabel && (
          <div className={['mt-1 flex items-center gap-1 rounded-full px-2 py-0.5', size === 'lg' ? 'text-xs' : 'text-[9px]', owned ? 'bg-amber-200 text-amber-900' : 'bg-stone-200 text-stone-500'].join(' ')}>
            <span aria-hidden="true">{groupLabel.emoji}</span>
            <span className="font-hanzi">{groupLabel.zh}</span>
            <span aria-hidden="true">·</span>
            <span>{groupLabel.en}</span>
          </div>
        )}

        {size === 'lg' && owned && item.loreZh && (
          <p className="mt-2 max-w-xs px-2 text-center text-sm leading-relaxed text-stone-800">
            <span className="block font-hanzi">{item.loreZh}</span>
            <span className="block text-xs italic text-stone-600">{item.loreEn}</span>
          </p>
        )}

        {!owned && (
          <span className="absolute right-1 top-1 text-sm" aria-hidden="true">🔒</span>
        )}
      </div>
    );
  };
}
