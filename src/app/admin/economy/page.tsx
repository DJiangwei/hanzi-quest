import Link from 'next/link';
import { EconomyDashboard } from '@/components/admin/EconomyDashboard';
import {
  allChildrenTotals,
  cardStats,
  coinStats,
  shopExhaustion,
  xpStats,
} from '@/lib/db/economy-stats';
import { DAILY_CARD_CAP } from '@/lib/db/grants';

interface EconomyPageProps {
  searchParams: Promise<{ child?: string }>;
}

// Read-only economy dashboard (roadmap F1). Inherits assertAdmin from the
// /admin layout — SELECTs only, no actions.
export default async function AdminEconomyPage({ searchParams }: EconomyPageProps) {
  const { child: selectedChildId } = await searchParams;

  const totals = await allChildrenTotals();

  const selected = selectedChildId
    ? await Promise.all([
        coinStats(selectedChildId),
        xpStats(selectedChildId),
        cardStats(selectedChildId),
        shopExhaustion(selectedChildId),
      ])
    : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-hanzi text-3xl font-bold tracking-tight text-[var(--color-ocean-900)]">
          📊 经济仪表盘 / Economy Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--color-sand-700)]">
          Read-only ledger aggregations — tune the economy from data, not vibes.
        </p>
        <nav className="mt-3 flex gap-2 text-sm">
          <Link href="/admin" className="rounded-full border border-[var(--color-sand-300)] px-3 py-1 hover:bg-[var(--color-sand-100)]">
            🛠️ 控制台 Console
          </Link>
          <span className="rounded-full bg-[var(--color-ocean-100)] px-3 py-1 font-semibold text-[var(--color-ocean-800)]">
            📊 经济 Economy
          </span>
        </nav>
      </header>

      {/* All-children outlier strip */}
      <section className="rounded-xl border border-[var(--color-sand-200)] bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-hanzi text-lg font-bold text-[var(--color-ocean-900)]">
          全部玩家 / All players
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-[var(--color-sand-600)]">
              <th className="py-1">Child</th>
              <th className="py-1 text-right">Balance</th>
              <th className="py-1 text-right">30d net coins</th>
              <th className="py-1 text-right">14d cards</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t) => (
              <tr key={t.childId} className="border-t border-[var(--color-sand-100)]">
                <td className="py-1">
                  <Link
                    href={`/admin/economy?child=${t.childId}`}
                    className="text-[var(--color-ocean-700)] underline-offset-2 hover:underline"
                  >
                    {t.displayName}
                  </Link>
                </td>
                <td className="py-1 text-right font-mono">{t.balance}</td>
                <td className={`py-1 text-right font-mono ${t.coins30d < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {t.coins30d}
                </td>
                <td className="py-1 text-right font-mono">{t.cards14d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selected ? (
        <EconomyDashboard
          coin={selected[0]}
          xp={selected[1]}
          cards={selected[2]}
          shop={selected[3]}
          cap={DAILY_CARD_CAP}
        />
      ) : (
        <p className="text-sm text-[var(--color-sand-700)]">
          点击上表中的名字查看详情 / Click a name in the table above for details.
        </p>
      )}
    </div>
  );
}
