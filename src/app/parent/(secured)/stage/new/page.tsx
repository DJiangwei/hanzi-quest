import Link from 'next/link';
import { NewStageForm } from '@/components/parent/NewStageForm';
import { assertParent } from '@/lib/auth/guards';
import { listChildrenByParent } from '@/lib/db/children';

export default async function NewStagePage() {
  const parent = await assertParent();
  const children = await listChildrenByParent(parent.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="font-hanzi text-3xl font-bold tracking-tight text-[var(--color-ocean-900)]">
          New stage
        </h1>
        <Link
          href="/parent"
          className="text-sm font-semibold text-[var(--color-ocean-700)] hover:underline"
        >
          ← Back
        </Link>
      </header>

      <p className="text-sm text-[var(--color-sand-900)]">
        Bulk-create a stage of weekly lessons. Paste each lesson&apos;s
        characters on its own line. For the school&apos;s LEVEL 1 字卡, that
        looks like 10 lines of 8–10 characters each. Drafts are created
        instantly; you trigger AI generation per week from the dashboard.
      </p>

      {children.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-sunset-400)] bg-[var(--color-sunset-100)]/40 p-4 text-sm">
          <p className="font-semibold text-[var(--color-sunset-600)]">
            Add a child first.
          </p>
          <p className="mt-1 text-[var(--color-sand-900)]">
            <Link
              href="/parent/children"
              className="font-semibold text-[var(--color-ocean-700)] underline hover:no-underline"
            >
              Go to /parent/children
            </Link>{' '}
            and add the kid this stage is for.
          </p>
        </div>
      ) : (
        <NewStageForm
          kids={children.map((c) => ({
            id: c.id,
            displayName: c.displayName,
          }))}
        />
      )}
    </main>
  );
}
