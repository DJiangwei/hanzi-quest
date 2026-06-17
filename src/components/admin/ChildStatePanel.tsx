interface Props {
  coins: number;
  xp: number;
  shards: number;
  ownedCount: number;
}

export function ChildStatePanel({ coins, xp, shards, ownedCount }: Props) {
  return (
    <section
      data-testid="child-state-panel"
      className="rounded-2xl border border-[var(--color-sand-200)] bg-white p-5 shadow-sm"
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-700)]">
        Child State / 当前状态
      </h2>
      <div className="flex flex-wrap gap-6">
        <Stat icon="🪙" label="Coins" value={coins} />
        <Stat icon="⭐" label="XP" value={xp} />
        <Stat icon="🔹" label="Shards" value={shards} />
        <Stat icon="🎴" label="Cards Owned" value={ownedCount} />
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl">{icon}</span>
      <span className="text-xl font-bold text-[var(--color-ocean-900)]">
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-[var(--color-sand-600)]">{label}</span>
    </div>
  );
}
