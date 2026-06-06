'use client';

import { DailyQuestCard } from './DailyQuestCard';

interface QuestCardProps {
  emoji: string;
  labelZh: string;
  progress: number;
  target: number;
  completed: boolean;
}

interface Props {
  quests: QuestCardProps[];
  allDone: boolean;
  chestClaimed: boolean;
  onClaimChest: () => void;
}

/**
 * Row of 3 daily quest cards + a chest claim affordance when all are done.
 */
export function DailyQuestRow({ quests, allDone, chestClaimed, onClaimChest }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-2">
        {quests.map((q, i) => (
          <DailyQuestCard key={i} {...q} />
        ))}
      </div>

      {allDone && !chestClaimed && (
        <button
          data-testid="daily-chest-button"
          onClick={onClaimChest}
          className="w-full rounded-xl border-2 border-[var(--color-treasure-400)] bg-gradient-to-r from-amber-100 to-yellow-100 px-4 py-2.5 text-sm font-bold text-[var(--color-treasure-700)] shadow-sm transition-all hover:shadow-md active:scale-95"
        >
          🎁 领取今日宝箱 / Claim daily chest
        </button>
      )}

      {chestClaimed && (
        <p
          data-testid="daily-chest-claimed"
          className="text-center text-xs font-semibold text-[var(--color-sand-600)]"
        >
          🎁 明日再来 / Come back tomorrow
        </p>
      )}
    </div>
  );
}
