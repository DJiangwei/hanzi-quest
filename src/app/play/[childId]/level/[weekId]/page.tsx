import { notFound } from 'next/navigation';
import { SceneRunner, type SceneType } from '@/components/scenes/SceneRunner';
import { requireChild } from '@/lib/auth/guards';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import { listLevelsForWeek } from '@/lib/db/play';
import { getPlayableWeekForChild } from '@/lib/db/weeks';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

export default async function PlayLevelPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  const { child } = await requireChild(childId);

  // Use the same access rule as the map (listChildPlayableWeeks):
  // owner-of-week OR pack-shared-week-and-enrolled. The previous code used
  // getWeekOwnedBy(weekId, parent.id) which broke for shared pack weeks
  // (parent_user_id IS NULL).
  const week = await getPlayableWeekForChild(child.id, weekId);
  if (!week) notFound();

  const [levels, characters] = await Promise.all([
    listLevelsForWeek(weekId),
    getCharactersWithDetailsForWeek(weekId),
  ]);
  if (levels.length === 0) notFound();

  const pool = characters.map((c) => ({
    characterId: c.id,
    hanzi: c.hanzi,
    pinyinArray: c.pinyinArray ?? [],
    meaningEn: c.meaningEn ?? null,
    meaningZh: c.meaningZh ?? null,
    imageHook: c.imageHook ?? null,
    firstWord: c.words[0]?.text ?? null,
  }));
  const charactersById = Object.fromEntries(pool.map((c) => [c.characterId, c]));

  const compiledLevels = levels.map((l) => ({
    id: l.id,
    position: l.position,
    sceneType: l.sceneType as SceneType,
    config: l.sceneConfig as Record<string, unknown>,
  }));

  return (
    <SceneRunner
      childId={child.id}
      weekId={week.id}
      weekLabel={week.label}
      levels={compiledLevels}
      charactersById={charactersById}
      pool={pool}
    />
  );
}
