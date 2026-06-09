'use client';

// @deprecated PR #52 — coin gacha removed. File retained for one release.
//   Drop entirely in PR #53+ along with `pullPaid` action.

// src/components/play/GachaPullButton.tsx
import { useState, useTransition } from 'react';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { pullPaid } from '@/lib/actions/gacha';
import type { PullResult } from '@/lib/db/gacha';

interface Props {
  balance: number;
  cost: number;
  packSlug: string;
  childId: string;
  onResult: (result: PullResult) => void;
}

export function GachaPullButton({ balance, cost, packSlug, childId, onResult }: Props) {
  const [pending, startPullTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const insufficient = balance < cost;

  const handleClick = () => {
    startPullTransition(async () => {
      try {
        const result = await pullPaid(packSlug, { childId });
        onResult(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : '抽卡失败 / Draw failed');
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <WoodSignButton
        size="md"
        onClick={handleClick}
        disabled={insufficient || pending}
      >
        {pending ? '抽卡中… / Drawing…' : `抽卡 / Draw ${cost} 🪙`}
      </WoodSignButton>
      {error && <span className="text-xs text-[var(--color-bad)]">{error}</span>}
    </div>
  );
}
