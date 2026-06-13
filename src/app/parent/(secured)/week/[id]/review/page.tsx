import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CharacterReviewCard } from '@/components/parent/CharacterReviewCard';
import { PublishWeekButton } from '@/components/parent/PublishWeekButton';
import { assertParent } from '@/lib/auth/guards';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import { getWeekOwnedBy } from '@/lib/db/weeks';
import { listHomeworkItems } from '@/lib/db/homework';
import { parseHomeworkConfig } from '@/lib/homework/schemas';
import { HomeworkEditor } from '@/components/parent/HomeworkEditor';

/** One-line summary of a homework item for the editor list. */
function summarizeHomework(type: string, config: unknown): string {
  try {
    const c = parseHomeworkConfig(type as never, config);
    if (c.type === 'sentence_order') return c.tokens.join(' / ');
    if (c.type === 'char_quiz') return c.questionZh;
    return `给「${c.baseChar}」组词`;
  } catch {
    return '(invalid item)';
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewWeekPage({ params }: PageProps) {
  const { id } = await params;
  const parent = await assertParent();
  const week = await getWeekOwnedBy(id, parent.id);
  if (!week) notFound();

  const [chars, homeworkRows] = await Promise.all([
    getCharactersWithDetailsForWeek(id),
    listHomeworkItems(id),
  ]);
  const homeworkSummaries = homeworkRows.map((r) => ({
    id: r.id,
    type: r.type,
    summary: summarizeHomework(r.type, r.config),
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-hanzi text-3xl font-bold tracking-tight text-[var(--color-ocean-900)]">
            {week.label}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
            Week {week.weekNumber} · status: {week.status}
          </p>
        </div>
        <Link
          href="/parent"
          className="text-sm font-semibold text-[var(--color-ocean-700)] hover:underline"
        >
          ← Back
        </Link>
      </header>

      {chars.length > 0 &&
      (week.status === 'awaiting_review' || week.status === 'published') ? (
        <section className="flex items-center justify-between rounded-2xl border border-[var(--color-good)] bg-[var(--color-good-bg)] p-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-ocean-900)]">
              {week.status === 'published'
                ? 'Already published — child can play this on the map.'
                : 'Looks good? Publish to make it playable.'}
            </p>
            <p className="text-xs text-[var(--color-ocean-700)]">
              Publishing compiles {chars.length} characters into the level
              gauntlet.
            </p>
          </div>
          <PublishWeekButton
            weekId={week.id}
            alreadyPublished={week.status === 'published'}
          />
        </section>
      ) : null}

      {chars.length === 0 ? (
        <p className="rounded-2xl border border-[var(--color-sunset-400)] bg-[var(--color-sunset-100)]/40 p-4 text-sm text-[var(--color-sunset-600)]">
          This week has no characters yet — AI generation may still be running
          or it failed. Try the &ldquo;New week&rdquo; flow again.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {chars.map((c) => (
            <CharacterReviewCard
              key={c.id}
              weekId={week.id}
              characterId={c.id}
              hanzi={c.hanzi}
              pinyinJoined={(c.pinyinArray ?? []).join(' ')}
              meaningEn={c.meaningEn ?? ''}
              meaningZh={c.meaningZh ?? ''}
              words={c.words.map((w) => ({
                text: w.text,
                pinyinJoined: (w.pinyinArray ?? []).join(' '),
                meaningEn: w.meaningEn ?? '',
              }))}
              sentence={
                c.sentence
                  ? {
                      text: c.sentence.text,
                      pinyinJoined: (c.sentence.pinyinArray ?? []).join(' '),
                      meaningEn: c.sentence.meaningEn ?? '',
                    }
                  : { text: '', pinyinJoined: '', meaningEn: '' }
              }
            />
          ))}
        </div>
      )}

      <HomeworkEditor weekId={week.id} items={homeworkSummaries} />
    </main>
  );
}
