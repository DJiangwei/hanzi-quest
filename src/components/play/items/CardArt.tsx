export interface CardArtProps {
  /**
   * A real image URL (Vercel Blob) when the card has generated cartoon art, or
   * an emoji glyph / null when it doesn't. Only `http(s)` values render as an
   * `<img>`; anything else falls back to the emoji glyph.
   */
  imageUrl: string | null | undefined;
  /** Emoji glyph fallback when no real image is set. */
  emoji: string;
  owned: boolean;
  size: 'sm' | 'md' | 'lg';
  /** Accessible label (the card's English name). */
  alt: string;
}

/**
 * Box for the rendered `<img>` per card size. Fluid (`w-full` + a max cap)
 * rather than a fixed square: the art used to sit at a fixed 64px inside a
 * ~110px-wide grid tile, which read as tiny on a phone. Filling the tile width
 * and capping keeps it large on small screens without ballooning on tablets.
 */
const imgSize: Record<CardArtProps['size'], string> = {
  sm: 'aspect-square w-full max-w-[56px]',
  md: 'aspect-square w-full max-w-[104px]',
  lg: 'aspect-square w-full max-w-[168px]',
};

/** Emoji font-size per card size (the glyph fallback tracks the image box). */
const emojiSize: Record<CardArtProps['size'], string> = {
  sm: 'text-3xl',
  md: 'text-5xl',
  lg: 'text-8xl',
};

const HTTP_URL = /^https?:\/\//i;

/**
 * Shared art slot for collectible cards. Renders the pack's generated cartoon
 * illustration when `imageUrl` is a real http(s) URL, otherwise falls back to
 * the emoji glyph. Unowned cards are dimmed + desaturated in both modes.
 *
 * Mirrors the `<img>`-with-text-fallback pattern in `ImageWordScene`. Lets the
 * Codex art backfill (writing real URLs into `collectible_items.image_url`)
 * light up the cards with zero per-card code changes.
 */
export function CardArt({ imageUrl, emoji, owned, size, alt }: CardArtProps) {
  if (imageUrl && HTTP_URL.test(imageUrl)) {
    return (
      <div
        className={[
          imgSize[size],
          'overflow-hidden rounded-lg leading-none',
          owned ? '' : 'opacity-40 grayscale',
        ].join(' ')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={[
        emojiSize[size],
        'leading-none',
        owned ? '' : 'opacity-40 grayscale',
      ].join(' ')}
      aria-label={alt}
    >
      {emoji}
    </div>
  );
}
