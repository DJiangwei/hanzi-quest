import Link from 'next/link';
import { PiggyJar } from '@/components/piggy/PiggyJar';

interface Props {
  childId: string;
  balancePence: number;
  /**
   * Whether the child's parent has opted into the piggy bank. The rule
   * lives HERE, not in the caller: "never show a reward she cannot have" is
   * a product rule, so every future caller inherits it automatically rather
   * than having to remember a page-level conditional.
   */
  enabled: boolean;
}

/**
 * The home entry point. Renders nothing when the piggy bank is disabled —
 * hidden entirely, never greyed out or teasing, because a child whose parent
 * has not opted in must not see a reward she cannot have.
 */
export function PiggyBankCard({ childId, balancePence, enabled }: Props) {
  if (!enabled) return null;

  return (
    <Link
      href={`/play/${childId}/piggy-bank`}
      data-testid="piggy-home-card"
      className="flex items-center justify-between rounded-2xl border-2 border-pink-200 bg-white/80 px-4 py-3 shadow-sm transition hover:border-pink-300"
    >
      <PiggyJar balancePence={balancePence} compact />
      <span className="text-xs text-stone-500" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
