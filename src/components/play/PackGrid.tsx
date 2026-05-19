import type { CollectibleItem } from '@/lib/db/collections';
import type { PackUiMeta } from '@/lib/collections/packRegistry';

interface Props {
  items: CollectibleItem[];
  ownedItemIds: Set<string>;
  meta: PackUiMeta;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

const colClass: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

/**
 * Generic per-pack grid. The per-item renderer is supplied by the pack
 * registry, so this component doesn't know about zodiac vs flags vs anything
 * else — it just lays out tiles.
 */
export function PackGrid({
  items,
  ownedItemIds,
  meta,
  size = 'md',
  compact = false,
}: Props) {
  const Card = meta.ItemCard;
  const gridCols = colClass[meta.gridColumns] ?? 'grid-cols-3';
  return (
    <div
      data-testid="pack-grid"
      className={`grid ${gridCols} gap-2.5`}
    >
      {items.map((item) => (
        <Card
          key={item.id}
          item={item}
          owned={ownedItemIds.has(item.id)}
          size={size}
          compact={compact}
        />
      ))}
    </div>
  );
}
