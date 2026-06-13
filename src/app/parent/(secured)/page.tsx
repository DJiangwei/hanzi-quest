import Link from 'next/link';
import { assertParent } from '@/lib/auth/guards';
import { listChildrenByParent } from '@/lib/db/children';
import { listChildEnrollmentSummaries } from '@/lib/db/curriculum';

export default async function ParentDashboardPage() {
  const parent = await assertParent();
  const children = await listChildrenByParent(parent.id);
  const enrollments = await listChildEnrollmentSummaries(children.map((c) => c.id));
  const enrollmentByChild = new Map(enrollments.map((e) => [e.childId, e]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <section>
        <h1 className="font-hanzi text-3xl font-bold tracking-tight text-[var(--color-ocean-900)]">
          Welcome{parent.displayName ? `, ${parent.displayName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-sand-700)]">
          {children.length === 0
            ? 'Add your first child to start the adventure.'
            : `${children.length} child${children.length === 1 ? '' : 'ren'} on board.`}
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--color-sand-200)] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
            Children
          </h2>
          <Link
            href="/parent/children"
            className="text-xs font-semibold text-[var(--color-ocean-700)] hover:underline"
          >
            Manage →
          </Link>
        </div>
        {children.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-sand-700)]">
            No children yet.{' '}
            <Link
              href="/parent/children"
              className="font-semibold text-[var(--color-ocean-700)] hover:underline"
            >
              Add one →
            </Link>
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {children.map((c) => {
              const enrollment = enrollmentByChild.get(c.id);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl bg-[var(--color-sand-50)] px-4 py-3"
                >
                  <span className="flex flex-col">
                    <span className="flex items-baseline gap-2">
                      <span className="font-semibold text-[var(--color-sand-900)]">
                        {c.displayName}
                      </span>
                      {c.birthYear ? (
                        <span className="text-xs text-[var(--color-sand-700)]">
                          Born {c.birthYear}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-[var(--color-sand-700)]">
                      {enrollment?.pack ? (
                        <>
                          <span className="font-semibold text-[var(--color-ocean-700)]">
                            {enrollment.pack.name}
                          </span>
                          {' · '}
                          {enrollment.publishedWeeks}/{enrollment.totalWeeks}{' '}
                          weeks ready
                        </>
                      ) : (
                        <span className="italic">No class enrolled</span>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-sm">
                    <Link
                      href={`/play/${c.id}`}
                      className="rounded-full bg-[var(--color-treasure-400)] px-4 py-2 text-sm font-bold text-[var(--color-treasure-700)] shadow-sm transition-transform hover:bg-[var(--color-treasure-500)] active:scale-95"
                    >
                      Play →
                    </Link>
                    <Link
                      href={`/parent/children/${c.id}`}
                      className="font-semibold text-[var(--color-ocean-700)] hover:underline"
                    >
                      📚 Homework
                    </Link>
                    <Link
                      href={`/parent/children/${c.id}`}
                      className="text-[var(--color-ocean-700)] hover:underline"
                    >
                      Edit
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-dashed border-[var(--color-sand-200)] bg-[var(--color-ocean-100)]/40 p-5 text-sm text-[var(--color-ocean-900)]">
        <p>
          🏴‍☠️ The 海盗班 crew sails through the shared 加勒比海 islands. To add your
          own weekly homework, open a child → pick a week → add homework items.
        </p>
      </section>
    </main>
  );
}
