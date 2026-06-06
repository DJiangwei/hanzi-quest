'use client';

interface Props {
  level: number;
  title: { zh: string; en: string };
}

/**
 * Small pill showing the child's current pirate rank.
 * Example: ⚓ Lv 3 · 水手
 */
export function LevelBadge({ level, title }: Props) {
  return (
    <span
      data-testid="level-badge"
      className="flex items-center gap-1 rounded-full border border-[var(--color-ocean-300)] bg-[var(--color-ocean-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-ocean-800)]"
    >
      <span aria-hidden="true">⚓</span>
      <span>Lv {level}</span>
      <span aria-hidden="true">·</span>
      <span className="font-hanzi">{title.zh}</span>
    </span>
  );
}
