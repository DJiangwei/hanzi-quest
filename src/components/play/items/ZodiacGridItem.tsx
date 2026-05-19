import type { CollectibleItem } from '@/lib/db/collections';
import { ZodiacCard } from '@/components/play/ZodiacCard';
import type { ZodiacSlug } from '@/components/play/zodiac-icons';

interface Props {
  item: CollectibleItem;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

/**
 * Adapter so the existing ZodiacCard conforms to the generic
 * pack-item-card signature used by `PackGrid`.
 */
export function ZodiacGridItem({ item, owned, size = 'md', compact }: Props) {
  return (
    <ZodiacCard
      slug={item.slug as ZodiacSlug}
      owned={owned}
      size={size}
      showName={!compact}
    />
  );
}
