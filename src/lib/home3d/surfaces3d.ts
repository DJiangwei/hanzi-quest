/**
 * 3D colour equivalents for the 19 wallpapers and floors.
 *
 * The 2D catalog draws each surface as an SVG `<g>` — gradients, dots, stripes,
 * checkerboards. None of that transfers, so this is a deliberate re-authoring
 * rather than an extraction: a surface's job in 3D is to set the room's light
 * and mood, which is carried by two or three flat colours plus how the planks
 * and wainscot are tinted.
 *
 * PURE and client-safe: no three, no React. Keyed by the SAME slugs the 2D
 * catalog and `home_room_surfaces` use, so the two views can never disagree
 * about which wallpaper a child has equipped — a test pins that every slug in
 * `SURFACES` has an entry here.
 */

export interface Surface3D {
  /** Main field colour. */
  base: string;
  /** Second tone: the wainscot band on a wall, alternate planks on a floor. */
  alt: string;
  /** Trim — skirting and picture rail — or plank seams. */
  trim: string;
  /** True for the yard's skies and grounds, which are lit and shaped outdoors. */
  outdoor?: boolean;
}

export const WALLPAPERS_3D: Record<string, Surface3D> = {
  'wall-peach': { base: '#fbf0da', alt: '#eddcb8', trim: '#fdf6e7' },
  'wall-blue': { base: '#bfe2f5', alt: '#a2d2ee', trim: '#f0fbff' },
  'wall-yellow': { base: '#fdf1c8', alt: '#f6e3a4', trim: '#fffae6' },
  'wall-stars': { base: '#3b4a86', alt: '#2d3a6d', trim: '#e8e2ff' },
  'wall-wood': { base: '#d9b184', alt: '#c79a69', trim: '#f2e0c4' },
  'wall-pastel-dots': { base: '#fad6e6', alt: '#f4bed6', trim: '#fff4f9' },
  'wall-mint-stripe': { base: '#c8ecdd', alt: '#aadfca', trim: '#f0fdf7' },
  // Outdoor skies — the yard has no wall, so these tint the sky dome instead.
  'sky-day': { base: '#9fd9f0', alt: '#c9ecfa', trim: '#ffffff', outdoor: true },
  'sky-sunset': { base: '#f8b98c', alt: '#f6d5a8', trim: '#fff0d8', outdoor: true },
};

export const FLOORS_3D: Record<string, Surface3D> = {
  'floor-honey': { base: '#e8cfa8', alt: '#dfc39a', trim: '#c9a97e' },
  'floor-stone': { base: '#dcd8cc', alt: '#ccc7b9', trim: '#b0aa9c' },
  'floor-seafoam': { base: '#cfe9dd', alt: '#c0dfd1', trim: '#a8ccbd' },
  'floor-checker': { base: '#f4ece0', alt: '#4a4a55', trim: '#d9d2c6' },
  'floor-grass': { base: '#8fca70', alt: '#82c064', trim: '#6ea855' },
  'floor-cloud-carpet': { base: '#eef4fb', alt: '#dfe9f6', trim: '#c9d6e8' },
  'floor-darkwood': { base: '#9a7350', alt: '#8b6746', trim: '#6f5136' },
  // Outdoor grounds
  'ground-lawn': { base: '#8fca70', alt: '#83be64', trim: '#6ea855', outdoor: true },
  'ground-sand': { base: '#f0dcae', alt: '#e6cf9c', trim: '#cfb684', outdoor: true },
  'ground-deck': { base: '#d0a273', alt: '#c39364', trim: '#a87c52', outdoor: true },
};

const FALLBACK: Surface3D = { base: '#fbf0da', alt: '#eddcb8', trim: '#fdf6e7' };

/**
 * Never throws and never returns undefined.
 *
 * A missing slug means a surface exists in the 2D catalog with no 3D entry —
 * a content gap, not a crash. The room renders in its default tones and the
 * child sees a plain wall rather than an error, the same way `ImageWordScene`
 * falls back to a text card when a word has no picture.
 */
export function wallpaper3D(slug: string | undefined): Surface3D {
  return (slug && WALLPAPERS_3D[slug]) || FALLBACK;
}

export function floor3D(slug: string | undefined): Surface3D {
  return (slug && FLOORS_3D[slug]) || FLOORS_3D['floor-honey'];
}
