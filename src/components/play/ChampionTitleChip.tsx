interface Props {
  titleZh: string | null;
  titleEn: string | null;
}

/** 👑 bilingual "map champion" title chip, shown near the LevelBadge on home.
 *  Renders null unless both halves of the title are present. */
export function ChampionTitleChip({ titleZh, titleEn }: Props) {
  if (!titleZh || !titleEn) return null;
  return (
    <span
      data-testid="champion-title-chip"
      className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-900 shadow-sm"
    >
      <span aria-hidden>👑</span>
      <span className="font-hanzi">{titleZh}</span>
      <span className="opacity-70">/ {titleEn}</span>
    </span>
  );
}
