interface Props {
  /** Bosses beaten on the current map — one key each. */
  earned: number;
  /** Published weeks on the current map. */
  total: number;
  /** Bilingual name of the treasure waiting at a full ring of keys. */
  prizeZh: string;
  prizeEn: string;
  /** True once the vault has been opened (all keys collected). */
  opened: boolean;
}

/**
 * 🗝️ 钥匙链 / Key ring (T3): the long-arc progress bar for a whole map. One key
 * per weekly boss beaten — the count is DERIVED from week progress, never
 * stored, so it can't drift from reality.
 *
 * Its job is motivational legibility: the child can see, from the home page,
 * exactly how many bosses stand between her and the map's grand treasure.
 * Renders nothing for a map with no published weeks.
 */
export function KeyTrack({ earned, total, prizeZh, prizeEn, opened }: Props) {
  if (total <= 0) return null;
  const clamped = Math.min(earned, total);

  return (
    <section
      data-testid="key-track"
      data-earned={clamped}
      data-total={total}
      className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-100 px-4 py-3 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-hanzi text-sm font-extrabold text-emerald-900">
          🗝️ 钥匙链
          <span className="ml-1 text-xs font-semibold text-emerald-800/80">/ Key ring</span>
        </h2>
        <span className="text-sm font-extrabold tabular-nums text-emerald-900">
          {clamped}/{total}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            data-testid={i < clamped ? 'key-filled' : 'key-empty'}
            className={[
              'text-base leading-none',
              i < clamped ? '' : 'opacity-25 grayscale',
            ].join(' ')}
          >
            🗝️
          </span>
        ))}
      </div>

      <p className="mt-2 text-xs leading-snug text-emerald-900">
        {opened ? (
          <>
            <span className="font-hanzi font-bold">
              💎 宝库已开启！你赢得了「{prizeZh}」
            </span>
            <span className="block font-medium text-emerald-800/80">
              Vault opened — you won “{prizeEn}”!
            </span>
          </>
        ) : (
          <>
            <span className="font-hanzi font-bold">
              打通每座岛的 Boss 得 1 把钥匙，集齐 {total} 把开启「{prizeZh}」
            </span>
            <span className="block font-medium text-emerald-800/80">
              One key per island boss — collect all {total} to open “{prizeEn}”
            </span>
          </>
        )}
      </p>
    </section>
  );
}
