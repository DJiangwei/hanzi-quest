import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InsightsPanel } from '@/components/parent/InsightsPanel';
import { requireChild } from '@/lib/auth/guards';
import { getChildInsights } from '@/lib/db/insights';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * A3 — what she actually gets wrong, for aiming homework.
 *
 * Inside the `(secured)` route group, so the PIN gate applies; `requireChild`
 * scopes the read to this parent's own child and a miss is a 404, matching the
 * sibling piggy-bank page.
 */
export default async function InsightsPage({ params }: PageProps) {
  const { id } = await params;

  let child;
  try {
    ({ child } = await requireChild(id));
  } catch {
    notFound();
  }

  const data = await getChildInsights(child.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header>
        <Link
          href={`/parent/children/${child.id}`}
          className="text-xs font-semibold text-stone-500 hover:text-stone-800"
        >
          ← {child.displayName}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-stone-900">Learning insights</h1>
        <p className="mt-1 text-sm text-stone-600">
          Read-only, from the answer log. Nothing here changes what {child.displayName} sees.
        </p>
      </header>

      <InsightsPanel data={data} />
    </main>
  );
}
