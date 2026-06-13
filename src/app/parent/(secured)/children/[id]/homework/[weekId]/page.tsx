import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assertParent } from '@/lib/auth/guards';
import { getChildOwnedBy } from '@/lib/db/children';
import { getPlayableWeekForChild } from '@/lib/db/weeks';
import { listHomeworkItems } from '@/lib/db/homework';
import { parseHomeworkConfig } from '@/lib/homework/schemas';
import { HomeworkEditor } from '@/components/parent/HomeworkEditor';

/** One-line summary of a homework item for the editor list. */
function summarizeHomework(type: string, config: unknown): string {
  try {
    const c = parseHomeworkConfig(type as never, config);
    if (c.type === 'sentence_order') return c.tokens.join(' / ');
    if (c.type === 'char_quiz') return c.questionZh;
    return `给「${c.baseChar}」组词`;
  } catch {
    return '(invalid item)';
  }
}

interface PageProps {
  // The `children/[id]` segment IS the childId (kept as `id` so the sibling
  // child page and this nested route share one slug name — Next.js requires it).
  params: Promise<{ id: string; weekId: string }>;
}

export default async function ChildWeekHomeworkPage({ params }: PageProps) {
  const { id: childId, weekId } = await params;
  const parent = await assertParent();
  const child = await getChildOwnedBy(childId, parent.id);
  if (!child) notFound();
  const week = await getPlayableWeekForChild(childId, weekId);
  if (!week) notFound();

  const rows = await listHomeworkItems(childId, weekId);
  const items = rows.map((r) => ({
    id: r.id,
    type: r.type,
    summary: summarizeHomework(r.type, r.config),
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-hanzi text-2xl font-bold tracking-tight text-[var(--color-ocean-900)]">
            {child.displayName} · {week.label}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
            Homework · Week {week.weekNumber}
          </p>
        </div>
        <Link
          href={`/parent/children/${childId}`}
          className="text-sm font-semibold text-[var(--color-ocean-700)] hover:underline"
        >
          ← Back
        </Link>
      </header>

      <HomeworkEditor childId={childId} weekId={weekId} items={items} />
    </main>
  );
}
