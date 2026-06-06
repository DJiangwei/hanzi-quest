'use client';

import { useState, useTransition } from 'react';
import { DailyQuestRow } from './DailyQuestRow';
import { claimDailyChest } from '@/lib/actions/quests';

interface QuestCardProps {
  emoji: string;
  labelZh: string;
  progress: number;
  target: number;
  completed: boolean;
}

interface Props {
  childId: string;
  quests: QuestCardProps[];
  allDone: boolean;
  initialChestClaimed: boolean;
}

/**
 * Client wrapper for the daily quests row.
 * Handles chest-claim action + coin reveal overlay.
 */
export function DailyQuestsPanel({ childId, quests, allDone, initialChestClaimed }: Props) {
  const [chestClaimed, setChestClaimed] = useState(initialChestClaimed);
  const [coinsWon, setCoinsWon] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function handleClaimChest() {
    startTransition(async () => {
      try {
        const result = await claimDailyChest(childId);
        if (result.ok) {
          setChestClaimed(true);
          if (!result.alreadyClaimed) {
            setCoinsWon(result.coins);
            // Auto-hide the coin reveal after 2.5s
            setTimeout(() => setCoinsWon(null), 2500);
          }
        }
      } catch {
        // Swallow — the claim fails gracefully
      }
    });
  }

  return (
    <div className="relative">
      <DailyQuestRow
        quests={quests}
        allDone={allDone}
        chestClaimed={chestClaimed}
        onClaimChest={handleClaimChest}
      />
      {coinsWon !== null && (
        <div
          data-testid="chest-coin-reveal"
          className="absolute inset-x-0 bottom-full mb-2 flex justify-center"
        >
          <div className="rounded-2xl border-4 border-amber-400 bg-gradient-to-br from-amber-100 to-yellow-200 px-6 py-3 text-center shadow-xl">
            <div className="text-3xl">🎁</div>
            <div className="font-hanzi text-base font-extrabold text-amber-900">
              +{coinsWon} 🪙
            </div>
            <div className="text-xs font-semibold text-amber-800">宝箱奖励 / Chest reward</div>
          </div>
        </div>
      )}
    </div>
  );
}
