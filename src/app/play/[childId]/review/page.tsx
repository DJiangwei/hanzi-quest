import { redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { ReviewRunner } from '@/components/play/ReviewRunner';
import { getReviewCandidates } from '@/lib/db/review';
import { pickReviewTargets, REVIEW_SESSION_SIZE } from '@/lib/review/selection';
import { buildReviewSession } from '@/lib/review/session';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function ReviewPage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);

  const { candidates, pool } = await getReviewCandidates(child.id);
  const targets = pickReviewTargets(candidates, REVIEW_SESSION_SIZE);
  const questions = buildReviewSession(targets, pool);

  // Not an error state — she simply has nothing to review yet. The home card
  // hides in the same case, so this is only reachable by a direct URL or a
  // race against it.
  if (questions.length === 0) redirect(`/play/${child.id}`);

  return <ReviewRunner childId={child.id} questions={questions} pool={pool} />;
}
