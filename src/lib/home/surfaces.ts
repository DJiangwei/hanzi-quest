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
/** Vertical 3-stop gradient — lets a wall/floor read with a soft mid sheen. */
const grad3 = (id: string, a: string, b: string, c: string) =>
  el(
    'linearGradient',
    { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    el('stop', { offset: 0, 'stop-color': a }),
    el('stop', { offset: 0.5, 'stop-color': b }),
    el('stop', { offset: 1, 'stop-color': c }),
  );
const g = (...kids: ReactElement[]) => h('g', { 'aria-hidden': true }, ...kids);

/* ── WALLPAPERS (wall zone: 0..25) ──────────────────────────────────────────── */

function wallPeach(): ReactElement {
  return g(
    el('defs', {}, grad3('sg-wall-peach', '#fbe7cf', '#f5d6b4', '#eec39c')),
    rect({ x: 0, y: 0, width: 100, height: 25, fill: 'url(#sg-wall-peach)' }),
    // wainscot panels for a richer, less-flat wall
    ...[14, 28, 42, 56, 70, 84].map((x) =>
      line({ key: x, x1: x, y1: 0, x2: x, y2: 25, stroke: '#e3b88c', 'stroke-width': 0.5 }),
    ),
    ...[14, 28, 42, 56, 70, 84].map((x) =>
      line({ key: `h${x}`, x1: x + 0.6, y1: 0, x2: x + 0.6, y2: 25, stroke: '#fdf0e0', 'stroke-width': 0.4, opacity: 0.7 }),
    ),
  );
}
function wallBlue(): ReactElement {
  return g(
    el('defs', {}, grad3('sg-wall-blue', '#dbeff9', '#c2dcee', '#a9cbe3')),
    rect({ x: 0, y: 0, width: 100, height: 25, fill: 'url(#sg-wall-blue)' }),
    ...[12.5, 37.5, 62.5, 87.5].flatMap((x) =>
      [7, 17].map((y) =>
        el(
          'g',
          { key: `${x}-${y}` },
          circ({ cx: x, cy: y, r: 1.2, fill: '#9bc0dd' }),
          circ({ cx: x - 0.4, cy: y - 0.4, r: 0.5, fill: '#eaf5fc' }),
        ),
      ),
    ),
  );
}
function wallYellow(): ReactElement {
  return g(
    el('defs', {}, grad3('sg-wall-yellow', '#fef2a6', '#fbe684', '#f6d85e')),
    rect({ x: 0, y: 0, width: 100, height: 25, fill: 'url(#sg-wall-yellow)' }),
    ...[10, 30, 50, 70, 90].flatMap((x) =>
      [6, 16].map((y) =>
        el(
          'g',
          { key: `${x}-${y}` },
          circ({ cx: x, cy: y, r: 1.3, fill: '#eece3a' }),
          circ({ cx: x - 0.4, cy: y - 0.4, r: 0.5, fill: '#fff6c8' }),
        ),
      ),
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
    // darker at the back (near horizon) → lighter to the front = subtle depth
    el('defs', {}, grad3('sg-floor-honey', '#caa46f', '#e3c290', '#edd0a3')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-floor-honey)' }),
    ...[36, 48, 60, 72].map((y) =>
      line({ key: y, x1: 0, y1: y, x2: 100, y2: y, stroke: '#bd9460', 'stroke-width': 0.5, opacity: 0.65 }),
    ),
    ...[36, 48, 60, 72].map((y) =>
      line({ key: `s${y}`, x1: 0, y1: y - 0.5, x2: 100, y2: y - 0.5, stroke: '#f3dcb4', 'stroke-width': 0.3, opacity: 0.5 }),
    ),
  );
}
function floorStone(): ReactElement {
  return g(
    el('defs', {}, grad3('sg-floor-stone', '#bcb4a4', '#cfc8ba', '#d8d1c4')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-floor-stone)' }),
    ...[41, 57].map((y) => line({ key: `h${y}`, x1: 0, y1: y, x2: 100, y2: y, stroke: '#a59e8c', 'stroke-width': 0.5 })),
    ...[25, 50, 75].map((x) => line({ key: `v${x}`, x1: x, y1: 25, x2: x, y2: 75, stroke: '#a59e8c', 'stroke-width': 0.5 })),
    ...[41, 57].map((y) => line({ key: `hl${y}`, x1: 0, y1: y - 0.4, x2: 100, y2: y - 0.4, stroke: '#eae4d8', 'stroke-width': 0.3, opacity: 0.6 })),
  );
}
function floorSeafoam(): ReactElement {
  return g(
    el('defs', {}, grad3('sg-floor-seafoam', '#9fd6c0', '#bbe8d6', '#c9efe0')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-floor-seafoam)' }),
    ...[40, 56].map((y) =>
      line({ key: y, x1: 0, y1: y, x2: 100, y2: y, stroke: '#8bc7af', 'stroke-width': 0.5, opacity: 0.6 }),
    ),
    ...[40, 56].map((y) =>
      line({ key: `s${y}`, x1: 0, y1: y - 0.5, x2: 100, y2: y - 0.5, stroke: '#d9f4ea', 'stroke-width': 0.3, opacity: 0.5 }),
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

/* ── OUTDOOR SKIES (wall zone: 0..25) ───────────────────────────────────────── */

function skyDay(): ReactElement {
  return g(
    el('defs', {}, grad3('sg-sky-day', '#aee0f4', '#c7ecf8', '#e3f6fb')),
    rect({ x: 0, y: 0, width: 100, height: 25, fill: 'url(#sg-sky-day)' }),
    circ({ cx: 84, cy: 7, r: 4.2, fill: '#ffe27a' }),
    circ({ cx: 84, cy: 7, r: 6, fill: '#fff2b8', opacity: 0.35 }),
    ...[[16, 9], [44, 6]].map(([cx, cy], i) =>
      el(
        'g',
        { key: i },
        circ({ cx, cy, r: 3.4, fill: '#ffffff' }),
        circ({ cx: cx + 4.5, cy, r: 2.7, fill: '#ffffff' }),
        circ({ cx: cx - 4.5, cy, r: 2.7, fill: '#ffffff' }),
      ),
    ),
  );
}
function skySunset(): ReactElement {
  return g(
    el('defs', {}, grad3('sg-sky-sunset', '#ffd29b', '#ff9e7a', '#f06f86')),
    rect({ x: 0, y: 0, width: 100, height: 25, fill: 'url(#sg-sky-sunset)' }),
    circ({ cx: 50, cy: 17, r: 6, fill: '#ffe9a8' }),
    circ({ cx: 50, cy: 17, r: 9, fill: '#ffd27e', opacity: 0.3 }),
    ...[10, 28, 72, 90].map((cx, i) =>
      el('g', { key: i }, circ({ cx, cy: 7, r: 2.6, fill: '#ffd9c2' }), circ({ cx: cx + 3.4, cy: 7, r: 2, fill: '#ffd9c2' })),
    ),
  );
}

/* ── OUTDOOR GROUNDS (floor zone: 25..75) ───────────────────────────────────── */

function groundLawn(): ReactElement {
  return g(
    el('defs', {}, grad3('sg-ground-lawn', '#79bf57', '#8fcd68', '#a0d97a')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-ground-lawn)' }),
    ...[
      [12, 40], [30, 50], [48, 44], [66, 56], [84, 46], [22, 64], [58, 66], [90, 62], [40, 70],
    ].map(([x, y], i) => el('path', { key: i, d: `M ${x} ${y} l -1.6 -4 l 1.6 0.8 l 1.6 -4 l 1.6 4 l 1.6 -0.8 z`, fill: '#5fa843', opacity: 0.8 })),
  );
}
function groundSand(): ReactElement {
  return g(
    el('defs', {}, grad3('sg-ground-sand', '#e6cd96', '#efd9a8', '#f5e4bb')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-ground-sand)' }),
    ...[[20, 42], [54, 50], [80, 44], [34, 62], [68, 66], [12, 58]].map(([cx, cy], i) =>
      circ({ key: i, cx, cy, r: 0.8, fill: '#d8bd83', opacity: 0.7 }),
    ),
  );
}
function groundDeck(): ReactElement {
  return g(
    el('defs', {}, grad3('sg-ground-deck', '#b78a5c', '#c89c6c', '#d3a878')),
    rect({ x: 0, y: 25, width: 100, height: 50, fill: 'url(#sg-ground-deck)' }),
    ...[0, 16.7, 33.3, 50, 66.7, 83.3, 100].map((x) =>
      line({ key: x, x1: x, y1: 25, x2: x, y2: 75, stroke: '#8f6a44', 'stroke-width': 0.7 }),
    ),
    ...[0.8, 17.5, 34.1, 50.8, 67.5, 84.1].map((x) =>
      line({ key: `s${x}`, x1: x, y1: 25, x2: x, y2: 75, stroke: '#dcb78a', 'stroke-width': 0.4, opacity: 0.6 }),
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
  // outdoor skies (wallpaper-kind, for the yard)
  { slug: 'sky-day', kind: 'wallpaper', nameZh: '晴天', nameEn: 'Clear Sky', rarity: 'common', priceCoins: 0, isDefault: true, render: skyDay },
  { slug: 'sky-sunset', kind: 'wallpaper', nameZh: '黄昏天空', nameEn: 'Sunset Sky', rarity: 'rare', priceCoins: 320, render: skySunset },
  // floors
  { slug: 'floor-honey', kind: 'floor', nameZh: '蜜色木地板', nameEn: 'Honey Wood', rarity: 'common', priceCoins: 0, isDefault: true, render: floorHoney },
  { slug: 'floor-stone', kind: 'floor', nameZh: '灰石砖', nameEn: 'Grey Stone', rarity: 'common', priceCoins: 0, isDefault: true, render: floorStone },
  { slug: 'floor-seafoam', kind: 'floor', nameZh: '海沫绿', nameEn: 'Seafoam', rarity: 'common', priceCoins: 0, isDefault: true, render: floorSeafoam },
  { slug: 'floor-checker', kind: 'floor', nameZh: '棋盘格', nameEn: 'Checkerboard', rarity: 'rare', priceCoins: 300, render: floorChecker },
  { slug: 'floor-grass', kind: 'floor', nameZh: '草地绿', nameEn: 'Grass', rarity: 'common', priceCoins: 240, render: floorGrass },
  { slug: 'floor-cloud-carpet', kind: 'floor', nameZh: '云朵地毯', nameEn: 'Cloud Carpet', rarity: 'rare', priceCoins: 300, render: floorCloudCarpet },
  { slug: 'floor-darkwood', kind: 'floor', nameZh: '深木地板', nameEn: 'Dark Wood', rarity: 'common', priceCoins: 240, render: floorDarkwood },
  // outdoor grounds (floor-kind, for the yard)
  { slug: 'ground-lawn', kind: 'floor', nameZh: '草坪', nameEn: 'Lawn', rarity: 'common', priceCoins: 0, isDefault: true, render: groundLawn },
  { slug: 'ground-sand', kind: 'floor', nameZh: '沙地', nameEn: 'Sand', rarity: 'common', priceCoins: 240, render: groundSand },
  { slug: 'ground-deck', kind: 'floor', nameZh: '木台', nameEn: 'Deck', rarity: 'common', priceCoins: 240, render: groundDeck },
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
  yard: { wallpaper: 'sky-day', floor: 'ground-lawn' },
};

/** True if a surface slug is a free default (equippable without ownership). */
export function isDefaultSurface(slug: string): boolean {
  return getSurface(slug)?.isDefault === true;
}
