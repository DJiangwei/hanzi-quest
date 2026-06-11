import type { ReactElement } from 'react';
import { createElement as h } from 'react';

export type SurfaceKind = 'wallpaper' | 'floor';

export interface SurfaceDef {
  slug: string;
  kind: SurfaceKind;
  nameZh: string;
  nameEn: string;
  rarity: 'common' | 'rare' | 'epic';
  priceCoins: number;
  /** Free starter surface (a room's default) — equippable without buying. */
  isDefault?: boolean;
  /**
   * SVG `<g>` filling ONLY this surface's zone of the `0 0 100 75` room viewBox:
   * wallpaper → y 0..25, floor → y 25..75. Solid + slug-scoped-gradient fills
   * (no shared `<defs>` ids — slugs are unique and a surface renders once/page).
   */
  render: () => ReactElement;
}

/* ── tiny JSX-free SVG helpers (this is a .ts file) ─────────────────────────── */
type P = Record<string, string | number>;
const el = (tag: string, props: P, ...kids: ReactElement[]) => h(tag, props, ...kids);
const rect = (p: P) => el('rect', p);
const line = (p: P) => el('line', p);
const circ = (p: P) => el('circle', p);
const grad = (id: string, from: string, to: string, vertical = true) =>
  el(
    'linearGradient',
    { id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 },
    el('stop', { offset: 0, 'stop-color': from }),
    el('stop', { offset: 1, 'stop-color': to }),
  );
const g = (...kids: ReactElement[]) => h('g', { 'aria-hidden': true }, ...kids);

/* ── WALLPAPERS (wall zone: 0..25) ──────────────────────────────────────────── */

function wallPeach(): ReactElement {
  return g(
    el('defs', {}, grad('sg-wall-peach', '#fbe9d6', '#f3d3b6')),
    rect({ x: 0, y: 0, width: 100, height: 25, fill: 'url(#sg-wall-peach)' }),
    ...[14, 28, 42, 56, 70, 84].map((x) =>
      line({ key: x, x1: x, y1: 0, x2: x, y2: 25, stroke: '#eccba3', 'stroke-width': 0.4 }),
    ),
  );
}
function wallBlue(): ReactElement {
  return g(
    el('defs', {}, grad('sg-wall-blue', '#d4ecf8', '#b8d4e8')),
    rect({ x: 0, y: 0, width: 100, height: 25, fill: 'url(#sg-wall-blue)' }),
    ...[12.5, 37.5, 62.5, 87.5].flatMap((x) =>
      [7, 17].map((y) => circ({ key: `${x}-${y}`, cx: x, cy: y, r: 1, fill: '#a8c8e0' })),
    ),
  );
}
function wallYellow(): ReactElement {
  return g(
    el('defs', {}, grad('sg-wall-yellow', '#fdf0a8', '#f9e580')),
    rect({ x: 0, y: 0, width: 100, height: 25, fill: 'url(#sg-wall-yellow)' }),
    ...[10, 30, 50, 70, 90].flatMap((x) =>
      [6, 16].map((y) => circ({ key: `${x}-${y}`, cx: x, cy: y, r: 1.1, fill: '#f0d040' })),
    ),
  );
}
function wallStars(): ReactElement {
  return g(
    el('defs', {}, grad('sg-wall-stars', '#3a3470', '#241f52')),
    rect({ x: 0, y: 0, width: 100, height: 25, fill: 'url(#sg-wall-stars)' }),
    circ({ cx: 84, cy: 7, r: 3.4, fill: '#ffe27a' }),
    ...[
      [12, 8], [26, 15], [40, 6], [54, 13], [68, 9], [20, 19], [48, 20], [76, 18], [92, 14],
    ].map(([cx, cy], i) => circ({ key: i, cx, cy, r: 0.7, fill: '#dfe7ff' })),
  );
}
function wallWood(): ReactElement {
  return g(
    rect({ x: 0, y: 0, width: 100, height: 25, fill: '#caa173' }),
    ...[0, 14, 28, 42, 56, 70, 84, 100].map((x) =>
      line({ key: x, x1: x, y1: 0, x2: x, y2: 25, stroke: '#b08850', 'stroke-width': 0.8 }),
    ),
    ...[7, 21, 35, 49, 63, 77, 91].map((x) =>
      line({ key: `k${x}`, x1: x, y1: 2, x2: x, y2: 23, stroke: '#bd9460', 'stroke-width': 0.4 }),
    ),
  );
}
function wallPastelDots(): ReactElement {
  return g(
    el('defs', {}, grad('sg-wall-pastel', '#fbe4f1', '#f4cfe6')),
    rect({ x: 0, y: 0, width: 100, height: 25, fill: 'url(#sg-wall-pastel)' }),
    ...[8, 24, 40, 56, 72, 88].flatMap((x, ix) =>
      [6, 18].map((y, iy) =>
        circ({ key: `${ix}-${iy}`, cx: x + (iy ? 8 : 0), cy: y, r: 1.4, fill: '#e9b6d6' }),
      ),
    ),
  );
}
function wallMintStripe(): ReactElement {
  return g(
    rect({ x: 0, y: 0, width: 100, height: 25, fill: '#cdeee0' }),
    ...[0, 16, 32, 48, 64, 80, 96].map((x) =>
      rect({ key: x, x, y: 0, width: 8, height: 25, fill: '#b6e3d0' }),
    ),
  );
}

/* ── FLOORS (floor zone: 25..75) ────────────────────────────────────────────── */

function floorHoney(): ReactElement {
  return g(
    el('defs', {}, grad('sg-floor-honey', '#e7c79a', '#d8b27e')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-floor-honey)' }),
    ...[36, 48, 60, 72].map((y) =>
      line({ key: y, x1: 0, y1: y, x2: 100, y2: y, stroke: '#cba36f', 'stroke-width': 0.5, opacity: 0.6 }),
    ),
  );
}
function floorStone(): ReactElement {
  return g(
    el('defs', {}, grad('sg-floor-stone', '#d2cbbe', '#c2bbab')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-floor-stone)' }),
    ...[41, 57].map((y) => line({ key: `h${y}`, x1: 0, y1: y, x2: 100, y2: y, stroke: '#aea795', 'stroke-width': 0.5 })),
    ...[25, 50, 75].map((x) => line({ key: `v${x}`, x1: x, y1: 25, x2: x, y2: 75, stroke: '#aea795', 'stroke-width': 0.5 })),
  );
}
function floorSeafoam(): ReactElement {
  return g(
    el('defs', {}, grad('sg-floor-seafoam', '#c4ecdd', '#a9ddc9')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-floor-seafoam)' }),
    ...[40, 56].map((y) =>
      line({ key: y, x1: 0, y1: y, x2: 100, y2: y, stroke: '#93cdb5', 'stroke-width': 0.5, opacity: 0.6 }),
    ),
  );
}
function floorChecker(): ReactElement {
  const cells: ReactElement[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0)
        cells.push(rect({ key: `${r}-${c}`, x: c * 12.5, y: 25 + r * 12.5, width: 12.5, height: 12.5, fill: '#e3dccb' }));
    }
  }
  return g(rect({ x: 0, y: 25, width: 100, height: 50, fill: '#cdc4af' }), ...cells);
}
function floorGrass(): ReactElement {
  return g(
    el('defs', {}, grad('sg-floor-grass', '#9bd47e', '#7cc05f')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-floor-grass)' }),
    ...[
      [14, 40], [34, 52], [54, 44], [74, 58], [90, 48], [24, 66], [64, 68],
    ].map(([x, y], i) => el('path', { key: i, d: `M ${x} ${y} l -2 -5 l 2 1 l 2 -5 l 2 5 l 2 -1 z`, fill: '#69ad4f' })),
  );
}
function floorCloudCarpet(): ReactElement {
  return g(
    el('defs', {}, grad('sg-floor-cloud', '#fbe0ea', '#f4c8da')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-floor-cloud)' }),
    ...[[20, 44], [52, 56], [80, 46], [36, 66], [70, 68]].map(([cx, cy], i) =>
      el(
        'g',
        { key: i },
        circ({ cx, cy, r: 4, fill: '#fcebf2' }),
        circ({ cx: cx + 5, cy, r: 3, fill: '#fcebf2' }),
        circ({ cx: cx - 5, cy, r: 3, fill: '#fcebf2' }),
      ),
    ),
  );
}
function floorDarkwood(): ReactElement {
  return g(
    el('defs', {}, grad('sg-floor-darkwood', '#8c6242', '#6f4a30')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-floor-darkwood)' }),
    ...[37, 49, 61, 73].map((y) =>
      line({ key: y, x1: 0, y1: y, x2: 100, y2: y, stroke: '#5d3d27', 'stroke-width': 0.6, opacity: 0.7 }),
    ),
  );
}

/* ── CATALOG ─────────────────────────────────────────────────────────────────── */

export const SURFACES: SurfaceDef[] = [
  // wallpapers
  { slug: 'wall-peach', kind: 'wallpaper', nameZh: '暖桃米墙', nameEn: 'Warm Peach', rarity: 'common', priceCoins: 0, isDefault: true, render: wallPeach },
  { slug: 'wall-blue', kind: 'wallpaper', nameZh: '海蓝墙', nameEn: 'Sky Blue', rarity: 'common', priceCoins: 0, isDefault: true, render: wallBlue },
  { slug: 'wall-yellow', kind: 'wallpaper', nameZh: '阳光黄墙', nameEn: 'Sunny Yellow', rarity: 'common', priceCoins: 0, isDefault: true, render: wallYellow },
  { slug: 'wall-stars', kind: 'wallpaper', nameZh: '星空墙', nameEn: 'Starry Night', rarity: 'rare', priceCoins: 320, render: wallStars },
  { slug: 'wall-wood', kind: 'wallpaper', nameZh: '木板墙', nameEn: 'Wood Panel', rarity: 'common', priceCoins: 220, render: wallWood },
  { slug: 'wall-pastel-dots', kind: 'wallpaper', nameZh: '粉彩波点', nameEn: 'Pastel Dots', rarity: 'common', priceCoins: 220, render: wallPastelDots },
  { slug: 'wall-mint-stripe', kind: 'wallpaper', nameZh: '薄荷条纹', nameEn: 'Mint Stripe', rarity: 'common', priceCoins: 220, render: wallMintStripe },
  // floors
  { slug: 'floor-honey', kind: 'floor', nameZh: '蜜色木地板', nameEn: 'Honey Wood', rarity: 'common', priceCoins: 0, isDefault: true, render: floorHoney },
  { slug: 'floor-stone', kind: 'floor', nameZh: '灰石砖', nameEn: 'Grey Stone', rarity: 'common', priceCoins: 0, isDefault: true, render: floorStone },
  { slug: 'floor-seafoam', kind: 'floor', nameZh: '海沫绿', nameEn: 'Seafoam', rarity: 'common', priceCoins: 0, isDefault: true, render: floorSeafoam },
  { slug: 'floor-checker', kind: 'floor', nameZh: '棋盘格', nameEn: 'Checkerboard', rarity: 'rare', priceCoins: 300, render: floorChecker },
  { slug: 'floor-grass', kind: 'floor', nameZh: '草地绿', nameEn: 'Grass', rarity: 'common', priceCoins: 240, render: floorGrass },
  { slug: 'floor-cloud-carpet', kind: 'floor', nameZh: '云朵地毯', nameEn: 'Cloud Carpet', rarity: 'rare', priceCoins: 300, render: floorCloudCarpet },
  { slug: 'floor-darkwood', kind: 'floor', nameZh: '深木地板', nameEn: 'Dark Wood', rarity: 'common', priceCoins: 240, render: floorDarkwood },
];

export const SURFACE_BY_SLUG: Record<string, SurfaceDef> = Object.fromEntries(
  SURFACES.map((s) => [s.slug, s]),
);

export function getSurface(slug: string): SurfaceDef | undefined {
  return SURFACE_BY_SLUG[slug];
}

export function listSurfaces(kind: SurfaceKind): SurfaceDef[] {
  return SURFACES.filter((s) => s.kind === kind);
}

/** Default wallpaper + floor slug per room (the free starter look). */
export const ROOM_DEFAULT_SURFACES: Record<string, { wallpaper: string; floor: string }> = {
  bedroom: { wallpaper: 'wall-peach', floor: 'floor-honey' },
  living: { wallpaper: 'wall-blue', floor: 'floor-stone' },
  playroom: { wallpaper: 'wall-yellow', floor: 'floor-seafoam' },
};

/** True if a surface slug is a free default (equippable without ownership). */
export function isDefaultSurface(slug: string): boolean {
  return getSurface(slug)?.isDefault === true;
}
