'use client';

// src/components/play/CollectionPageBody.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionGrid } from './CollectionGrid';
import { GachaPullButton } from './GachaPullButton';
import { TreasureChestReveal } from '@/components/scenes/fx/TreasureChestReveal';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import type { PullResult } from '@/lib/db/gacha';
import type { ZodiacSlug } from './zodiac-icons';

interface Props {
  childId: string;
  packSlug: string;
  ownedSlugs: ZodiacSlug[];
  balance: number;
}

const PAID_PULL_COST = 500;

export function CollectionPageBody({ childId, packSlug, ownedSlugs, balance }: Props) {
  const router = useRouter();
  const [reveal, setReveal] = useState<PullResult | null>(null);

  if (reveal) {
    return (
      <div className="flex flex-col items-center gap-4">
        <TreasureChestReveal
          item={{
            id: reveal.item.id,
            slug: reveal.item.slug as ZodiacSlug,
            nameZh: reveal.item.nameZh,
            nameEn: reveal.item.nameEn,
            loreZh: reveal.item.loreZh,
            loreEn: reveal.item.loreEn,
          }}
          wasDuplicate={reveal.wasDuplicate}
          shardsAfter={reveal.shardsAfter}
        />
        <WoodSignButton
          size="lg"
          onClick={() => {
            setReveal(null);
            router.refresh();
          }}
        >
          再看一眼
        </WoodSignButton>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <WoodSignButton
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/play/${childId}`)}
        >
          ← 回地图
        </WoodSignButton>
        <span className="text-sm font-semibold text-[var(--color-treasure-700)]">
          🪙 {balance}
        </span>
      </div>
      <GachaPullButton
        balance={balance}
        cost={PAID_PULL_COST}
        packSlug={packSlug}
        childId={childId}
        onResult={setReveal}
      />
      <CollectionGrid ownedSlugs={ownedSlugs} />
    </div>
  );
}
