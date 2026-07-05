// Read-only economy dashboard panels (F1). Purely presentational — all data
// arrives as plain props from the /admin/economy server component.
import type {
  CardStats,
  CoinStats,
  ShopExhaustion,
  XpStats,
} from '@/lib/db/economy-stats';

interface Props {
  coin: CoinStats;
  xp: XpStats;
  cards: CardStats;
  shop: ShopExhaustion;
  cap: number;
}

function pct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((Math.abs(value) / max) * 100));
}

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-sand-200)] bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-hanzi text-lg font-bold text-[var(--color-ocean-900)]">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

/** Label + number + horizontal CSS bar. Negative totals render red. */
function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const negative = value < 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-44 shrink-0 truncate font-mono text-xs text-[var(--color-sand-700)]">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded bg-[var(--color-sand-100)]">
        <div
          className={negative ? 'h-full bg-rose-400' : 'h-full bg-emerald-400'}
          style={{ width: `${pct(value, max)}%` }}
        />
      </div>
      <span className={`w-16 shrink-0 text-right font-mono text-xs ${negative ? 'text-rose-600' : 'text-emerald-700'}`}>
        {value}
      </span>
    </div>
  );
}

export function EconomyDashboard({ coin, xp, cards, shop, cap }: Props) {
  const coinMax = Math.max(1, ...coin.lifetime.byReason.map((r) => Math.abs(r.total)));
  const coin30Max = Math.max(1, ...coin.last30.byReason.map((r) => Math.abs(r.total)));
  const weekMax = Math.max(1, ...coin.weeklyNet.map((w) => Math.abs(w.net)));
  const xpMax = Math.max(1, ...xp.lifetime.map((r) => r.total));
  const srcMax = Math.max(1, ...cards.bySource.map((r) => r.total));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PanelCard title="🪙 金币 Coin flow">
        <p className="text-sm text-[var(--color-sand-700)]">
          Balance <span className="font-mono font-bold text-[var(--color-ocean-900)]">{coin.balance}</span>
          {' · '}lifetime +{coin.lifetime.earned} / −{coin.lifetime.spent}
          {' · '}30d +{coin.last30.earned} / −{coin.last30.spent}
        </p>
        <h3 className="mt-2 text-xs font-semibold uppercase text-[var(--color-sand-600)]">Lifetime by reason</h3>
        {coin.lifetime.byReason.map((r) => (
          <StatBar key={r.key} label={r.key} value={r.total} max={coinMax} />
        ))}
        <h3 className="mt-2 text-xs font-semibold uppercase text-[var(--color-sand-600)]">Last 30 days by reason</h3>
        {coin.last30.byReason.map((r) => (
          <StatBar key={r.key} label={r.key} value={r.total} max={coin30Max} />
        ))}
        <h3 className="mt-2 text-xs font-semibold uppercase text-[var(--color-sand-600)]">Weekly net (8 weeks)</h3>
        <div className="flex h-16 items-end gap-1">
          {coin.weeklyNet.map((w) => (
            <div key={w.weekStartIso} className="flex flex-1 flex-col items-center gap-0.5" title={`${w.weekStartIso}: ${w.net}`}>
              <div
                className={`w-full rounded-t ${w.net < 0 ? 'bg-rose-400' : 'bg-emerald-400'}`}
                style={{ height: `${Math.max(2, pct(w.net, weekMax) * 0.56)}px` }}
              />
              <span className="text-[9px] text-[var(--color-sand-600)]">{w.weekStartIso.slice(5)}</span>
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard title="✨ XP by source">
        <h3 className="text-xs font-semibold uppercase text-[var(--color-sand-600)]">Lifetime</h3>
        {xp.lifetime.length === 0 && <p className="text-xs text-[var(--color-sand-600)]">0 — no XP yet</p>}
        {xp.lifetime.map((r) => (
          <StatBar key={r.key} label={r.key} value={r.total} max={xpMax} />
        ))}
        <h3 className="mt-2 text-xs font-semibold uppercase text-[var(--color-sand-600)]">Last 30 days</h3>
        {xp.last30.length === 0 && <p className="text-xs text-[var(--color-sand-600)]">0 — none in window</p>}
        {xp.last30.map((r) => (
          <StatBar key={r.key} label={r.key} value={r.total} max={xpMax} />
        ))}
      </PanelCard>

      <PanelCard title="🎴 卡片 Cards">
        <h3 className="text-xs font-semibold uppercase text-[var(--color-sand-600)]">
          Daily grants vs cap ({cap}/day) — last 14 days
        </h3>
        <div className="flex h-16 items-end gap-1">
          {cards.daily.map((d) => (
            <div key={d.dayUtc} className="flex flex-1 flex-col items-center gap-0.5" title={`${d.dayUtc}: ${d.count}`}>
              <div
                className={`w-full rounded-t ${d.count >= cap ? 'bg-amber-500' : 'bg-sky-400'}`}
                style={{ height: `${Math.max(2, (Math.min(d.count, cap) / cap) * 56)}px` }}
              />
              <span className="text-[9px] text-[var(--color-sand-600)]">{d.dayUtc.slice(8)}</span>
            </div>
          ))}
        </div>
        <h3 className="mt-2 text-xs font-semibold uppercase text-[var(--color-sand-600)]">Grants by source (lifetime)</h3>
        {cards.bySource.map((r) => (
          <StatBar key={r.key} label={r.key} value={r.total} max={srcMax} />
        ))}
        <h3 className="mt-2 text-xs font-semibold uppercase text-[var(--color-sand-600)]">
          Pack completion · 🔹 shards: {cards.shards}
        </h3>
        <table className="w-full text-xs">
          <tbody>
            {cards.packCompletion.map((p) => (
              <tr key={p.slug} className="border-b border-[var(--color-sand-100)]">
                <td className="py-1 pr-2">{p.name}</td>
                <td className="py-1 pr-2 font-mono">
                  {p.owned}/{p.total}
                </td>
                <td className="w-1/2 py-1">
                  <div className="h-2 overflow-hidden rounded bg-[var(--color-sand-100)]">
                    <div className="h-full bg-sky-400" style={{ width: `${pct(p.owned, p.total)}%` }} />
                  </div>
                </td>
                <td className="py-1 pl-2 text-right font-mono">{pct(p.owned, p.total)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PanelCard>

      <PanelCard title="🛒 商店 Shop exhaustion">
        <p className="text-sm text-[var(--color-sand-700)]">
          Remaining catalog cost{' '}
          <span className="font-mono font-bold text-[var(--color-ocean-900)]">{shop.totalRemainingCost}</span>
          {' '}coins vs balance <span className="font-mono">{shop.balance}</span>
          {shop.totalRemainingCost > 0 && shop.balance >= shop.totalRemainingCost && (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
              ⚠️ can buy out the whole shop
            </span>
          )}
        </p>
        <table className="w-full text-xs">
          <tbody>
            {shop.byKind.map((k) => (
              <tr key={k.kind} className="border-b border-[var(--color-sand-100)]">
                <td className="py-1 pr-2 font-mono">{k.kind}</td>
                <td className="py-1 pr-2 font-mono">
                  {k.owned}/{k.total}
                </td>
                <td className="w-1/2 py-1">
                  <div className="h-2 overflow-hidden rounded bg-[var(--color-sand-100)]">
                    <div className="h-full bg-emerald-400" style={{ width: `${pct(k.owned, k.total)}%` }} />
                  </div>
                </td>
                <td className="py-1 pl-2 text-right font-mono">{k.remainingCost} left</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PanelCard>
    </div>
  );
}
