import { notFound, redirect } from 'next/navigation';
import { SceneRunner, type SceneType } from '@/components/scenes/SceneRunner';
import { requireChild } from '@/lib/auth/guards';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import {
  getSectionStatsForChild,
  listLevelsForWeek,
  segmentToSection,
  type WeekSection,
} from '@/lib/db/play';
import { getPlayableWeekForChild } from '@/lib/db/weeks';
import { BOSS_UNLOCK_PRACTICE_THRESHOLD } from '@/lib/scenes/configs';
import { grantStarterPowerupsIfNeeded, getPowerupCounts } from '@/lib/db/powerups';

const SECTIONS: readonly WeekSection[] = ['review', 'practice', 'boss'] as const;

interface PageProps {
  params: Promise<{ childId: string; weekId: string; section: string }>;
}

export default async function SectionPage({ params }: PageProps) {
  const { childId, weekId, section } = await params;

  if (!SECTIONS.includes(section as WeekSection)) {
    notFound();
  }
  const typedSection = section as WeekSection;

  const { child } = await requireChild(childId);
  const week = await getPlayableWeekForChild(child.id, weekId);
  if (!week) notFound();

  // Boss is gated behind practice progress.
  if (typedSection === 'boss') {
    const stats = await getSectionStatsForChild(child.id, weekId);
    if (stats.practice.done < BOSS_UNLOCK_PRACTICE_THRESHOLD) {
      redirect(`/play/${childId}/week/${weekId}`);
    }
  }

  const [allLevels, characters, grantedStarter, initialPowerupCounts] = await Promise.all([
    listLevelsForWeek(weekId),
    getCharactersWithDetailsForWeek(weekId),
    grantStarterPowerupsIfNeeded(child.id),
    getPowerupCounts(child.id),
  ]);

  const sectionLevels = allLevels.filter((l) => {
    const segment = (l.sceneConfig as { segment?: string } | null)?.segment ?? null;
    return segmentToSection(segment) === typedSection;
  });

  if (sectionLevels.length === 0) notFound();

  const pool = characters.map((c) => ({
    characterId: c.id,
    hanzi: c.hanzi,
    pinyinArray: c.pinyinArray ?? [],
    meaningEn: c.meaningEn ?? null,
    meaningZh: c.meaningZh ?? null,
    imageHook: c.imageHook ?? null,
    firstWord: c.words[0]?.text ?? null,
    words: c.words.map((w) => ({
      id: w.id,
      text: w.text,
      imageHook: w.imageHook ?? null,
      meaningEn: w.meaningEn ?? null,
    })),
    sentence: c.sentence
      ? {
          id: c.sentence.id,
          text: c.sentence.text,
          translationEn: c.sentence.meaningEn ?? null,
        }
      : null,
  }));
  const charactersById = Object.fromEntries(
    pool.map((c) => [c.characterId, c]),
  );

  const compiledLevels = sectionLevels.map((l) => ({
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
      exitHref={`/play/${child.id}/week/${week.id}`}
      initialPowerupCounts={initialPowerupCounts}
      showStarterToast={grantedStarter}
    />
  );
}
