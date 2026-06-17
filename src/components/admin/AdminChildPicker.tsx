import Link from 'next/link';
import type { AdminChildSummary } from '@/lib/actions/admin';

interface Props {
  items: AdminChildSummary[];
  selectedChildId?: string;
}

const GENDER_ICON: Record<string, string> = {
  boy: '👦',
  girl: '👧',
};

export function AdminChildPicker({ items, selectedChildId }: Props) {
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--color-sand-200)] bg-white p-5 shadow-sm">
        <p className="text-sm text-[var(--color-sand-700)]">
          No child profiles found across all accounts.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="admin-child-picker"
      className="rounded-2xl border border-[var(--color-sand-200)] bg-white p-5 shadow-sm"
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
        Select Child / 选择孩子
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((c) => {
          const isSelected = c.id === selectedChildId;
          return (
            <li key={c.id}>
              <Link
                href={`/admin?child=${c.id}`}
                className={`flex items-center justify-between rounded-xl px-4 py-3 transition-colors ${
                  isSelected
                    ? 'bg-[var(--color-ocean-700)] text-white'
                    : 'bg-[var(--color-sand-50)] text-[var(--color-sand-900)] hover:bg-[var(--color-sand-100)]'
                }`}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">
                    {c.gender ? (GENDER_ICON[c.gender] ?? '🧒') : '🧒'}{' '}
                    {c.displayName}
                  </span>
                  <span
                    className={`text-xs ${isSelected ? 'text-white/70' : 'text-[var(--color-sand-600)]'}`}
                  >
                    {c.parentEmail}
                  </span>
                </span>
                {isSelected && (
                  <span className="text-xs font-semibold text-white/80">
                    ← selected
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
