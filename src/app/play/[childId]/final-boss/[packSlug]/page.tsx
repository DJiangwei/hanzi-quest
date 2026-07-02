import { notFound, redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getPackBySlug } from '@/lib/db/collections';
import { getPackMeta } from '@/lib/collections/packRegistry';
import { isMapFullyCleared } from '@/lib/db/final-boss';
import { listChildPlayableWeeks } from '@/lib/db/weeks';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import { buildFinalBossPhases, type FinalBossCharacter } from '@/lib/play/final-boss';
import { FinalBossRunner } from '@/components/scenes/FinalBossRunner';

interface PageProps {
  params: Promise<{ childId: string; packSlug: string }>;
}

export default async function FinalBossPage({ params }: PageProps) {
  const { childId, packSlug } = await params;
  await requireChild(childId);

  const pack = await getPackBySlug(packSlug);
  const meta = getPackMeta(packSlug);
  if (!pack) notFound();

  if (!(await isMapFullyCleared(childId, pack.id))) {
    redirect(`/play/${childId}/maps`);
  }

  // Aggregate the whole map's characters into the boss pool (FinalBossCharacter
  // shape — same subset BossScene's CharacterDetail uses). image_pick falls back
  // to the imageHook description card here (no word-picture threading in v1).
  const weeks = (await listChildPlayableWeeks(childId)).filter(
    (w) => w.curriculumPackId === pack.id,
  );
  const perWeek = await Promise.all(
    weeks.map((w) => getCharactersWithDetailsForWeek(w.id)),
  );
  const pool: FinalBossCharacter[] = perWeek.flat().map((c) => ({
    characterId: c.id,
    hanzi: c.hanzi,
    pinyinArray: c.pinyinArray ?? [],
    meaningEn: c.meaningEn ?? null,
    meaningZh: c.meaningZh ?? null,
    imageHook: c.imageHook ?? null,
    firstWord: c.words[0]?.text ?? null,
    sentence: c.sentence
      ? { id: c.sentence.id, text: c.sentence.text, translationEn: c.sentence.meaningEn ?? null }
      : null,
  }));

  const phases = buildFinalBossPhases(pool);

  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <FinalBossRunner
        childId={childId}
        packSlug={packSlug}
        mapNameZh={meta?.displayNameZh ?? pack.name}
        mapNameEn={meta?.displayNameEn ?? pack.name}
        phases={phases}
      />
    </main>
  );
}
