import Link from 'next/link';
import { TrophyCard } from './TrophyCard';
import type { TrophyRow } from '@/lib/db/trophies';

interface Props {
  childId: string;
  trophies: TrophyRow[];
  earnedMap: Map<string, Date>;
}

const CATEGORY_LABEL: Record<string, { zh: string; en: string }> = {
  mastery: { zh: '战斗 · 大师', en: 'Mastery' },
  streak: { zh: '坚持 · 连续', en: 'Streak' },
  collection: { zh: '收藏', en: 'Collection' },
  coins: { zh: '金币', en: 'Coins' },
  practice: { zh: '练习', en: 'Practice' },
};

export function TrophiesBody({ childId, trophies, earnedMap }: Props) {
  const byCategory = new Map<string, TrophyRow[]>();
  for (const t of trophies) {
    const arr = byCategory.get(t.category) ?? [];
    arr.push(t);
    byCategory.set(t.category, arr);
  }

  const totalEarned = earnedMap.size;
  const totalAll = trophies.length;

  return (
    <main className="flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 p-5 text-center text-amber-900">
        <Link
          href={`/play/${childId}/collection`}
          className="float-left rounded-lg border-2 border-amber-800/40 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
        >
          ← Atlas
        </Link>
        <div className="text-4xl" aria-hidden>🏆</div>
        <h1 className="mt-1 font-hanzi text-2xl font-extrabold">荣誉殿堂</h1>
        <p className="text-base font-semibold">Hall of Trophies</p>
        <p className="mt-2 text-sm">{totalEarned} / {totalAll}</p>
      </header>

      {Array.from(byCategory.entries()).map(([cat, list]) => {
        const earnedInCat = list.filter((t) => earnedMap.has(t.id)).length;
        const labels = CATEGORY_LABEL[cat] ?? { zh: cat, en: cat };
        return (
          <section key={cat} className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl bg-amber-100/60 px-3 py-2">
              <span className="font-hanzi text-lg font-bold text-amber-950">{labels.zh}</span>
              <span className="text-sm font-semibold text-amber-900">
                {labels.en} · {earnedInCat} / {list.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {list.map((t) => (
                <TrophyCard
                  key={t.id}
                  trophy={t}
                  earned={earnedMap.has(t.id)}
                  earnedAt={earnedMap.get(t.id) ?? null}
                />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
