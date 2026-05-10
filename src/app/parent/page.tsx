import Link from 'next/link';
import { assertParent } from '@/lib/auth/guards';
import { listChildrenByParent } from '@/lib/db/children';

export default async function ParentDashboardPage() {
  const parent = await assertParent();
  const children = await listChildrenByParent(parent.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome{parent.displayName ? `, ${parent.displayName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {children.length === 0
            ? 'Add your first child to start a weekly curriculum.'
            : `${children.length} child${children.length === 1 ? '' : 'ren'} on file.`}
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Children
        </h2>
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
                <Link
                  href={`/parent/children/${c.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-dashed border-zinc-200 p-5 text-sm text-zinc-500">
        <p>
          Phase 1 · login closed-loop. Weekly character input + game map land in
          Phase 2 / Phase 3.
        </p>
      </section>
    </main>
  );
}
