import Link from 'next/link';
import { AddChildForm } from '@/components/parent/AddChildForm';
import { assertParent } from '@/lib/auth/guards';
import { listChildrenByParent } from '@/lib/db/children';

export default async function ChildrenPage() {
  const parent = await assertParent();
  const children = await listChildrenByParent(parent.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Children</h1>
        <Link href="/parent" className="text-sm text-zinc-600 hover:underline">
          ← Back to dashboard
        </Link>
      </header>

      <AddChildForm />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Existing
        </h2>
        {children.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No children yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {children.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded border border-zinc-100 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{c.displayName}</p>
                  <p className="text-xs text-zinc-500">
                    {c.birthYear ? `Born ${c.birthYear}` : 'Birth year not set'}
                  </p>
                </div>
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
    </main>
  );
}
