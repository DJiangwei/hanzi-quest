'use client';

import { getPiggyCategory } from '@/lib/piggy/categories';
import { formatPence } from '@/lib/piggy/money';

interface Props {
  /** Positive pence per category slug. Categories with no spend are absent. */
  spendByCategory: Record<string, number>;
}

/**
 * Horizontal bars, largest first — NOT a pie. A six-year-old reads "🍬 is the
 * longest bar" instantly and cannot read a pie's angles.
 *
 * Renders nothing when she has spent nothing: a row of zero-length stubs would
 * be noise, and an "you have spent nothing" message is the kind of scolding
 * empty state this feature avoids everywhere else.
 *
 * dataviz-skill notes (this is a single-series nominal-categorical bar chart —
 * category order is display-only, spend does the ranking):
 * - One series, one hue for every bar (never a value-ramp on nominal
 *   categories) — no legend box needed, the section header names the metric.
 *   `--color-sunset-600` on `--color-sand-100` clears lightness/chroma/contrast
 *   cleanly (validated against the skill's checks); the brief's plain
 *   `amber-500` only cleared with a contrast WARN.
 * - Bars are square at the baseline (left) and 4px-rounded at the data end
 *   (right), per the mark spec — not a pill on both ends.
 * - Value sits just outside the bar's tip rather than inside it: at this
 *   track width a short bar (e.g. the smallest of 5+ categories) has no room
 *   for an inline label, so outside-the-mark is the one placement that never
 *   clips.
 * - A small visual floor keeps the smallest bar visibly a bar (never an
 *   invisible sliver) without touching the printed £ value.
 */
export function PiggyBreakdown({ spendByCategory }: Props) {
  const rows = Object.entries(spendByCategory)
    .filter(([, pence]) => pence > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) return null;

  const max = rows[0][1];

  return (
    <section
      data-testid="piggy-breakdown"
      className="flex flex-col gap-2 rounded-2xl bg-white/70 p-3"
    >
      <h2 className="text-xs font-bold text-[var(--color-sand-700)]">
        <span className="font-hanzi">花在哪儿</span>{' '}
        <span className="font-normal italic text-[var(--color-sand-700)]/80">
          / Where it went
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {rows.map(([slug, pence]) => {
          const cat = getPiggyCategory(slug);
          const pct = Math.max(4, Math.round((pence / max) * 100));
          return (
            <li
              key={slug}
              data-testid={`piggy-bar-${slug}`}
              className="flex items-center gap-2 text-xs"
            >
              <span className="w-5 text-base" aria-hidden="true">
                {cat?.emoji ?? '✨'}
              </span>
              <span className="w-20 shrink-0">
                <span className="font-hanzi text-[var(--color-sand-900)]">
                  {cat?.zh ?? slug}
                </span>
                <span className="block text-[10px] italic text-[var(--color-sand-700)]">
                  {cat?.en ?? slug}
                </span>
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-[4px] bg-[var(--color-sunset-100)]">
                <span
                  className="block h-full rounded-r-[4px] bg-[var(--color-sunset-600)]"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-16 text-right font-semibold text-[var(--color-sand-900)]">
                {formatPence(pence)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
