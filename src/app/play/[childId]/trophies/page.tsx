import { requireChild } from '@/lib/auth/guards';
import { listAllTrophies, listEarnedTrophies } from '@/lib/db/trophies';
import { TrophiesBody } from '@/components/play/TrophiesBody';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function TrophiesPage({ params }: PageProps) {
  const { childId } = await params;
  await requireChild(childId);

  const [trophies, earned] = await Promise.all([
    listAllTrophies(),
    listEarnedTrophies(childId),
  ]);

  const earnedMap = new Map(earned.map((e) => [e.trophyId, e.earnedAt]));

  return (
    <main className="flex flex-1 flex-col items-center">
      <TrophiesBody childId={childId} trophies={trophies} earnedMap={earnedMap} />
    </main>
  );
}
