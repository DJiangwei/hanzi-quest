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

/** Pixel box for the rendered `<img>` per card size. */
const imgSize: Record<CardArtProps['size'], string> = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-28 w-28',
};

/** Emoji font-size per card size (matches the legacy inline emoji blocks). */
const emojiSize: Record<CardArtProps['size'], string> = {
  sm: 'text-3xl',
  md: 'text-4xl',
  lg: 'text-7xl',
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
