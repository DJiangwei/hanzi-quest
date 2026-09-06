import Link from 'next/link';
import { requireChild } from '@/lib/auth/guards';
import { getLogbookEntries } from '@/lib/db/logbook';
import { WriteGameBody, type WriteChar } from '@/components/play/WriteGameBody';

/**
 * 写字 — stroke practice (roadmap E1).
 *
 * Standalone on purpose, the same shape 听声调 shipped in: not a compiled scene
 * type, so no `scene_templates` row, no compile-week slot and no recompile.
 * Whether a six-year-old's finger on an iPad can satisfy stroke matching often
 * enough to feel like a game is unverified, and a page with no economy
 * attached can be deleted rather than unwound.
 *
 * Reuses getLogbookEntries — it already returns every character from her
 * unlocked weeks, across every map she has entered since PR #180.
 */
export default async function WritePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  await requireChild(childId);

  const entries = await getLogbookEntries(childId);
  // Shuffled HERE, on the server, once per page load. The body then rotates a
  // window over the result, so it needs no randomness in a render body — the
  // "randomize upstream" rule the MCQ landmine states and `react-hooks/purity`
  // enforces. Bounded impurity: each request re-renders and re-shuffles.
  // eslint-disable-next-line react-hooks/purity
  const shuffled = entries.map((e) => ({ e, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .map(({ e }) => e);
  const chars: WriteChar[] = shuffled.map((e) => ({
    characterId: e.characterId,
    hanzi: e.hanzi,
    pinyin: e.pinyin,
    meaningEn: e.meaningEn,
  }));

  return (
    <main className="flex flex-1 flex-col items-center gap-5 p-6">
      <header className="w-full max-w-md rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 p-5 text-center text-amber-950">
        <h1 className="font-hanzi text-2xl font-extrabold">写字</h1>
        <p className="text-sm font-semibold">Stroke Practice</p>
        <p className="mt-1 text-xs text-amber-900/80">
          <span className="font-hanzi">一笔一笔,照着写。</span>
        </p>
        <p className="text-[11px] italic text-amber-900/70">One stroke at a time.</p>
      </header>

      <div className="w-full max-w-md">
        <WriteGameBody chars={chars} />
      </div>

      <Link
        href={`/play/${childId}/collection`}
        className="text-sm text-[var(--color-sand-700)] underline"
      >
        <span className="font-hanzi">← 背包</span> <span className="italic">/ Bag</span>
      </Link>
    </main>
  );
}
