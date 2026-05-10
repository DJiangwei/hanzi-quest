import Link from 'next/link';
import { GenerateWeekButton } from '@/components/parent/GenerateWeekButton';
import { assertParent } from '@/lib/auth/guards';
import { listChildrenByParent } from '@/lib/db/children';
import { listWeeksByChild } from '@/lib/db/weeks';

export default async function ParentDashboardPage() {
  const parent = await assertParent();
  const children = await listChildrenByParent(parent.id);

  const weeksByChild = await Promise.all(
    children.map(async (c) => ({
      child: c,
      weeks: (await listWeeksByChild(c.id)).slice(0, 5),
    })),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <section className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome{parent.displayName ? `, ${parent.displayName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {children.length === 0
              ? 'Add your first child to start a weekly curriculum.'
              : `${children.length} child${children.length === 1 ? '' : 'ren'} on file.`}
          </p>
        </div>
        {children.length > 0 ? (
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/parent/stage/new"
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              + New stage (bulk)
            </Link>
            <Link
              href="/parent/week/new"
              className="text-xs text-zinc-600 hover:underline"
            >
              or single week →
            </Link>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-200 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Children
          </h2>
          <Link
            href="/parent/children"
            className="text-xs text-blue-600 hover:underline"
          >
            Manage →
          </Link>
        </div>
        {children.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            No children yet.{' '}
            <Link
              href="/parent/children"
              className="text-blue-600 hover:underline"
            >
              Add one →
            </Link>
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {children.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded border border-zinc-100 px-3 py-2"
              >
                <span>
                  <span className="font-medium">{c.displayName}</span>
                  {c.birthYear ? (
                    <span className="ml-2 text-xs text-zinc-500">
                      Born {c.birthYear}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3 text-sm">
                  <Link
                    href={`/play/${c.id}`}
                    className="rounded bg-amber-200 px-3 py-1 font-medium text-amber-900 hover:bg-amber-300"
                  >
                    Play →
                  </Link>
                  <Link
                    href={`/parent/children/${c.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {weeksByChild.some((w) => w.weeks.length > 0) ? (
        <section className="rounded-lg border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Recent weeks
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            {weeksByChild.map(({ child, weeks }) =>
              weeks.length === 0 ? null : (
                <div key={child.id} className="flex flex-col gap-1">
                  <p className="text-xs uppercase tracking-widest text-zinc-400">
                    {child.displayName}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {weeks.map((w) => (
                      <li
                        key={w.id}
                        className="flex items-center justify-between rounded border border-zinc-100 px-3 py-2 text-sm"
                      >
                        <span>
                          <span className="font-medium">{w.label}</span>
                          <span className="ml-2 text-xs text-zinc-500">
                            #{w.weekNumber} · {w.status}
                          </span>
                        </span>
                        {w.status === 'draft' ? (
                          <GenerateWeekButton weekId={w.id} />
                        ) : (
                          <Link
                            href={`/parent/week/${w.id}/review`}
                            className="text-blue-600 hover:underline"
                          >
                            {w.status === 'awaiting_review'
                              ? 'Review →'
                              : 'Open →'}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-dashed border-zinc-200 p-5 text-sm text-zinc-500">
        <p>
          Phase 2 · DeepSeek V4 Pro. Use <strong>+ New stage (bulk)</strong> for
          a 10-lesson stage from one paste; click <strong>Generate AI</strong>{' '}
          on each draft week to fill in pinyin + words + sentence (~3 min per
          week), then review/edit/regenerate per character.
        </p>
      </section>
    </main>
  );
}
