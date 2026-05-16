// src/components/play/CollectionGrid.tsx
import { ZODIAC_SLUGS, type ZodiacSlug } from './zodiac-icons';
import { ZodiacCard } from './ZodiacCard';

interface Props {
  ownedSlugs: ZodiacSlug[];
  title?: string;
}

export function CollectionGrid({ ownedSlugs, title = '十二生肖' }: Props) {
  const ownedSet = new Set(ownedSlugs);
  return (
    <div className="rounded-2xl border border-[#c89f5e] bg-[linear-gradient(180deg,#f5ead0_0%,#ead7a8_100%)] p-5 max-w-md">
      <div className="mb-4 font-hanzi text-xl font-bold text-[#0c3d3a]">
        {title} · {ownedSlugs.length} / 12
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {ZODIAC_SLUGS.map((slug) => (
          <ZodiacCard key={slug} slug={slug} owned={ownedSet.has(slug)} size="md" />
        ))}
      </div>
    </div>
  );
}
