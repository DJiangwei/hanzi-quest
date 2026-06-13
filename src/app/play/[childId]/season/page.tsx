import { requireChild } from '@/lib/auth/guards';
import { getSeasonView } from '@/lib/db/season';
import { SeasonTrack } from '@/components/play/SeasonTrack';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function SeasonPage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);
  const view = await getSeasonView(child.id);

  if (!view) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="font-hanzi text-lg font-bold text-teal-900">
          暂无进行中的赛季 / No active season
        </p>
        <p className="mt-2 text-sm text-teal-700">
          敬请期待下一季 / Stay tuned for the next season.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 lg:max-w-2xl">
      <SeasonTrack childId={childId} view={view} />
    </main>
  );
}
