import { SEA_GRADIENT, SEA_WAVES } from '@/lib/play/voyage-textures';

interface Props {
  /** Generated illustrated sea-chart (Vercel Blob). When absent, a richer
   *  procedural sea-chart is drawn instead. */
  imageUrl?: string;
}

/**
 * Fills the voyage board's sea panel. When a flux-generated illustration exists
 * it's rendered `object-cover`; otherwise a decorative procedural sea-chart is
 * drawn (sea + waves + compass rose + small islands + a friendly sea monster) —
 * strictly richer than the old flat gradient and good enough to ship before any
 * image is generated. Purely decorative (`aria-hidden`).
 *
 * Mirrors the `<img>`-with-fallback pattern in `ImageWordScene` / `CardArt`.
 */
export function VoyageBackdrop({ imageUrl }: Props) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundImage: `${SEA_WAVES},${SEA_GRADIENT}` }}
    >
      {/* Compass rose, top-right */}
      <svg
        viewBox="0 0 100 100"
        className="absolute right-[3%] top-[5%] h-[26%] w-[26%] opacity-30"
        fill="none"
      >
        <circle cx="50" cy="50" r="38" stroke="#f3e4c0" strokeWidth="2" />
        <circle cx="50" cy="50" r="30" stroke="#f3e4c0" strokeWidth="1" />
        <polygon points="50,6 56,50 50,46 44,50" fill="#f3e4c0" />
        <polygon points="50,94 44,50 50,54 56,50" fill="#cfe9ea" />
        <polygon points="6,50 50,44 46,50 50,56" fill="#cfe9ea" />
        <polygon points="94,50 50,56 54,50 50,44" fill="#cfe9ea" />
      </svg>

      {/* Two small tropical islands */}
      <svg
        viewBox="0 0 100 100"
        className="absolute left-[8%] top-[58%] h-[22%] w-[22%] opacity-80"
      >
        <ellipse cx="50" cy="72" rx="34" ry="14" fill="#e9d3a3" />
        <path d="M50 70 L46 40 L54 40 Z" fill="#8a5a2b" />
        <circle cx="50" cy="38" r="12" fill="#3f9d57" />
      </svg>
      <svg
        viewBox="0 0 100 100"
        className="absolute left-[62%] top-[62%] h-[16%] w-[16%] opacity-75"
      >
        <ellipse cx="50" cy="74" rx="30" ry="12" fill="#e9d3a3" />
        <circle cx="50" cy="52" r="14" fill="#3f9d57" />
      </svg>

      {/* Friendly sea-monster silhouette, lower-mid */}
      <svg
        viewBox="0 0 100 40"
        className="absolute left-[30%] top-[40%] h-[12%] w-[34%] opacity-25"
        fill="#0f5158"
      >
        <path d="M2 30 Q12 14 22 30 Q32 14 42 30 Q52 14 62 30 Q72 18 80 28 Q86 22 92 26 L92 34 Q50 40 8 34 Z" />
      </svg>
    </div>
  );
}
