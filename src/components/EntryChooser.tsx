import {
  chooseKidEntryAction,
  chooseParentEntryAction,
} from '@/lib/actions/entry';

interface ChooserChild {
  id: string;
  displayName: string;
}

/**
 * Post-login fork: enter the kid game (no PIN) or parent control (PIN-gated).
 * Server component — each option is a `<form>` bound to a server action that
 * remembers the choice (cookie) then redirects. Shown on first login and again
 * via `/?choose=1`.
 */
export function EntryChooser({ players }: { players: ChooserChild[] }) {
  const single = players.length === 1 ? players[0] : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-[var(--color-sand-50)] px-6 py-12 text-center">
      <h1 className="font-hanzi text-5xl font-bold tracking-tight text-[var(--color-ocean-900)]">
        汉字探险
      </h1>

      <div className="flex w-full max-w-sm flex-col gap-4">
        {/* Kid entry — no PIN. */}
        {single ? (
          <form action={chooseKidEntryAction.bind(null, single.id)}>
            <button
              type="submit"
              className="flex w-full flex-col items-center gap-1 rounded-3xl bg-[var(--color-ocean-500)] px-6 py-7 text-white shadow-lg transition-transform hover:bg-[var(--color-ocean-700)] active:scale-[0.98]"
            >
              <span className="text-3xl" aria-hidden>
                🎮
              </span>
              <span className="text-xl font-bold">开始游戏</span>
              <span className="text-sm font-medium opacity-90">
                Play{single.displayName ? ` · ${single.displayName}` : ''}
              </span>
            </button>
          </form>
        ) : players.length > 1 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-ocean-900)]">
              <span className="font-hanzi">开始游戏</span>
              <span className="text-[var(--color-sand-700)]"> / Play</span>
            </h2>
            {players.map((c) => (
              <form key={c.id} action={chooseKidEntryAction.bind(null, c.id)}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-2xl border-2 border-[var(--color-ocean-300)] bg-white px-5 py-4 shadow-sm transition-transform hover:bg-[var(--color-ocean-100)] active:scale-[0.98]"
                >
                  <span className="text-lg font-bold text-[var(--color-ocean-900)]">
                    {c.displayName}
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-ocean-700)]">
                    🎮 开始 / Play →
                  </span>
                </button>
              </form>
            ))}
          </section>
        ) : null}

        {/* Parent entry — PIN-gated downstream. */}
        <form action={chooseParentEntryAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--color-sand-200)] bg-white px-6 py-4 text-[var(--color-sand-700)] shadow-sm transition-transform hover:bg-[var(--color-sand-100)] active:scale-[0.98]"
          >
            <span aria-hidden>⚙️</span>
            <span className="font-semibold">
              <span className="font-hanzi">家长</span>
              <span> / Parent</span>
            </span>
            <span aria-hidden>🔒</span>
          </button>
        </form>
      </div>

      <p className="max-w-xs text-xs text-[var(--color-sand-700)]">
        <span className="font-hanzi">下次自动进入这里 · </span>
        <span>We&apos;ll remember your choice next time</span>
      </p>
    </main>
  );
}
