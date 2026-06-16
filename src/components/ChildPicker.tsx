import Link from 'next/link';

interface PickerChild {
  id: string;
  displayName: string;
}

export function ChildPicker({ players }: { players: PickerChild[] }) {
  return (
    <section className="flex w-full max-w-md flex-col gap-3">
      <h2 className="text-center text-sm font-semibold text-[var(--color-ocean-900)]">
        <span className="font-hanzi">选择小航海家</span>
        <span className="text-[var(--color-sand-700)]"> / Choose a player</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {players.map((c) => (
          <li key={c.id}>
            <Link
              href={`/play/${c.id}`}
              className="flex items-center justify-between rounded-2xl border-2 border-[var(--color-ocean-300)] bg-white px-5 py-4 shadow-sm transition-transform hover:bg-[var(--color-ocean-100)] active:scale-[0.98]"
            >
              <span className="text-lg font-bold text-[var(--color-ocean-900)]">
                {c.displayName}
              </span>
              <span className="text-sm font-semibold text-[var(--color-ocean-700)]">
                开始 / Play →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
