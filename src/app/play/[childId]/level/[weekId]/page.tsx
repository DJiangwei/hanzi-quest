import { notFound } from 'next/navigation';
import { SceneRunner } from '@/components/scenes/SceneRunner';
import { requireChild } from '@/lib/auth/guards';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import { listLevelsForWeek } from '@/lib/db/play';
import { getWeekOwnedBy } from '@/lib/db/weeks';
import type { FlashcardConfig } from '@/lib/scenes/configs';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

export default async function PlayLevelPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  const { parent, child } = await requireChild(childId);

  const week = await getWeekOwnedBy(weekId, parent.id);
  if (!week || week.childId !== child.id) notFound();
  if (week.status !== 'published') notFound();

  const [levels, characters] = await Promise.all([
    listLevelsForWeek(weekId),
    getCharactersWithDetailsForWeek(weekId),
  ]);
  if (levels.length === 0) notFound();

  const charactersById = Object.fromEntries(
    characters.map((c) => [
      c.id,
      {
        characterId: c.id,
        hanzi: c.hanzi,
        pinyinArray: c.pinyinArray ?? [],
        meaningEn: c.meaningEn ?? null,
        meaningZh: c.meaningZh ?? null,
      },
    ]),
  );

  const compiledLevels = levels.map((l) => {
    const cfg = l.sceneConfig as FlashcardConfig;
    return {
      id: l.id,
      position: l.position,
      sceneType: l.sceneType,
      characterId: cfg.characterId,
    };
  });

  return (
    <SceneRunner
      childId={child.id}
      weekId={week.id}
      weekLabel={week.label}
      levels={compiledLevels}
      charactersById={charactersById}
    />
  );
}
