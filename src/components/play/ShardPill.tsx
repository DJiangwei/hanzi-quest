interface ShardPillProps {
  count: number;
}

export function ShardPill({ count }: ShardPillProps) {
  return (
    <span
      aria-label={`${count} shards`}
      className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-900"
    >
      <span aria-hidden>🔹</span>
      <span>{count}</span>
    </span>
  );
}
