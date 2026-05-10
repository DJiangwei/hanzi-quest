import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CharacterReviewCard } from '@/components/parent/CharacterReviewCard';
import { assertParent } from '@/lib/auth/guards';
import { getCharactersWithDetailsForWeek } from '@/lib/db/characters';
import { getWeekOwnedBy } from '@/lib/db/weeks';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewWeekPage({ params }: PageProps) {
  const { id } = await params;
  const parent = await assertParent();
  const week = await getWeekOwnedBy(id, parent.id);
  if (!week) notFound();

  const chars = await getCharactersWithDetailsForWeek(id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{week.label}</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">
            Week {week.weekNumber} · status: {week.status}
          </p>
        </div>
        <Link href="/parent" className="text-sm text-zinc-600 hover:underline">
          ← Back
        </Link>
      </header>

      {chars.length === 0 ? (
        <p className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
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
    </main>
  );
}
