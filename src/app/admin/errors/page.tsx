import Link from 'next/link';
import {
  ERROR_WINDOW_DAYS,
  listErrorGroups,
  listErrorInstances,
} from '@/lib/db/error-events';

interface Props {
  searchParams: Promise<{ scope?: string }>;
}

function ago(d: Date, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - d.getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

/**
 * Read-only error log (roadmap C3). Inherits assertAdmin from the /admin
 * layout — SELECTs only, no actions.
 *
 * Self-hosted rather than Sentry: error payloads here can carry a childId and
 * learning content, and this is a game for two families, so nothing about a
 * child leaves the deployment. The trade-off, chosen knowingly, is that there
 * is no alerting — someone has to open this page.
 */
export default async function AdminErrorsPage({ searchParams }: Props) {
  const { scope } = await searchParams;
  const groups = await listErrorGroups();
  // Only fetch stacks for the scope actually being read. Pulling every stack
  // on first paint would make the page slowest exactly when it is needed most.
  const instances = scope ? await listErrorInstances(scope) : [];
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  return (
    <div className="flex flex-col gap-8" data-testid="admin-errors">
      <header>
        <h1 className="font-hanzi text-3xl font-bold tracking-tight text-[var(--color-ocean-900)]">
          🚨 错误日志 / Error Log
        </h1>
        <p className="mt-1 text-sm text-[var(--color-sand-700)]">
          Server-side failures from the last {ERROR_WINDOW_DAYS} days. No alerting —
          this page is the whole mechanism, so it is worth opening after a release.
        </p>
        <nav className="mt-3 flex gap-2 text-sm">
          <Link
            href="/admin"
            className="rounded-full border border-[var(--color-sand-300)] px-3 py-1 hover:bg-[var(--color-sand-100)]"
          >
            🛠️ 控制台 Console
          </Link>
          <Link
            href="/admin/economy"
            className="rounded-full border border-[var(--color-sand-300)] px-3 py-1 hover:bg-[var(--color-sand-100)]"
          >
            📊 经济 Economy
          </Link>
          <span className="rounded-full bg-[var(--color-ocean-100)] px-3 py-1 font-semibold text-[var(--color-ocean-800)]">
            🚨 错误 Errors
          </span>
        </nav>
      </header>

      {groups.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-[var(--color-sand-300)] bg-white/70 p-6 text-center text-sm text-[var(--color-sand-700)]">
          No server errors recorded in the last {ERROR_WINDOW_DAYS} days.
          <span className="mt-1 block text-xs text-[var(--color-sand-600)]">
            That is a statement about this window only — anything older has aged out.
          </span>
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          {groups.map((g) => {
            const active = g.scope === scope;
            return (
              <Link
                key={g.scope}
                href={active ? '/admin/errors' : `/admin/errors?scope=${encodeURIComponent(g.scope)}`}
                className={`rounded-2xl border-2 p-4 transition ${
                  active
                    ? 'border-[var(--color-ocean-400)] bg-[var(--color-ocean-50)]'
                    : 'border-[var(--color-sand-300)] bg-white/80 hover:border-[var(--color-ocean-300)]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <code className="font-mono text-sm font-semibold text-[var(--color-ocean-900)]">
                    {g.scope}
                  </code>
                  <span className="shrink-0 text-xs text-[var(--color-sand-700)]">
                    ×{g.count} · {ago(g.lastSeen, nowMs)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-[var(--color-sand-700)]">
                  {g.lastMessage}
                </p>
              </Link>
            );
          })}
        </section>
      )}

      {scope && instances.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-sm font-semibold text-[var(--color-ocean-900)]">
            {scope} — latest {instances.length}
          </h2>
          {instances.map((i) => (
            <details
              key={i.id}
              className="rounded-2xl border border-[var(--color-sand-300)] bg-white/80 p-4"
            >
              <summary className="cursor-pointer text-xs text-[var(--color-sand-700)]">
                {i.createdAt.toISOString()}
                {/* childId, never a name: /admin is the one cross-account surface. */}
                {i.childId ? ` · child ${i.childId.slice(0, 8)}` : ''}
              </summary>
              <p className="mt-2 text-sm text-[var(--color-ocean-900)]">{i.message}</p>
              {i.stack ? (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--color-sand-100)] p-3 text-[11px] leading-relaxed text-[var(--color-sand-900)]">
                  {i.stack}
                </pre>
              ) : null}
            </details>
          ))}
        </section>
      ) : null}
    </div>
  );
}
