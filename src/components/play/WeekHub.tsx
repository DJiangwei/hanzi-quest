import Link from 'next/link';
import { SectionCard } from './SectionCard';
import { BOSS_UNLOCK_PRACTICE_THRESHOLD } from '@/lib/scenes/configs';

interface Stat {
  done: number;
  total: number;
}
interface BossStat extends Stat {
  locked: boolean;
}

interface Props {
  childId: string;
  week: { id: string; weekNumber: number; label: string };
  sections: {
    review: Stat;
    practice: Stat;
    boss: BossStat;
  };
  /** weekId for View Transitions API morph with the island Link on the map */
  weekId?: string;
  homework?: { present: boolean; doneToday: boolean; count: number };
  /** T1: this week is the frontier — double coins + double first-boss cards. */
  frontier?: boolean;
}

function deriveState(done: number, total: number): 'idle' | 'in-progress' | 'cleared' {
  if (total === 0) return 'idle';
  if (done >= total) return 'cleared';
  if (done > 0) return 'in-progress';
  return 'idle';
}

export function WeekHub({ childId, week, sections, weekId, homework, frontier }: Props) {
  const reviewState = deriveState(sections.review.done, sections.review.total);
  const practiceState = deriveState(sections.practice.done, sections.practice.total);
  const bossState: 'idle' | 'in-progress' | 'cleared' | 'locked' = sections.boss.locked
    ? 'locked'
    : deriveState(sections.boss.done, sections.boss.total);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <header
        className="flex items-center justify-between gap-2"
        style={weekId ? { viewTransitionName: `island-${weekId}` } : undefined}
      >
        <Link
          href={`/play/${childId}`}
          className="rounded-lg border-2 border-amber-800/40 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100"
        >
          ← 航海图 / Map
        </Link>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-amber-900/70">
            Week {week.weekNumber}
          </div>
          <div className="text-base font-extrabold text-amber-950">{week.label}</div>
        </div>
      </header>

      {frontier && (
        <div
          data-testid="frontier-banner"
          className="rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-100 to-yellow-50 px-4 py-2.5 text-center shadow-sm"
        >
          <span className="font-hanzi text-sm font-extrabold text-amber-900">
            ✨ 双倍宝藏周!金币 ×2 · Boss 首通双卡
          </span>
          <span className="block text-xs font-medium text-amber-800/80">
            Double treasure island! 2× coins · 2 cards for the first boss win
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <SectionCard
          href={`/play/${childId}/level/${week.id}/review`}
          emoji="📖"
          titleZh="回顾"
          titleEn="Review"
          progressText={`${sections.review.done}/${sections.review.total}`}
          state={reviewState}
        />
        <SectionCard
          href={`/play/${childId}/level/${week.id}/practice`}
          emoji="✍️"
          titleZh="练习"
          titleEn="Practice"
          progressText={`${sections.practice.done}/${sections.practice.total}`}
          state={practiceState}
        />
        <SectionCard
          href={`/play/${childId}/level/${week.id}/boss`}
          emoji="🐙"
          titleZh="Boss 战"
          titleEn="Final Battle"
          progressText={
            sections.boss.locked
              ? '未解锁 / Locked'
              : `${sections.boss.done}/${sections.boss.total}`
          }
          state={bossState}
          lockedReason={
            sections.boss.locked
              ? `通过 ${BOSS_UNLOCK_PRACTICE_THRESHOLD} 关即可开启 / Beat ${BOSS_UNLOCK_PRACTICE_THRESHOLD} scenes to unlock`
              : undefined
          }
        />
        {homework?.present ? (
          <SectionCard
            href={`/play/${childId}/homework/${week.id}`}
            emoji="📚"
            titleZh="作业"
            titleEn="Homework"
            progressText={`${homework.count} 题 / items`}
            state={homework.doneToday ? 'cleared' : 'idle'}
          />
        ) : null}
      </div>
    </main>
  );
}
