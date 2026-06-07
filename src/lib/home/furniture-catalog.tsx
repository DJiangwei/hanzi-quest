import type { ReactElement } from 'react';

export type FurnitureCategory = 'wall_art' | 'window_light' | 'furniture' | 'rug' | 'plant_toy';
export type Surface = 'wall' | 'floor';

export interface FurnitureDef {
  slug: string;
  category: FurnitureCategory;
  surface: Surface;
  /** Grid cells the item occupies; w=cols, h=rows */
  footprint: { w: number; h: number };
  nameZh: string;
  nameEn: string;
  rarity: 'common' | 'rare' | 'epic';
  priceCoins: number;
  /**
   * Flat-SVG <g> drawn within a footprint.w×footprint.h cell box
   * where each cell = 12.5 units (100/8 cols).
   */
  Component: () => ReactElement;
}

// ─── WALL ART ─────────────────────────────────────────────────────────────────
// All wall_art items: surface=wall, footprint ~1×1

/** Poster of stars — 1×1 wall item */
function PosterStarsComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Frame */}
      <rect x={1} y={1} width={10.5} height={10.5} rx={0.8} fill="#3a2a8a" stroke="#1a0a5a" strokeWidth={0.8} />
      <rect x={2} y={2} width={8.5} height={8.5} fill="#0a0a2a" />
      {/* Stars */}
      <circle cx={6.25} cy={6.25} r={1.2} fill="#ffe840" />
      {[
        [3.5, 3.5], [9, 3.5], [3, 9], [9.5, 9], [5, 5.5], [8, 7], [4, 8],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={0.4} fill="#c0d8ff" />
      ))}
      {/* Moon crescent */}
      <path d="M 9.5 3.5 Q 8 5.5 9.5 7 Q 7 5.5 9.5 3.5 Z" fill="#ffe840" />
    </g>
  );
}

/** Framed fish — 1×1 wall item */
function FramedFishComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Frame */}
      <rect x={1} y={1} width={10.5} height={10.5} rx={0.5} fill="#8b5e3c" stroke="#5a3820" strokeWidth={0.8} />
      <rect x={2} y={2} width={8.5} height={8.5} fill="#d0eef8" />
      {/* Fish body */}
      <ellipse cx={6.25} cy={6.25} r={3} ry={2} fill="#f06030" stroke="#c04010" strokeWidth={0.5} />
      {/* Tail */}
      <path d="M 9.25 6.25 L 11 4.5 L 11 8 Z" fill="#f06030" stroke="#c04010" strokeWidth={0.5} />
      {/* Eye */}
      <circle cx={4} cy={5.5} r={0.6} fill="#fff" />
      <circle cx={4} cy={5.5} r={0.3} fill="#1a1a1a" />
      {/* Fin */}
      <path d="M 5.5 4.25 L 7.5 4.25 L 6.5 6.25 Z" fill="#c04010" />
    </g>
  );
}

/** Round clock — 1×1 wall item */
function ClockRoundComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Clock case */}
      <circle cx={6.25} cy={6.25} r={5} fill="#f0e8d0" stroke="#8b6020" strokeWidth={0.8} />
      <circle cx={6.25} cy={6.25} r={4.2} fill="#fffdf5" stroke="#c09040" strokeWidth={0.4} />
      {/* Hour markers */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
        const rad = (deg - 90) * (Math.PI / 180);
        const x1 = 6.25 + 3.4 * Math.cos(rad);
        const y1 = 6.25 + 3.4 * Math.sin(rad);
        const x2 = 6.25 + 4 * Math.cos(rad);
        const y2 = 6.25 + 4 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8b6020" strokeWidth={i % 3 === 0 ? 0.6 : 0.3} />;
      })}
      {/* Hands */}
      <line x1={6.25} y1={6.25} x2={6.25} y2={3} stroke="#3a2010" strokeWidth={0.6} strokeLinecap="round" />
      <line x1={6.25} y1={6.25} x2={8.8} y2={6.25} stroke="#3a2010" strokeWidth={0.5} strokeLinecap="round" />
      <circle cx={6.25} cy={6.25} r={0.4} fill="#3a2010" />
    </g>
  );
}

// ─── WINDOW / LIGHT ──────────────────────────────────────────────────────────

/** Sunny window — 2×1 wall item */
function WindowSunnyComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Window frame */}
      <rect x={0.5} y={0.5} width={24} height={11.5} rx={0.8} fill="#c0a060" stroke="#8b6030" strokeWidth={0.8} />
      {/* Sky */}
      <rect x={1.5} y={1.5} width={22} height={9.5} fill="#a8d8f0" />
      {/* Divider cross */}
      <line x1={12.5} y1={1.5} x2={12.5} y2={11} stroke="#c0a060" strokeWidth={0.7} />
      <line x1={1.5} y1={6.25} x2={23.5} y2={6.25} stroke="#c0a060" strokeWidth={0.7} />
      {/* Sun */}
      <circle cx={8} cy={4.5} r={2} fill="#ffe840" />
      {[0, 45, 90, 135].map((deg, i) => {
        const rad = deg * (Math.PI / 180);
        return (
          <line key={i}
            x1={8 + 2.4 * Math.cos(rad)} y1={4.5 + 2.4 * Math.sin(rad)}
            x2={8 + 3.2 * Math.cos(rad)} y2={4.5 + 3.2 * Math.sin(rad)}
            stroke="#ffe840" strokeWidth={0.5} />
        );
      })}
      {/* Cloud */}
      <ellipse cx={18} cy={4} rx={2.5} ry={1.2} fill="#fff" opacity={0.9} />
      <ellipse cx={16.5} cy={4.5} rx={1.5} ry={1} fill="#fff" opacity={0.9} />
      {/* Curtain hints */}
      <rect x={0.5} y={0.5} width={2.5} height={11.5} fill="#f0a070" opacity={0.5} />
      <rect x={22} y={0.5} width={2.5} height={11.5} fill="#f0a070" opacity={0.5} />
    </g>
  );
}

/** String lights — 1×1 wall item */
function LampStringComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* String */}
      <path d="M 0.5 2 Q 3 4 6.25 2.5 Q 9.5 4 12 2" stroke="#5a3820" strokeWidth={0.5} fill="none" />
      {/* Bulbs hanging down */}
      {[1.5, 3.8, 6.25, 8.7, 11].map((x, i) => {
        const y = 2.5 + (i % 2 === 0 ? 1.5 : 0.8);
        const colors = ['#ff6060', '#60d060', '#4090ff', '#ffcc00', '#ff80c0'];
        return (
          <g key={i}>
            <line x1={x} y1={2.5} x2={x} y2={y} stroke="#5a3820" strokeWidth={0.3} />
            <ellipse cx={x} cy={y + 0.8} rx={0.7} ry={0.9} fill={colors[i % colors.length]} />
          </g>
        );
      })}
      {/* Glow aura under lights */}
      {[1.5, 3.8, 6.25, 8.7, 11].map((x, i) => {
        const y = 2.5 + (i % 2 === 0 ? 1.5 : 0.8) + 0.8;
        return <circle key={i} cx={x} cy={y} r={1.5} fill="#ffffaa" opacity={0.25} />;
      })}
    </g>
  );
}

/** Floor lamp — 1×1 floor item */
function FloorLampComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Base */}
      <ellipse cx={6.25} cy={11.5} rx={3.5} ry={0.8} fill="#8b6030" />
      {/* Pole */}
      <rect x={5.8} y={3} width={0.9} height={8.5} fill="#b0a080" />
      {/* Shade */}
      <path d="M 3 5.5 L 9.5 5.5 L 8 3 L 4.5 3 Z" fill="#f0e0b0" stroke="#c0a060" strokeWidth={0.5} />
      {/* Glow */}
      <ellipse cx={6.25} cy={6} rx={3} ry={1.5} fill="#fff8d0" opacity={0.4} />
    </g>
  );
}

// ─── FURNITURE ───────────────────────────────────────────────────────────────

/** Cozy bed — 2×1 floor item */
function BedCozyComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Frame */}
      <rect x={0.5} y={3} width={24} height={9} rx={1} fill="#8b5e3c" />
      {/* Mattress */}
      <rect x={1} y={3.5} width={23} height={8} rx={0.8} fill="#f5e8d0" />
      {/* Pillow */}
      <rect x={1.5} y={4} width={5} height={4} rx={1.5} fill="#fff" stroke="#ddd" strokeWidth={0.4} />
      {/* Blanket */}
      <rect x={7} y={5} width={16.5} height={6} rx={1} fill="#7080d0" stroke="#5060b0" strokeWidth={0.4} />
      {/* Blanket fold */}
      <path d="M 7 8 Q 15 7 23.5 8" stroke="#5060b0" strokeWidth={0.4} fill="none" />
      {/* Headboard */}
      <rect x={0.5} y={1} width={24} height={2.5} rx={1} fill="#5a3820" />
    </g>
  );
}

/** Teal sofa — 2×1 floor item */
function SofaTealComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Base */}
      <rect x={0.5} y={5} width={24} height={7} rx={1} fill="#2a8090" />
      {/* Seat cushions */}
      <rect x={1} y={5.5} width={10.5} height={5} rx={1} fill="#3a9aa8" />
      <rect x={12.5} y={5.5} width={11} height={5} rx={1} fill="#3a9aa8" />
      {/* Backrest */}
      <rect x={0.5} y={2.5} width={24} height={3} rx={1} fill="#2a8090" />
      {/* Arm rests */}
      <rect x={0.5} y={4} width={3} height={8} rx={0.8} fill="#1a6070" />
      <rect x={21.5} y={4} width={3} height={8} rx={0.8} fill="#1a6070" />
      {/* Legs */}
      <rect x={2} y={11.5} width={1.5} height={1} rx={0.3} fill="#5a3820" />
      <rect x={21.5} y={11.5} width={1.5} height={1} rx={0.3} fill="#5a3820" />
    </g>
  );
}

/** Wooden chair — 1×1 floor item */
function ChairWoodComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Seat */}
      <rect x={2} y={6} width={8.5} height={3} rx={0.5} fill="#c08040" />
      {/* Backrest */}
      <rect x={2.5} y={2.5} width={7.5} height={3.5} rx={0.5} fill="#a06030" />
      {/* Back legs */}
      <rect x={2.5} y={9} width={1} height={3.5} rx={0.3} fill="#8b5020" />
      <rect x={9} y={9} width={1} height={3.5} rx={0.3} fill="#8b5020" />
      {/* Front legs */}
      <rect x={2.5} y={9} width={1} height={3} rx={0.3} fill="#a06030" />
      <rect x={9} y={9} width={1} height={3} rx={0.3} fill="#a06030" />
    </g>
  );
}

/** Round table — 1×1 floor item */
function TableRoundComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Tabletop */}
      <ellipse cx={6.25} cy={5.5} rx={5} ry={1.5} fill="#d4a060" stroke="#a07030" strokeWidth={0.5} />
      <ellipse cx={6.25} cy={4.5} rx={5} ry={1.5} fill="#e0b070" stroke="#a07030" strokeWidth={0.5} />
      {/* Leg */}
      <rect x={5.7} y={6} width={1.1} height={4.5} fill="#a07030" />
      {/* Foot */}
      <ellipse cx={6.25} cy={10.5} rx={2.5} ry={0.6} fill="#a07030" />
    </g>
  );
}

/** Bookshelf — 2×1 floor item */
function BookshelfComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Shelf unit */}
      <rect x={0.5} y={0.5} width={24} height={12} rx={0.5} fill="#8b5e3c" />
      {/* Shelves */}
      <rect x={1} y={4.5} width={23} height={0.8} fill="#5a3820" />
      <rect x={1} y={8.5} width={23} height={0.8} fill="#5a3820" />
      {/* Books on shelf 1 */}
      {[1.2, 3, 4.6, 6.2, 8, 9.6, 11.5, 13, 14.8, 16.4, 18, 19.6].map((x, i) => {
        const colors = ['#e05050', '#50b050', '#5080e0', '#e0c050', '#d060c0', '#50c0c0'];
        const h = 2.5 + (i % 3) * 0.4;
        return <rect key={i} x={x} y={4.5 - h} width={1.5} height={h} rx={0.2} fill={colors[i % colors.length]} />;
      })}
      {/* Books on shelf 2 */}
      {[1.2, 3.2, 5, 7, 8.8, 10.5, 12, 14, 16, 18, 20].map((x, i) => {
        const colors = ['#c050c0', '#50d080', '#f08020', '#6070d0', '#d04040'];
        return <rect key={i} x={x} y={8.5 - 2 - (i % 2) * 0.5} width={1.6} height={2 + (i % 2) * 0.5} rx={0.2} fill={colors[i % colors.length]} />;
      })}
    </g>
  );
}

/** Toy chest — 1×1 floor item */
function ToyChestComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Chest body */}
      <rect x={1} y={5} width={10.5} height={7} rx={0.8} fill="#e8a030" stroke="#c07020" strokeWidth={0.6} />
      {/* Lid */}
      <rect x={0.8} y={3} width={11} height={2.5} rx={0.8} fill="#f0b840" stroke="#c07020" strokeWidth={0.6} />
      {/* Hinge */}
      <rect x={5.5} y={4.8} width={1.5} height={0.6} rx={0.3} fill="#8b6020" />
      {/* Latch */}
      <rect x={5.2} y={6} width={2} height={1.5} rx={0.4} fill="#c09030" stroke="#8b6020" strokeWidth={0.4} />
      {/* Stars on lid */}
      {[3, 6.25, 9.5].map((cx, i) => (
        <circle key={i} cx={cx} cy={4} r={0.6} fill="#fff8a0" />
      ))}
    </g>
  );
}

/** Study desk — 2×1 floor item */
function DeskStudyComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Desktop */}
      <rect x={0.5} y={4.5} width={24} height={1.5} rx={0.4} fill="#c8a060" stroke="#9a7030" strokeWidth={0.5} />
      {/* Top surface */}
      <rect x={0.5} y={3.5} width={24} height={1.2} rx={0.4} fill="#d4b070" />
      {/* Legs */}
      <rect x={1} y={6} width={1.2} height={6.5} rx={0.3} fill="#9a7030" />
      <rect x={22.8} y={6} width={1.2} height={6.5} rx={0.3} fill="#9a7030" />
      {/* Drawer unit */}
      <rect x={15} y={5} width={8.5} height={7} rx={0.4} fill="#b89050" stroke="#9a7030" strokeWidth={0.4} />
      <rect x={15.5} y={5.5} width={7.5} height={2.8} rx={0.3} fill="#c8a060" />
      <rect x={15.5} y={9} width={7.5} height={2.5} rx={0.3} fill="#c8a060" />
      <circle cx={19.25} cy={6.9} r={0.5} fill="#8b6020" />
      <circle cx={19.25} cy={10.25} r={0.5} fill="#8b6020" />
      {/* Pencil holder */}
      <rect x={2} y={1.5} width={3} height={2.5} rx={0.5} fill="#8b6030" />
      {/* Pencils */}
      <line x1={2.8} y1={1} x2={2.8} y2={1.5} stroke="#ff6060" strokeWidth={0.6} />
      <line x1={3.5} y1={0.8} x2={3.5} y2={1.5} stroke="#ffe840" strokeWidth={0.6} />
      <line x1={4.2} y1={1.1} x2={4.2} y2={1.5} stroke="#50d080" strokeWidth={0.6} />
    </g>
  );
}

// ─── RUG ─────────────────────────────────────────────────────────────────────

/** Round rug — 1×1 floor item */
function RugRoundComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Outer rug */}
      <ellipse cx={6.25} cy={7} rx={5} ry={4} fill="#d04040" />
      {/* Middle ring */}
      <ellipse cx={6.25} cy={7} rx={3.5} ry={2.8} fill="#e87070" />
      {/* Inner center */}
      <ellipse cx={6.25} cy={7} rx={2} ry={1.6} fill="#d04040" />
      {/* Pattern dots */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = deg * (Math.PI / 180);
        return (
          <circle key={i}
            cx={6.25 + 2.8 * Math.cos(rad)}
            cy={7 + 2.2 * Math.sin(rad)}
            r={0.4} fill="#fff" opacity={0.7} />
        );
      })}
    </g>
  );
}

/** Striped rug — 2×1 floor item */
function RugStripeComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Base */}
      <rect x={0.5} y={3} width={24} height={6} rx={1} fill="#4060c0" />
      {/* Stripes */}
      {[1.5, 4.2, 6.9, 9.6, 12.3, 15, 17.7, 20.4].map((y, i) => (
        <rect key={i} x={0.5} y={y + 3 - 1.5} width={24} height={0.9}
          fill={i % 2 === 0 ? '#6080e0' : '#2040a0'} />
      ))}
      {/* Fringe ends */}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) => (
        <line key={`l${x}`} x1={x * 2} y1={3} x2={x * 2 - 0.5} y2={1.5} stroke="#c0d0ff" strokeWidth={0.4} />
      ))}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) => (
        <line key={`r${x}`} x1={x * 2} y1={9} x2={x * 2 - 0.5} y2={10.5} stroke="#c0d0ff" strokeWidth={0.4} />
      ))}
    </g>
  );
}

// ─── PLANT / TOY ─────────────────────────────────────────────────────────────

/** Potted fern — 1×1 floor item */
function PlantFernComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Pot */}
      <path d="M 3.5 9.5 L 4.5 12.5 L 8 12.5 L 9 9.5 Z" fill="#c87040" />
      <ellipse cx={6.25} cy={9.5} rx={2.8} ry={0.7} fill="#a85030" />
      {/* Soil */}
      <ellipse cx={6.25} cy={9.5} rx={2} ry={0.5} fill="#5a3010" />
      {/* Fern leaves */}
      <path d="M 6.25 9 Q 4 6 3 3.5" stroke="#40a040" strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <path d="M 6.25 9 Q 8.5 6 9.5 3.5" stroke="#40a040" strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <path d="M 6.25 9 Q 5 7 3.5 7.5" stroke="#50c050" strokeWidth={1} fill="none" strokeLinecap="round" />
      <path d="M 6.25 9 Q 7.5 7 9 7.5" stroke="#50c050" strokeWidth={1} fill="none" strokeLinecap="round" />
      <path d="M 6.25 9 Q 6 6.5 6.25 4" stroke="#60b040" strokeWidth={1.2} fill="none" strokeLinecap="round" />
      {/* Leaf detail */}
      {[
        [4, 5.5, 2.5, 6], [4.5, 4.5, 3, 5], [8.5, 5.5, 10, 6], [8, 4.5, 9.5, 5],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60c050" strokeWidth={0.5} />
      ))}
    </g>
  );
}

/** Potted cactus — 1×1 floor item */
function PlantCactusComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Pot */}
      <path d="M 3.5 9.5 L 4.5 12.5 L 8 12.5 L 9 9.5 Z" fill="#e08030" />
      <ellipse cx={6.25} cy={9.5} rx={2.8} ry={0.7} fill="#c06020" />
      {/* Main cactus body */}
      <rect x={5.3} y={3} width={1.9} height={6.5} rx={0.9} fill="#40a040" />
      {/* Left arm */}
      <rect x={3.5} y={5.5} width={1.9} height={1.2} rx={0.6} fill="#40a040" />
      <rect x={3.5} y={4} width={1.2} height={1.7} rx={0.6} fill="#40a040" />
      {/* Right arm */}
      <rect x={6.85} y={6.5} width={2} height={1} rx={0.5} fill="#40a040" />
      <rect x={7.65} y={5.2} width={1.2} height={1.5} rx={0.5} fill="#40a040" />
      {/* Spines */}
      {[3.5, 5, 6.5, 8].map((y, i) => (
        <line key={i} x1={5.3} y1={y} x2={4.3} y2={y - 0.3} stroke="#c8a040" strokeWidth={0.3} />
      ))}
      {/* Flower on top */}
      <circle cx={6.25} cy={3} r={0.8} fill="#ff80c0" />
      <circle cx={6.25} cy={3} r={0.4} fill="#ffe840" />
    </g>
  );
}

/** Teddy bear — 1×1 floor item */
function TeddyBearComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Body */}
      <ellipse cx={6.25} cy={8.5} rx={3.5} ry={4} fill="#c89050" />
      {/* Head */}
      <circle cx={6.25} cy={4.5} r={2.8} fill="#c89050" />
      {/* Ears */}
      <circle cx={3.8} cy={2.3} r={1.3} fill="#c89050" />
      <circle cx={3.8} cy={2.3} r={0.7} fill="#d4a068" />
      <circle cx={8.7} cy={2.3} r={1.3} fill="#c89050" />
      <circle cx={8.7} cy={2.3} r={0.7} fill="#d4a068" />
      {/* Face */}
      <circle cx={5.2} cy={4} r={0.5} fill="#3a2010" />
      <circle cx={7.3} cy={4} r={0.5} fill="#3a2010" />
      <ellipse cx={6.25} cy={5.3} rx={1} ry={0.6} fill="#d4a068" />
      <path d="M 5.5 5.7 Q 6.25 6.3 7 5.7" stroke="#3a2010" strokeWidth={0.4} fill="none" />
      {/* Arms */}
      <ellipse cx={3} cy={8} rx={1.2} ry={2.5} fill="#c89050" transform="rotate(-20, 3, 8)" />
      <ellipse cx={9.5} cy={8} rx={1.2} ry={2.5} fill="#c89050" transform="rotate(20, 9.5, 8)" />
      {/* Belly patch */}
      <ellipse cx={6.25} cy={8.5} rx={2} ry={2.5} fill="#d4a068" />
      {/* Bow tie */}
      <path d="M 5 6.5 L 6.25 7.2 L 7.5 6.5 L 6.25 7.8 Z" fill="#ff4060" />
    </g>
  );
}

/** Beach ball — 1×1 floor item */
function BallBeachComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Ball */}
      <circle cx={6.25} cy={7} r={4.5} fill="#f0f0f0" />
      {/* Color segments */}
      <path d="M 6.25 2.5 Q 10.75 4.75 10.75 7 L 6.25 7 Z" fill="#ff4040" />
      <path d="M 10.75 7 Q 10.75 9.25 6.25 11.5 L 6.25 7 Z" fill="#4080ff" />
      <path d="M 6.25 11.5 Q 1.75 9.25 1.75 7 L 6.25 7 Z" fill="#ffe840" />
      <path d="M 1.75 7 Q 1.75 4.75 6.25 2.5 L 6.25 7 Z" fill="#40c040" />
      {/* Highlight */}
      <circle cx={4} cy={4} r={1} fill="#fff" opacity={0.5} />
      {/* Outline */}
      <circle cx={6.25} cy={7} r={4.5} fill="none" stroke="#c0c0c0" strokeWidth={0.3} />
    </g>
  );
}

/** Rocket lamp — 1×1 floor item */
function RocketLampComponent(): ReactElement {
  return (
    <g aria-hidden>
      {/* Base */}
      <ellipse cx={6.25} cy={12} rx={3} ry={0.7} fill="#808090" />
      {/* Pole */}
      <rect x={5.9} y={6} width={0.7} height={6} fill="#a0a0b0" />
      {/* Rocket body */}
      <rect x={4.5} y={4} width={3.5} height={4} rx={0.5} fill="#4060d0" />
      {/* Nose cone */}
      <path d="M 4.5 4 L 6.25 1 L 8 4 Z" fill="#d04040" />
      {/* Window */}
      <circle cx={6.25} cy={5.5} r={1} fill="#a0d0ff" stroke="#2040a0" strokeWidth={0.3} />
      {/* Fins */}
      <path d="M 4.5 7.5 L 3 9 L 4.5 8 Z" fill="#d04040" />
      <path d="M 8 7.5 L 9.5 9 L 8 8 Z" fill="#d04040" />
      {/* Glow exhaust */}
      <ellipse cx={6.25} cy={8.3} rx={1.5} ry={0.6} fill="#ff8020" opacity={0.6} />
      {/* Stars */}
      <circle cx={3} cy={2} r={0.3} fill="#ffe840" />
      <circle cx={9.5} cy={2.5} r={0.3} fill="#ffe840" />
      <circle cx={10} cy={5} r={0.25} fill="#ffe840" />
    </g>
  );
}

// ─── CATALOG ─────────────────────────────────────────────────────────────────

export const FURNITURE_CATALOG: FurnitureDef[] = [
  // wall_art — wall surface
  {
    slug: 'poster-stars',
    category: 'wall_art',
    surface: 'wall',
    footprint: { w: 1, h: 1 },
    nameZh: '星空海报',
    nameEn: 'Star Poster',
    rarity: 'common',
    priceCoins: 90,
    Component: PosterStarsComponent,
  },
  {
    slug: 'framed-fish',
    category: 'wall_art',
    surface: 'wall',
    footprint: { w: 1, h: 1 },
    nameZh: '鱼画框',
    nameEn: 'Framed Fish',
    rarity: 'common',
    priceCoins: 110,
    Component: FramedFishComponent,
  },
  {
    slug: 'clock-round',
    category: 'wall_art',
    surface: 'wall',
    footprint: { w: 1, h: 1 },
    nameZh: '圆形挂钟',
    nameEn: 'Round Clock',
    rarity: 'common',
    priceCoins: 120,
    Component: ClockRoundComponent,
  },
  // window_light — wall or floor
  {
    slug: 'window-sunny',
    category: 'window_light',
    surface: 'wall',
    footprint: { w: 2, h: 1 },
    nameZh: '阳光窗户',
    nameEn: 'Sunny Window',
    rarity: 'common',
    priceCoins: 160,
    Component: WindowSunnyComponent,
  },
  {
    slug: 'lamp-string',
    category: 'window_light',
    surface: 'wall',
    footprint: { w: 1, h: 1 },
    nameZh: '彩灯串',
    nameEn: 'String Lights',
    rarity: 'common',
    priceCoins: 130,
    Component: LampStringComponent,
  },
  {
    slug: 'floor-lamp',
    category: 'window_light',
    surface: 'floor',
    footprint: { w: 1, h: 1 },
    nameZh: '落地灯',
    nameEn: 'Floor Lamp',
    rarity: 'common',
    priceCoins: 130,
    Component: FloorLampComponent,
  },
  // furniture — floor surface
  {
    slug: 'bed-cozy',
    category: 'furniture',
    surface: 'floor',
    footprint: { w: 2, h: 1 },
    nameZh: '温馨小床',
    nameEn: 'Cozy Bed',
    rarity: 'rare',
    priceCoins: 300,
    Component: BedCozyComponent,
  },
  {
    slug: 'sofa-teal',
    category: 'furniture',
    surface: 'floor',
    footprint: { w: 2, h: 1 },
    nameZh: '蓝绿色沙发',
    nameEn: 'Teal Sofa',
    rarity: 'rare',
    priceCoins: 320,
    Component: SofaTealComponent,
  },
  {
    slug: 'chair-wood',
    category: 'furniture',
    surface: 'floor',
    footprint: { w: 1, h: 1 },
    nameZh: '木椅',
    nameEn: 'Wooden Chair',
    rarity: 'common',
    priceCoins: 120,
    Component: ChairWoodComponent,
  },
  {
    slug: 'table-round',
    category: 'furniture',
    surface: 'floor',
    footprint: { w: 1, h: 1 },
    nameZh: '圆桌',
    nameEn: 'Round Table',
    rarity: 'common',
    priceCoins: 140,
    Component: TableRoundComponent,
  },
  {
    slug: 'bookshelf',
    category: 'furniture',
    surface: 'floor',
    footprint: { w: 2, h: 1 },
    nameZh: '书架',
    nameEn: 'Bookshelf',
    rarity: 'rare',
    priceCoins: 300,
    Component: BookshelfComponent,
  },
  {
    slug: 'toy-chest',
    category: 'furniture',
    surface: 'floor',
    footprint: { w: 1, h: 1 },
    nameZh: '玩具箱',
    nameEn: 'Toy Chest',
    rarity: 'common',
    priceCoins: 150,
    Component: ToyChestComponent,
  },
  {
    slug: 'desk-study',
    category: 'furniture',
    surface: 'floor',
    footprint: { w: 2, h: 1 },
    nameZh: '书桌',
    nameEn: 'Study Desk',
    rarity: 'rare',
    priceCoins: 280,
    Component: DeskStudyComponent,
  },
  // rug — floor surface
  {
    slug: 'rug-round',
    category: 'rug',
    surface: 'floor',
    footprint: { w: 1, h: 1 },
    nameZh: '圆形地毯',
    nameEn: 'Round Rug',
    rarity: 'common',
    priceCoins: 100,
    Component: RugRoundComponent,
  },
  {
    slug: 'rug-stripe',
    category: 'rug',
    surface: 'floor',
    footprint: { w: 2, h: 1 },
    nameZh: '条纹地毯',
    nameEn: 'Striped Rug',
    rarity: 'common',
    priceCoins: 140,
    Component: RugStripeComponent,
  },
  // plant_toy — floor surface
  {
    slug: 'plant-fern',
    category: 'plant_toy',
    surface: 'floor',
    footprint: { w: 1, h: 1 },
    nameZh: '蕨类植物',
    nameEn: 'Fern Plant',
    rarity: 'common',
    priceCoins: 90,
    Component: PlantFernComponent,
  },
  {
    slug: 'plant-cactus',
    category: 'plant_toy',
    surface: 'floor',
    footprint: { w: 1, h: 1 },
    nameZh: '仙人掌',
    nameEn: 'Cactus',
    rarity: 'common',
    priceCoins: 90,
    Component: PlantCactusComponent,
  },
  {
    slug: 'teddy-bear',
    category: 'plant_toy',
    surface: 'floor',
    footprint: { w: 1, h: 1 },
    nameZh: '泰迪熊',
    nameEn: 'Teddy Bear',
    rarity: 'common',
    priceCoins: 110,
    Component: TeddyBearComponent,
  },
  {
    slug: 'ball-beach',
    category: 'plant_toy',
    surface: 'floor',
    footprint: { w: 1, h: 1 },
    nameZh: '沙滩球',
    nameEn: 'Beach Ball',
    rarity: 'common',
    priceCoins: 80,
    Component: BallBeachComponent,
  },
  {
    slug: 'rocket-lamp',
    category: 'plant_toy',
    surface: 'floor',
    footprint: { w: 1, h: 1 },
    nameZh: '火箭灯',
    nameEn: 'Rocket Lamp',
    rarity: 'rare',
    priceCoins: 150,
    Component: RocketLampComponent,
  },
];

export const FURNITURE_BY_SLUG = new Map<string, FurnitureDef>(
  FURNITURE_CATALOG.map((f) => [f.slug, f]),
);

export function getFurniture(slug: string): FurnitureDef | undefined {
  return FURNITURE_BY_SLUG.get(slug);
}
