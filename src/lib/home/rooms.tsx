import type { ReactElement } from 'react';

export type HomeRoomId = 'bedroom' | 'living' | 'playroom' | 'yard';

export interface RoomDef {
  id: HomeRoomId;
  nameZh: string;
  nameEn: string;
  /** Tab glyph. */
  emoji: string;
  cols: number;   // always 8
  rows: number;   // always 6
  wallRows: number; // top wallRows rows are 'wall' zone (always 2)
  /**
   * Flat-SVG backdrop drawn in a 0 0 100 75 viewBox (8 cols × 6 rows = 12.5 units/cell).
   * NOTE: dead/back-compat — `RoomCanvas` renders swappable surfaces instead.
   */
  Backdrop: () => ReactElement;
}

// ─── BACKDROPS ───────────────────────────────────────────────────────────────
// viewBox: 0 0 100 75 (width=100, height=75)
// Wall zone = top 2 rows = top 25 units (2/6 × 75)
// Floor zone = bottom 4 rows = bottom 50 units (4/6 × 75)

/** Bedroom — warm palette: peach/salmon wall, honey-pine floor */
function BedroomBackdrop(): ReactElement {
  return (
    <g aria-hidden>
      {/* Wall — warm peach */}
      <rect x={0} y={0} width={100} height={25} fill="#f5d5b8" />
      {/* Subtle wallpaper stripe pattern */}
      {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((x) => (
        <line key={x} x1={x} y1={0} x2={x} y2={25} stroke="#e8c8a5" strokeWidth={0.4} />
      ))}
      {/* Floor — honey pine */}
      <rect x={0} y={25} width={100} height={50} fill="#d4a96a" />
      {/* Floor wood grain lines */}
      {[33, 41, 49, 57, 65].map((y) => (
        <line key={y} x1={0} y1={y} x2={100} y2={y} stroke="#c09050" strokeWidth={0.5} />
      ))}
      {/* Skirting board */}
      <rect x={0} y={24} width={100} height={2} fill="#c8a060" />
      <line x1={0} y1={24} x2={100} y2={24} stroke="#a06830" strokeWidth={0.6} />
      <line x1={0} y1={26} x2={100} y2={26} stroke="#a06830" strokeWidth={0.4} />
    </g>
  );
}

/** Living room — cool palette: soft blue wall, grey-stone floor */
function LivingBackdrop(): ReactElement {
  return (
    <g aria-hidden>
      {/* Wall — soft teal-blue */}
      <rect x={0} y={0} width={100} height={25} fill="#b8d4e8" />
      {/* Subtle diamond wallpaper pattern */}
      {[12.5, 25, 37.5, 50, 62.5, 75, 87.5].map((x) => (
        <line key={x} x1={x} y1={0} x2={x} y2={25} stroke="#a8c8e0" strokeWidth={0.3} />
      ))}
      {[8, 16].map((y) => (
        <line key={y} x1={0} y1={y} x2={100} y2={y} stroke="#a8c8e0" strokeWidth={0.3} />
      ))}
      {/* Floor — warm grey stone */}
      <rect x={0} y={25} width={100} height={50} fill="#c8c0b4" />
      {/* Stone tile grid */}
      {[37.5, 50, 62.5].map((y) => (
        <line key={y} x1={0} y1={y} x2={100} y2={y} stroke="#b0a898" strokeWidth={0.5} />
      ))}
      {[25, 50, 75].map((x) => (
        <line key={x} x1={x} y1={25} x2={x} y2={75} stroke="#b0a898" strokeWidth={0.5} />
      ))}
      {/* Skirting board */}
      <rect x={0} y={24} width={100} height={2} fill="#9090a0" />
      <line x1={0} y1={24} x2={100} y2={24} stroke="#707080" strokeWidth={0.6} />
      <line x1={0} y1={26} x2={100} y2={26} stroke="#707080" strokeWidth={0.4} />
    </g>
  );
}

/** Playroom — bright palette: sunny yellow wall, sea-foam floor */
function PlayroomBackdrop(): ReactElement {
  return (
    <g aria-hidden>
      {/* Wall — bright sunny yellow */}
      <rect x={0} y={0} width={100} height={25} fill="#f9e580" />
      {/* Star/polka-dot wallpaper */}
      {[12.5, 37.5, 62.5, 87.5].map((x) =>
        [6, 16].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill="#f0d040" />
        )),
      )}
      {[25, 50, 75].map((x) =>
        [11].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill="#f0d040" />
        )),
      )}
      {/* Floor — sea-foam green */}
      <rect x={0} y={25} width={100} height={50} fill="#a8ddb8" />
      {/* Soft mat-stripe lines */}
      {[33, 42, 51, 60, 69].map((y) => (
        <line key={y} x1={0} y1={y} x2={100} y2={y} stroke="#90cc9e" strokeWidth={0.6} />
      ))}
      {/* Skirting board */}
      <rect x={0} y={24} width={100} height={2} fill="#78c888" />
      <line x1={0} y1={24} x2={100} y2={24} stroke="#50a860" strokeWidth={0.6} />
      <line x1={0} y1={26} x2={100} y2={26} stroke="#50a860" strokeWidth={0.4} />
    </g>
  );
}

/** Yard — outdoor: sky (top zone) + grass ground, picket fence at the horizon */
function YardBackdrop(): ReactElement {
  return (
    <g aria-hidden>
      {/* Sky */}
      <rect x={0} y={0} width={100} height={25} fill="#bfe6f5" />
      <circle cx={82} cy={7} r={4.5} fill="#ffe27a" />
      {[[16, 8], [40, 6], [64, 10]].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={3.2} fill="#ffffff" />
          <circle cx={cx + 4} cy={cy} r={2.6} fill="#ffffff" />
          <circle cx={cx - 4} cy={cy} r={2.6} fill="#ffffff" />
        </g>
      ))}
      {/* Grass ground */}
      <rect x={0} y={25} width={100} height={50} fill="#8ecb6a" />
      {[34, 46, 58, 70].map((y) => (
        <line key={y} x1={0} y1={y} x2={100} y2={y} stroke="#79b857" strokeWidth={0.5} opacity={0.5} />
      ))}
      {/* Picket fence along the horizon */}
      <rect x={0} y={23} width={100} height={2} fill="#f3ead6" />
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x={i * 8 + 1} y={20.5} width={2.4} height={4.5} fill="#f7f0df" />
      ))}
    </g>
  );
}

// ─── CATALOG ─────────────────────────────────────────────────────────────────

export const HOME_ROOMS: RoomDef[] = [
  {
    id: 'bedroom',
    nameZh: '卧室',
    nameEn: 'Bedroom',
    emoji: '🛏️',
    cols: 8,
    rows: 6,
    wallRows: 2,
    Backdrop: BedroomBackdrop,
  },
  {
    id: 'living',
    nameZh: '客厅',
    nameEn: 'Living Room',
    emoji: '🛋️',
    cols: 8,
    rows: 6,
    wallRows: 2,
    Backdrop: LivingBackdrop,
  },
  {
    id: 'playroom',
    nameZh: '游戏室',
    nameEn: 'Playroom',
    emoji: '🎮',
    cols: 8,
    rows: 6,
    wallRows: 2,
    Backdrop: PlayroomBackdrop,
  },
  {
    id: 'yard',
    nameZh: '院子',
    nameEn: 'Yard',
    emoji: '🌳',
    cols: 8,
    rows: 6,
    wallRows: 2,
    Backdrop: YardBackdrop,
  },
];

const ROOM_BY_ID = new Map<string, RoomDef>(HOME_ROOMS.map((r) => [r.id, r]));

export function getRoom(id: string): RoomDef | undefined {
  return ROOM_BY_ID.get(id);
}

/**
 * Returns the zone for a cell at (x, y) in the given room.
 * y < room.wallRows → 'wall'; otherwise → 'floor'.
 */
export function cellZone(room: RoomDef, _x: number, y: number): 'wall' | 'floor' {
  return y < room.wallRows ? 'wall' : 'floor';
}
