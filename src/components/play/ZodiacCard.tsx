// src/components/play/ZodiacCard.tsx
import {
  ZODIAC_HANZI,
  ZODIAC_NAME_EN,
  ZodiacIcon,
  type ZodiacSlug,
} from './zodiac-icons';

interface Props {
  slug: ZodiacSlug;
  owned: boolean;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

const sizeClasses: Record<NonNullable<Props['size']>, string> = {
  sm: 'w-20 aspect-square p-2',
  md: 'aspect-square p-2',
  lg: 'w-56 aspect-square p-6',
};

const hanziSize: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-[12px]',
  md: 'text-[14px]',
  lg: 'text-[32px]',
};

export function ZodiacCard({ slug, owned, size = 'md', showName }: Props) {
  const cardBg = owned
    ? 'bg-[radial-gradient(ellipse_at_center,#fef9ef_0%,#fef9ef_60%,#f5e0a8_100%)] border-[#c89f5e] shadow-[inset_0_0_0_2px_rgba(245,197,55,0.5),0_2px_4px_rgba(0,0,0,0.1)]'
    : 'bg-[linear-gradient(180deg,#ece4d0_0%,#d8c89a_100%)] border-[#999]';

  const iconClass = owned
    ? 'h-3/5 w-3/5'
    : 'h-3/5 w-3/5 grayscale opacity-30';

  return (
    <div
      data-testid="zodiac-card"
      data-owned={owned ? 'true' : 'false'}
      data-size={size}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 ${cardBg} ${sizeClasses[size]}`}
    >
      <div className={iconClass}>
        <ZodiacIcon slug={slug} className="h-full w-full" />
      </div>
      <div
        className={`font-hanzi font-bold ${hanziSize[size]} ${
          owned ? 'text-[#4a2e10]' : 'text-[#4a2e10]/40'
        }`}
      >
        {ZODIAC_HANZI[slug]}
      </div>
      {showName && (
        <div className="text-xs text-[#6b4720]">{ZODIAC_NAME_EN[slug]}</div>
      )}
    </div>
  );
}
