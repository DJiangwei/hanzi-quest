import Link from 'next/link';
import type { SeasonBannerState } from '@/lib/db/season';

/**
 * Compact Season Pass banner on the home page (below the Daily Quests panel).
 * Server-safe (a plain Link, no hooks). Renders nothing when no season is active.
 * Bilingual chrome per the locked rule.
 */
export function SeasonBanner({
  childId,
  state,
}: {
  childId: string;
  state: SeasonBannerState | null;
}) {
  if (!state) return null;
  return (
    <Link
      href={`/play/${childId}/season`}
      className="flex items-center justify-between gap-2 rounded-2xl border-2 border-teal-300 bg-gradient-to-r from-cyan-100 to-teal-100 px-4 py-2.5 shadow-sm"
    >
      <span className="flex items-center gap-2 font-hanzi text-sm font-bold text-teal-900">
        <span className="text-xl" aria-hidden="true">
          {state.themeEmoji}
        </span>
        <span>
          {state.nameZh} / {state.nameEn}
        </span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">
          Tier {state.currentTier}/{state.totalTiers}
        </span>
      </span>
      {state.claimableCount > 0 ? (
        <span className="animate-bonus-pop rounded-full bg-amber-400 px-2.5 py-1 text-xs font-extrabold text-amber-900">
          🎁 {state.claimableCount} 可领 / Claim
        </span>
      ) : state.xpToNext !== null ? (
        <span className="text-xs font-semibold text-teal-700">
          还需 {state.xpToNext} XP / to next
        </span>
      ) : (
        <span className="text-xs font-semibold text-teal-700">
          已满级 / Maxed
        </span>
      )}
    </Link>
  );
}
