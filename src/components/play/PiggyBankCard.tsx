import Link from 'next/link';
import { PiggyJar } from '@/components/piggy/PiggyJar';

interface Props {
  childId: string;
  balancePence: number;
}

/**
 * The home entry point. Rendered only when the piggy bank is enabled — hidden
 * entirely otherwise, never greyed out or teasing, because a child whose parent
 * has not opted in should not see a reward she cannot have.
 */
export function PiggyBankCard({ childId, balancePence }: Props) {
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
