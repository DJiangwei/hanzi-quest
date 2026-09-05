import { notFound, redirect } from 'next/navigation';
import { SceneRunner, type SceneType } from '@/components/scenes/SceneRunner';
import { MidSceneFlag } from '@/components/play/MidSceneProvider';
import { requireChild } from '@/lib/auth/guards';
import { getCharactersWithDetailsForWeek, getClearedWeekCharacters } from '@/lib/db/characters';
import {
  getSectionStatsForChild,
  listLevelsForWeek,
  segmentToSection,
  type WeekSection,
} from '@/lib/db/play';
import { getPlayableWeekForChild, getWeekGateState } from '@/lib/db/weeks';
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

  // T3 linear gating — an island past the frontier isn't playable at all, so
  // bounce before doing any of the (expensive) scene loading below. Checked
  // here as well as on the hub because this route is directly linkable.
  const gate = await getWeekGateState(child.id, weekId);
  if (!gate.isUnlocked) redirect(`/play/${childId}`);

  // Boss is gated behind practice progress.
  if (typedSection === 'boss') {
    const stats = await getSectionStatsForChild(child.id, weekId);
    if (stats.practice.done < BOSS_UNLOCK_PRACTICE_THRESHOLD) {
      redirect(`/play/${childId}/week/${weekId}`);
    }
  }

  const [allLevels, characters, clearedCharacters, grantedStarter, initialPowerupCounts] = await Promise.all([
    listLevelsForWeek(weekId),
    getCharactersWithDetailsForWeek(weekId),
    getClearedWeekCharacters(child.id, weekId),
    grantStarterPowerupsIfNeeded(child.id),
    getPowerupCounts(child.id),
  ]);

  const sectionLevels = allLevels.filter((l) => {
    const segment = (l.sceneConfig as { segment?: string } | null)?.segment ?? null;
    return segmentToSection(segment) === typedSection;
  });

  if (sectionLevels.length === 0) notFound();

  // Same mapper for both, so the two pools can never disagree about what a
  // character is. `pool` stays THIS WEEK's characters — it also resolves the
  // target, image_word's frozen word ids, and the weekChars highlight — while
  // `olderPool` carries cleared weeks purely as distractor material.
  const toDetail = (c: (typeof characters)[number]) => ({
    characterId: c.id,
    hanzi: c.hanzi,
    pinyinArray: c.pinyinArray ?? [],
    meaningEn: c.meaningEn ?? null,
    meaningZh: c.meaningZh ?? null,
    imageHook: c.imageHook ?? null,
    audioUrl: c.audioUrl ?? null,
    firstWord: c.words[0]?.text ?? null,
    words: c.words.map((w) => ({
      id: w.id,
      text: w.text,
      imageHook: w.imageHook ?? null,
      meaningEn: w.meaningEn ?? null,
      imageUrl: w.imageUrl ?? null,
      audioUrl: w.audioUrl ?? null,
    })),
    sentence: c.sentence
      ? {
          id: c.sentence.id,
          text: c.sentence.text,
          translationEn: c.sentence.meaningEn ?? null,
        }
      : null,
  });
  const pool = characters.map(toDetail);
  const olderPool = clearedCharacters.map(toDetail);
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
    <>
      <MidSceneFlag />
      <SceneRunner
        childId={child.id}
        weekId={week.id}
        weekLabel={week.label}
        weekNumber={week.weekNumber}
        section={typedSection}
        levels={compiledLevels}
        charactersById={charactersById}
        pool={pool}
        olderPool={olderPool}
        exitHref={`/play/${child.id}/week/${week.id}`}
        initialPowerupCounts={initialPowerupCounts}
        showStarterToast={grantedStarter}
      />
    </>
  );
}
