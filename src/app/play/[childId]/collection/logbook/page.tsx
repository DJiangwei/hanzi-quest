import { requireChild } from '@/lib/auth/guards';
import { getLogbookEntries } from '@/lib/db/logbook';
import { masteryForChar } from '@/lib/mastery/mastery';
import { LogbookGrid, type LogbookTile } from '@/components/play/LogbookGrid';

export default async function LogbookPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  await requireChild(childId);

  const entries = await getLogbookEntries(childId);
  const tiles: LogbookTile[] = entries.map((e) => ({
    characterId: e.characterId,
    hanzi: e.hanzi,
    pinyin: e.pinyin,
    meaningEn: e.meaningEn,
    firstWord: e.firstWord,
    sentence: e.sentence,
    state: masteryForChar(e).state,
  }));
  const proficient = tiles.filter((t) => t.state === 'proficient').length;

  return (
    <main className="flex flex-1 flex-col items-center gap-4 p-6">
      <header className="w-full max-w-md rounded-3xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 via-sky-100 to-sky-200 p-5 text-center text-sky-950">
        <h1 className="font-hanzi text-2xl font-extrabold">航海日志</h1>
        <p className="text-sm font-semibold">Captain&apos;s Logbook</p>
        {tiles.length > 0 ? (
          <div data-testid="logbook-counts">
            <p className="mt-1 text-xs text-sky-900/80">
              <span className="font-hanzi">{tiles.length} 个字 · 熟练 {proficient}</span>
            </p>
            <p className="text-[11px] italic text-sky-900/70">
              {tiles.length} characters · {proficient} solid
            </p>
          </div>
        ) : null}
      </header>

      <div className="w-full max-w-md">
        {tiles.length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed border-sky-300 bg-white/70 p-6 text-center text-sm text-sky-900">
            <span className="font-hanzi block">出发去第一座岛,开始写你的日志吧!</span>
            <span className="mt-1 block italic text-sky-900/70">
              Sail to your first island and start your logbook!
            </span>
          </p>
        ) : (
          <LogbookGrid tiles={tiles} />
        )}
      </div>
    </main>
  );
}
