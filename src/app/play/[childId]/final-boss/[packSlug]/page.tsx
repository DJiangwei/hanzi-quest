import { notFound, redirect } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { getSharedCurriculumPackBySlug } from '@/lib/db/curriculum';
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

  // A map slug lives in curriculum_packs, NOT collection_packs — see the helper's
  // docstring. Using the collectible lookup here made every final boss 404.
  const pack = await getSharedCurriculumPackBySlug(packSlug);
  if (!pack) notFound();

  if (!(await isMapFullyCleared(childId, pack.id))) {
    redirect(`/play/${childId}/maps`);
  }

  // Aggregate the whole map's characters into the boss pool (FinalBossCharacter
  // shape — same subset BossScene's CharacterDetail uses). `words` is threaded
  // so image_pick can borrow a word picture; without it the whole gauntlet's
  // 看图找字 falls back to the text description card.
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
    words: c.words.map((w) => ({
      id: w.id,
      text: w.text,
      imageHook: w.imageHook ?? null,
      meaningEn: w.meaningEn ?? null,
      imageUrl: w.imageUrl ?? null,
    })),
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
        // curriculum_packs carries bilingual names; `name` is the internal class
        // label (not display copy) and is only a last-resort fallback for older
        // rows whose bilingual columns were never backfilled (see the PR #40
        // fallback pattern).
        mapNameZh={pack.nameZh ?? pack.name}
        mapNameEn={pack.nameEn ?? pack.name}
        phases={phases}
      />
    </main>
  );
}
