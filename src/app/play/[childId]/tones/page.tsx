import Link from 'next/link';
import { requireChild } from '@/lib/auth/guards';
import { getLogbookEntries } from '@/lib/db/logbook';
import { ToneGameBody } from '@/components/play/ToneGameBody';

/**
 * 听声调 — tone practice (roadmap E2).
 *
 * Standalone on purpose: it is NOT a compiled scene type, so it needs no
 * scene_templates row, no compile-week slot and no recompile. That keeps the
 * cost of being wrong low, which matters because the premise is unverified —
 * if the device's Chinese voice does not actually separate 妈 from 马, this
 * game teaches nothing and should be deleted, not iterated on.
 *
 * Reuses getLogbookEntries rather than adding a read: it already returns every
 * character from her unlocked weeks, with pinyin, which is exactly the corpus
 * a minimal-pair game needs.
 */
export default async function TonesPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  await requireChild(childId);

  const entries = await getLogbookEntries(childId);
  const chars = entries.map((e) => ({
    characterId: e.characterId,
    hanzi: e.hanzi,
    pinyin: e.pinyin,
  }));

  return (
    <main className="flex flex-1 flex-col items-center gap-5 p-6">
      <header className="w-full max-w-md rounded-3xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 via-sky-100 to-sky-200 p-5 text-center text-sky-950">
        <h1 className="font-hanzi text-2xl font-extrabold">听声调</h1>
        <p className="text-sm font-semibold">Listen for the Tone</p>
        <p className="mt-1 text-xs text-sky-900/80">
          <span className="font-hanzi">同样的音，不同的调，是不同的字。</span>
        </p>
        <p className="text-[11px] italic text-sky-900/70">
          Same sound, different tone, different character.
        </p>
      </header>

      <div className="w-full max-w-md">
        <ToneGameBody chars={chars} />
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
