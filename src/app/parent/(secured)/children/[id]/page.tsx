import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteChildButton } from '@/components/parent/DeleteChildButton';
import { EditChildForm } from '@/components/parent/EditChildForm';
import { requireChild } from '@/lib/auth/guards';
import { listChildPlayableWeeks } from '@/lib/db/weeks';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditChildPage({ params }: PageProps) {
  const { id } = await params;

  let child;
  try {
    ({ child } = await requireChild(id));
  } catch {
    notFound();
  }

  const weeks = await listChildPlayableWeeks(child.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="font-hanzi text-3xl font-bold tracking-tight text-[var(--color-ocean-900)]">
          Edit {child.displayName}
        </h1>
        <Link
          href="/parent/children"
          className="text-sm font-semibold text-[var(--color-ocean-700)] hover:underline"
        >
          ← Back
        </Link>
      </header>

      <EditChildForm
        childId={child.id}
        defaultDisplayName={child.displayName}
        defaultGender={child.gender}
        defaultBirthYear={child.birthYear}
      />

      <section className="flex flex-col gap-2 rounded-2xl border border-[var(--color-sand-200)] bg-white/60 p-4">
        <h2 className="text-sm font-bold text-[var(--color-ocean-900)]">
          📚 Homework / 作业
        </h2>
        <p className="text-xs text-[var(--color-sand-700)]">
          Pick a week to add homework for {child.displayName}.
        </p>
        {weeks.length === 0 ? (
          <p className="text-sm text-[var(--color-sand-600)]">
            No playable weeks yet for this child.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {weeks.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/parent/children/${child.id}/homework/${w.id}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-sand-200)] bg-white px-3 py-2 text-sm hover:border-[var(--color-ocean-400)]"
                >
                  <span className="font-medium text-[var(--color-ocean-900)]">
                    Week {w.weekNumber} · {w.label}
                  </span>
                  <span className="text-[var(--color-ocean-600)]">作业 →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-[var(--color-bad-bg)] bg-[var(--color-bad-bg)]/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-bad)]">
          Danger zone
        </h2>
        <p className="text-xs text-[var(--color-sand-700)]">
          Removes all play sessions, attempts, coins, and inventory for this
          child. Cannot be undone.
        </p>
        <DeleteChildButton childId={child.id} childName={child.displayName} />
      </section>
    </main>
  );
}
