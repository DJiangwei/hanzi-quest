import { useId } from 'react';
import { lookupItem } from '@/lib/avatar/itemCatalog';
import { AVATAR_SLOT_IDS, DEFAULT_AVATAR, type AvatarSlotId } from '@/lib/avatar/defaultLook';

export interface AvatarRenderProps {
  /** Map of slot id → equipped unlock_ref. Missing slots fall back to the catalog default (if defined). */
  equipped?: Partial<Record<AvatarSlotId, string | null | undefined>>;
  /** Render size in CSS pixels. Defaults to 72px (HUD size). */
  size?: number;
  /** Extra class on the outer SVG. */
  className?: string;
  /** Accessible label (default: "我的形象"). Pass empty string to hide. */
  label?: string;
}

/**
 * Composes the 7 avatar slots into a single SVG using AVATAR_SLOT_IDS as the
 * render order (back → front). Missing items + slots without a default
 * (decor) render nothing.
 */
export function AvatarRender({
  equipped,
  size = 72,
  className,
  label = '我的形象 / My avatar',
}: AvatarRenderProps) {
  const clipId = `avatar-clip-${useId().replace(/:/g, '')}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={label ? 'img' : 'presentation'}
      aria-label={label || undefined}
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {AVATAR_SLOT_IDS.map((slot) => {
          // Resolve item: equipped → fall back to DEFAULT_AVATAR[slot] if present
          const ref =
            equipped?.[slot] ??
            (DEFAULT_AVATAR as Record<string, string>)[slot] ??
            null;
          if (!ref) return null;
          const item = lookupItem(ref);
          if (!item) return null;
          return <g key={slot}>{item.renderSvg()}</g>;
        })}
      </g>
      <circle
        cx="50"
        cy="50"
        r="49"
        fill="none"
        stroke="#7a4a14"
        strokeWidth="2"
      />
    </svg>
  );
}
