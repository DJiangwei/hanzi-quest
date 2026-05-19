import { useId } from 'react';
import { lookupItem } from '@/lib/avatar/itemCatalog';
import { DEFAULT_AVATAR, type AvatarSlotId } from '@/lib/avatar/defaultLook';

export interface AvatarRenderProps {
  /** Map of slot id → equipped unlock_ref. Missing slots fall back to the catalog default. */
  equipped?: Partial<Record<AvatarSlotId, string | null | undefined>>;
  /** Render size in CSS pixels. Defaults to 72px (HUD size). */
  size?: number;
  /** Extra class on the outer SVG. */
  className?: string;
  /** Accessible label (default: "我的形象"). Pass empty string to hide. */
  label?: string;
}

/**
 * Composes the four avatar slots (background → top → head → hat) into a single
 * SVG. Unknown or missing slug falls back to that slot's default item from the
 * catalog.
 */
export function AvatarRender({
  equipped,
  size = 72,
  className,
  label = '我的形象',
}: AvatarRenderProps) {
  const clipId = `avatar-clip-${useId().replace(/:/g, '')}`;
  const layers: { slot: AvatarSlotId; ref: string }[] = [
    { slot: 'background', ref: equipped?.background ?? DEFAULT_AVATAR.background },
    { slot: 'top', ref: equipped?.top ?? DEFAULT_AVATAR.top },
    { slot: 'head', ref: equipped?.head ?? DEFAULT_AVATAR.head },
    { slot: 'hat', ref: equipped?.hat ?? DEFAULT_AVATAR.hat },
  ];

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
        {layers.map(({ slot, ref }) => {
          const item = lookupItem(ref) ?? lookupItem(DEFAULT_AVATAR[slot]);
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
