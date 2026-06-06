'use client';

interface Props {
  emoji: string;
  labelZh: string;
  progress: number;
  target: number;
  completed: boolean;
}

/**
 * Single daily-quest card showing emoji, label, progress bar and completion state.
 */
export function DailyQuestCard({ emoji, labelZh, progress, target, completed }: Props) {
  const pct = Math.min(progress / target, 1) * 100;

  return (
    <div
      data-testid="daily-quest-card"
      className={[
        'flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center',
        completed
          ? 'border-[var(--color-treasure-400)] bg-[var(--color-treasure-50)]'
          : 'border-[var(--color-sand-200)] bg-white/80',
      ].join(' ')}
    >
      <span className="text-xl" aria-hidden="true">
        {emoji}
      </span>
      <span className="font-hanzi text-[11px] font-semibold leading-tight text-[var(--color-ocean-900)]">
        {labelZh}
      </span>
      {completed ? (
        <span
          data-testid="quest-completed-checkmark"
          className="text-base font-bold text-[var(--color-treasure-600)]"
          aria-label="completed"
        >
          ✓
        </span>
      ) : (
        <>
          <span className="text-[10px] text-[var(--color-sand-700)]">
            {progress}/{target}
          </span>
          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-sand-200)]">
            <div
              data-testid="quest-progress-bar"
              className="h-full rounded-full bg-[var(--color-ocean-500)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
