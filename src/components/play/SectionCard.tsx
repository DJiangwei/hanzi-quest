import Link from 'next/link';

interface Props {
  href: string;
  emoji: string;
  titleZh: string;
  titleEn: string;
  progressText: string;
  state: 'idle' | 'in-progress' | 'cleared' | 'locked';
  lockedReason?: string;
}

const STATE_STYLES: Record<Props['state'], string> = {
  idle:          'border-amber-800/40 bg-amber-50 text-amber-900 hover:bg-amber-100',
  'in-progress': 'border-amber-800/60 bg-amber-100 text-amber-950 hover:bg-amber-200',
  cleared:       'border-[var(--color-treasure-700)] bg-[var(--color-treasure-400)] text-[var(--color-treasure-700)] hover:bg-[var(--color-treasure-500)]',
  locked:        'border-gray-400 bg-gray-100 text-gray-500 cursor-not-allowed',
};

const CHIP: Record<Props['state'], string | null> = {
  idle:          null,
  'in-progress': '🔥',
  cleared:       '✨',
  locked:        '🔒',
};

export function SectionCard({
  href,
  emoji,
  titleZh,
  titleEn,
  progressText,
  state,
  lockedReason,
}: Props) {
  const chip = CHIP[state];
  const inner = (
    <div
      className={[
        'flex w-full items-center gap-4 rounded-2xl border-4 p-5 shadow-md transition',
        STATE_STYLES[state],
      ].join(' ')}
    >
      <div className="text-5xl" aria-hidden>
        {emoji}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="text-xl font-extrabold">{titleZh}</div>
        <div className="text-xs font-semibold opacity-80">{titleEn}</div>
        <div className="mt-1 text-sm font-bold">
          {progressText}
          {chip ? <span className="ml-1.5">{chip}</span> : null}
        </div>
        {state === 'locked' && lockedReason ? (
          <div className="text-xs">{lockedReason}</div>
        ) : null}
      </div>
    </div>
  );

  if (state === 'locked') {
    return (
      <div aria-disabled className="block">
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="block rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-sunset-400)]"
    >
      {inner}
    </Link>
  );
}
