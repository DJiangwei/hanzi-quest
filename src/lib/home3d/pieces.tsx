'use client';

import { RoundedBox } from '@react-three/drei';
import type { ReactElement } from 'react';

/**
 * SPIKE — procedural low-poly furniture, the same authoring model the flat-SVG
 * catalog already uses, in 3D primitives instead of paths.
 *
 * Everything visual in this codebase is hand-authored procedural: boss
 * creatures, avatars, zodiac icons, island decor, and the 25 flat-SVG
 * furniture pieces these mirror. Keeping that tradition means no asset
 * pipeline, no licence to honour, no Blob spend, and a diffable git history —
 * the same reasons the 2D catalog was written this way.
 *
 * **Rounded boxes are doing most of the Animal Crossing work.** That look is
 * chunky proportions, softened edges, warm low-saturation colour and a soft
 * contact shadow — far more than it is polygon count. A cube with a 0.06
 * radius reads as "toy"; the same cube sharp reads as "programmer art".
 *
 * One world unit = one grid cell. `HomeRoom3D` places pieces on cell centres,
 * so a piece is authored around its own origin at floor level (y = 0).
 */

/** Warm, low-saturation palette. Deliberately narrow so the room reads as one set. */
export const PALETTE = {
  wood: '#d9a463',
  woodDark: '#b07c46',
  cream: '#fdf6e7',
  teal: '#4fc0b4',
  tealDark: '#2f9b90',
  coral: '#f79274',
  leaf: '#6fc45e',
  sky: '#9fd9f0',
  wall: '#fbf0da',
  floor: '#e8cfa8',
  floorAlt: '#dfc39a',
  fabric: '#fbeddb',
  night: '#3a4a7a',
} as const;

/**
 * Roughness by material, not one value for everything.
 *
 * The first pass gave every surface 0.75–0.95 and the room read as felt. A
 * painted chest catching a little more light than the rug beside it is most of
 * what separates "toy" from "clay" — the difference is small per object and
 * large across a scene.
 */
export const FINISH = {
  painted: 0.42,
  wood: 0.62,
  fabric: 0.95,
  leaf: 0.72,
} as const;

/** Bigger than it looks necessary. Chunky rounding is the AC read. */
const R = 0.09;

function Box({
  size,
  pos,
  color,
  radius = R,
  rot,
  finish = FINISH.wood,
}: {
  size: [number, number, number];
  pos: [number, number, number];
  color: string;
  radius?: number;
  rot?: [number, number, number];
  finish?: number;
}) {
  return (
    <RoundedBox
      args={size}
      radius={Math.min(radius, Math.min(...size) / 2.05)}
      smoothness={4}
      position={pos}
      rotation={rot}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={finish} />
    </RoundedBox>
  );
}

/** 2×1 — bed-cozy */
export function BedCozy(): ReactElement {
  return (
    <group>
      <Box size={[1.8, 0.34, 0.9]} pos={[0, 0.22, 0]} color={PALETTE.wood} />
      <Box size={[1.7, 0.22, 0.82]} pos={[0, 0.45, 0]} color={PALETTE.fabric} finish={FINISH.fabric} />
      {/* Headboard, tall enough to read from the fixed camera angle. */}
      <Box size={[0.16, 0.75, 0.9]} pos={[-0.88, 0.42, 0]} color={PALETTE.woodDark} />
      <Box size={[0.5, 0.14, 0.66]} pos={[-0.6, 0.6, 0]} color={PALETTE.cream} finish={FINISH.fabric} />
      <Box size={[1.0, 0.12, 0.86]} pos={[0.32, 0.58, 0]} color={PALETTE.teal} finish={FINISH.fabric} />
      {/* Turned-back edge, so the blanket has a fold rather than being a slab. */}
      <Box size={[0.22, 0.09, 0.86]} pos={[-0.19, 0.62, 0]} color={PALETTE.tealDark} finish={FINISH.fabric} radius={0.04} />
      {[-0.8, 0.8].map((x) =>
        [-0.35, 0.35].map((z) => (
          <Box key={`${x}${z}`} size={[0.12, 0.16, 0.12]} pos={[x, 0.08, z]} color={PALETTE.woodDark} radius={0.02} />
        )),
      )}
    </group>
  );
}

/** 2×1 — bookshelf */
export function Bookshelf(): ReactElement {
  const books: [number, number, string][] = [
    [-0.68, 0.9, PALETTE.coral], [-0.55, 1.0, PALETTE.teal], [-0.43, 0.85, PALETTE.night],
    [-0.31, 0.95, PALETTE.leaf], [-0.19, 0.8, PALETTE.sky], [0.5, 0.9, PALETTE.coral],
    [0.62, 0.75, PALETTE.night], [-0.68, 0.85, PALETTE.leaf], [-0.55, 0.95, PALETTE.sky],
    [-0.43, 1.0, PALETTE.coral], [0.38, 0.8, PALETTE.teal], [0.5, 0.9, PALETTE.night],
  ];
  return (
    <group>
      {/* Carcass: back slab + two sides + top/bottom, NOT a solid block with a
          panel laid on its face — that co-planar pair z-fought into a moiré
          that read as a screen door. Only visible once rendered. */}
      <Box size={[1.8, 1.5, 0.06]} pos={[0, 0.75, -0.18]} color={PALETTE.cream} radius={0.02} />
      {[-0.87, 0.87].map((x) => (
        <Box key={x} size={[0.09, 1.5, 0.42]} pos={[x, 0.75, 0]} color={PALETTE.woodDark} />
      ))}
      <Box size={[1.8, 0.1, 0.42]} pos={[0, 1.45, 0]} color={PALETTE.woodDark} />
      <Box size={[1.8, 0.1, 0.42]} pos={[0, 0.05, 0]} color={PALETTE.woodDark} />
      {[0.5, 0.98].map((y) => (
        <Box key={y} size={[1.66, 0.08, 0.4]} pos={[0, y, 0]} color={PALETTE.wood} radius={0.02} />
      ))}
      {books.map(([x, h, c], i) => (
        <Box key={i} size={[0.1, 0.3 + h * 0.14, 0.26]} pos={[x, (i < 7 ? 0.55 : 1.03) + (0.3 + h * 0.14) / 2, 0.04]}
          color={c} radius={0.015} finish={FINISH.painted} />
      ))}
    </group>
  );
}

/** 2×1 — desk-study */
export function DeskStudy(): ReactElement {
  return (
    <group>
      <Box size={[1.8, 0.1, 0.8]} pos={[0, 0.72, 0]} color={PALETTE.wood} />
      {[-0.8, 0.8].map((x) => (
        <Box key={x} size={[0.12, 0.72, 0.7]} pos={[x, 0.36, 0]} color={PALETTE.woodDark} radius={0.03} />
      ))}
      <Box size={[0.5, 0.04, 0.36]} pos={[0.25, 0.79, 0.05]} color={PALETTE.cream} radius={0.01} />
      <Box size={[0.3, 0.22, 0.2]} pos={[-0.5, 0.88, -0.1]} color={PALETTE.teal} radius={0.03} finish={FINISH.painted} />
      {/* Desk lamp: base, arm, warm shade. */}
      <Box size={[0.24, 0.05, 0.24]} pos={[0.66, 0.79, -0.16]} color={PALETTE.coral} radius={0.02} finish={FINISH.painted} />
      <Box size={[0.05, 0.34, 0.05]} pos={[0.66, 0.97, -0.16]} color={PALETTE.coral} radius={0.02} finish={FINISH.painted} />
      <mesh position={[0.66, 1.2, -0.16]} rotation={[0.25, 0, 0]} castShadow>
        <coneGeometry args={[0.17, 0.2, 14, 1, true]} />
        <meshStandardMaterial color="#ffd98a" roughness={0.5} side={2} />
      </mesh>
    </group>
  );
}

/** 1×1 — toy-chest */
export function ToyChest(): ReactElement {
  return (
    <group>
      <Box size={[0.82, 0.5, 0.6]} pos={[0, 0.25, 0]} color={PALETTE.coral} finish={FINISH.painted} />
      <Box size={[0.86, 0.14, 0.64]} pos={[0, 0.55, 0]} color={PALETTE.woodDark} />
      <Box size={[0.14, 0.08, 0.06]} pos={[0, 0.48, 0.31]} color={PALETTE.cream} radius={0.02} />
    </group>
  );
}

/** 1×1 — plant-fern */
export function PlantFern(): ReactElement {
  return (
    <group>
      <Box size={[0.34, 0.3, 0.34]} pos={[0, 0.15, 0]} color={PALETTE.coral} radius={0.05} />
      <Box size={[0.4, 0.08, 0.4]} pos={[0, 0.32, 0]} color={PALETTE.woodDark} radius={0.03} />
      {/* Cones, arced outward from a common base. Boxes — flat or otherwise —
          read as shards at this size; a tapered form reads as a leaf, and
          arcing them from one point reads as a plant rather than a bouquet.
          Only visible by rendering it: the box version looked like a crystal. */}
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        const lean = 0.42;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.17, 0.56 + (i % 2) * 0.07, Math.sin(a) * 0.17]}
            rotation={[Math.sin(a) * lean, -a, -Math.cos(a) * lean]}
            castShadow
          >
            <coneGeometry args={[0.1, 0.46, 6]} />
            <meshStandardMaterial color={i % 2 ? PALETTE.leaf : '#8ac47a'} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

/** 1×1 — teddy-bear */
export function TeddyBear(): ReactElement {
  return (
    <group>
      <Box size={[0.34, 0.36, 0.28]} pos={[0, 0.2, 0]} color={PALETTE.wood} radius={0.1} />
      <Box size={[0.3, 0.28, 0.26]} pos={[0, 0.5, 0.02]} color={PALETTE.wood} radius={0.1} />
      {[-0.13, 0.13].map((x) => (
        <Box key={x} size={[0.12, 0.12, 0.08]} pos={[x, 0.62, 0]} color={PALETTE.woodDark} radius={0.05} />
      ))}
      {[-0.24, 0.24].map((x) => (
        <Box key={x} size={[0.1, 0.22, 0.1]} pos={[x, 0.24, 0.02]} color={PALETTE.woodDark} radius={0.045} />
      ))}
      <Box size={[0.16, 0.1, 0.04]} pos={[0, 0.46, 0.14]} color={PALETTE.cream} radius={0.03} />
    </group>
  );
}

/** 1×1 — rug-round (flat, sits under everything) */
export function RugRound(): ReactElement {
  // A cylinder, because the slug says round. A RoundedBox at this scale is a
  // square with imperceptibly soft corners — it rendered as a teal doormat.
  return (
    <group>
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <cylinderGeometry args={[0.8, 0.8, 0.024, 40]} />
        <meshStandardMaterial color={PALETTE.tealDark} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.026, 0]} receiveShadow>
        <cylinderGeometry args={[0.58, 0.58, 0.006, 40]} />
        <meshStandardMaterial color={PALETTE.teal} roughness={0.95} />
      </mesh>
    </group>
  );
}

/** 1×1 wall — window-sunny is 2×1, this is the 1×1 clock */
export function ClockRound(): ReactElement {
  return (
    <group>
      <Box size={[0.5, 0.5, 0.08]} pos={[0, 0, 0]} color={PALETTE.cream} radius={0.2} />
      <Box size={[0.34, 0.34, 0.03]} pos={[0, 0, 0.05]} color="#ffffff" radius={0.16} />
      <Box size={[0.03, 0.14, 0.02]} pos={[0, 0.05, 0.07]} color={PALETTE.night} radius={0.008} />
      <Box size={[0.11, 0.03, 0.02]} pos={[0.04, 0, 0.07]} color={PALETTE.night} radius={0.008} />
    </group>
  );
}

/** 2×1 wall — window-sunny */
export function WindowSunny(): ReactElement {
  return (
    <group>
      <Box size={[1.7, 1.1, 0.1]} pos={[0, 0, 0]} color={PALETTE.cream} radius={0.05} />
      <Box size={[1.5, 0.92, 0.06]} pos={[0, 0, 0.04]} color={PALETTE.sky} radius={0.03} />
      <Box size={[0.07, 0.92, 0.05]} pos={[0, 0, 0.07]} color={PALETTE.cream} radius={0.02} />
      <Box size={[1.5, 0.07, 0.05]} pos={[0, 0, 0.07]} color={PALETTE.cream} radius={0.02} />
    </group>
  );
}


/** 2×1 — sofa-teal */
export function SofaTeal(): ReactElement {
  return (
    <group>
      <Box size={[1.8, 0.36, 0.9]} pos={[0, 0.26, 0]} color={PALETTE.teal} finish={FINISH.fabric} />
      <Box size={[1.8, 0.5, 0.24]} pos={[0, 0.6, -0.33]} color={PALETTE.tealDark} finish={FINISH.fabric} />
      {[-0.82, 0.82].map((x) => (
        <Box key={x} size={[0.18, 0.42, 0.9]} pos={[x, 0.53, 0]} color={PALETTE.tealDark} finish={FINISH.fabric} />
      ))}
      {[-0.42, 0.42].map((x) => (
        <Box key={x} size={[0.62, 0.12, 0.72]} pos={[x, 0.48, 0.04]} color="#63cfc3" finish={FINISH.fabric} />
      ))}
      {[-0.75, 0.75].map((x) =>
        [-0.34, 0.34].map((z) => (
          <Box key={`${x}${z}`} size={[0.1, 0.14, 0.1]} pos={[x, 0.07, z]} color={PALETTE.woodDark} radius={0.02} />
        )),
      )}
    </group>
  );
}

/** 1×1 — chair-wood */
export function ChairWood(): ReactElement {
  return (
    <group>
      <Box size={[0.62, 0.09, 0.6]} pos={[0, 0.44, 0]} color={PALETTE.wood} />
      <Box size={[0.62, 0.62, 0.1]} pos={[0, 0.75, -0.26]} color={PALETTE.wood} />
      {[-0.24, 0.24].map((x) =>
        [-0.22, 0.22].map((z) => (
          <Box key={`${x}${z}`} size={[0.09, 0.44, 0.09]} pos={[x, 0.22, z]} color={PALETTE.woodDark} radius={0.03} />
        )),
      )}
    </group>
  );
}

/** 1×1 — table-round */
export function TableRound(): ReactElement {
  return (
    <group>
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.46, 0.46, 0.09, 28]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={FINISH.wood} />
      </mesh>
      <mesh position={[0, 0.31, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.11, 0.62, 14]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={FINISH.wood} />
      </mesh>
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.32, 0.06, 20]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={FINISH.wood} />
      </mesh>
    </group>
  );
}

/** 2×1 — rug-stripe */
export function RugStripe(): ReactElement {
  return (
    <group>
      <Box size={[1.75, 0.024, 0.85]} pos={[0, 0.012, 0]} color={PALETTE.cream} finish={FINISH.fabric} radius={0.01} />
      {[-0.6, -0.2, 0.2, 0.6].map((x) => (
        <Box key={x} size={[0.22, 0.006, 0.8]} pos={[x, 0.028, 0]} color={PALETTE.coral} finish={FINISH.fabric} radius={0.003} />
      ))}
    </group>
  );
}

/** 1×1 — floor-lamp */
export function FloorLamp(): ReactElement {
  return (
    <group>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.26, 0.08, 20]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={FINISH.wood} />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.1, 10]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={FINISH.wood} />
      </mesh>
      <mesh position={[0, 1.28, 0]} castShadow>
        <coneGeometry args={[0.32, 0.34, 18, 1, true]} />
        <meshStandardMaterial color="#ffe0a3" roughness={0.5} side={2} emissive="#ffcf7a" emissiveIntensity={0.28} />
      </mesh>
    </group>
  );
}

/** 1×1 — plant-cactus */
export function PlantCactus(): ReactElement {
  return (
    <group>
      <Box size={[0.36, 0.32, 0.36]} pos={[0, 0.16, 0]} color="#e07a5f" radius={0.05} finish={FINISH.painted} />
      <Box size={[0.42, 0.08, 0.42]} pos={[0, 0.34, 0]} color="#c9663f" radius={0.03} finish={FINISH.painted} />
      <mesh position={[0, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.5, 4, 12]} />
        <meshStandardMaterial color="#5fae52" roughness={FINISH.leaf} />
      </mesh>
      {[-1, 1].map((d) => (
        <mesh key={d} position={[d * 0.2, 0.78, 0]} rotation={[0, 0, -d * 0.9]} castShadow>
          <capsuleGeometry args={[0.08, 0.22, 4, 10]} />
          <meshStandardMaterial color="#69bd5b" roughness={FINISH.leaf} />
        </mesh>
      ))}
    </group>
  );
}

/** 1×1 — ball-beach */
export function BallBeach(): ReactElement {
  const stripes = ['#f26d6d', '#ffd166', '#4fc0b4', '#ffffff'];
  return (
    <group position={[0, 0.26, 0]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.26, 20, 14]} />
        <meshStandardMaterial color="#ffffff" roughness={FINISH.painted} />
      </mesh>
      {stripes.map((c, i) => (
        <mesh key={c} rotation={[0, (i / stripes.length) * Math.PI, 0]} castShadow>
          <sphereGeometry args={[0.262, 20, 14, 0, Math.PI / 4.2]} />
          <meshStandardMaterial color={c} roughness={FINISH.painted} side={2} />
        </mesh>
      ))}
    </group>
  );
}

/** 1×1 — rocket-lamp */
export function RocketLamp(): ReactElement {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.44, 4, 16]} />
        <meshStandardMaterial color={PALETTE.cream} roughness={FINISH.painted} />
      </mesh>
      <mesh position={[0, 0.92, 0]} castShadow>
        <coneGeometry args={[0.17, 0.26, 16]} />
        <meshStandardMaterial color="#f26d6d" roughness={FINISH.painted} />
      </mesh>
      <mesh position={[0, 0.6, 0.16]} castShadow>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color={PALETTE.sky} roughness={0.3} emissive="#7fd3ef" emissiveIntensity={0.3} />
      </mesh>
      {[0, 2.09, 4.19].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.16, 0.24, Math.sin(a) * 0.16]} rotation={[0, -a, 0]} castShadow>
          <coneGeometry args={[0.09, 0.28, 3]} />
          <meshStandardMaterial color="#f26d6d" roughness={FINISH.painted} />
        </mesh>
      ))}
    </group>
  );
}

/** 1×1 wall — poster-stars */
export function PosterStars(): ReactElement {
  return (
    <group>
      <Box size={[0.62, 0.72, 0.05]} pos={[0, 0, 0]} color="#4d3aa6" radius={0.03} finish={FINISH.painted} />
      <Box size={[0.5, 0.6, 0.03]} pos={[0, 0, 0.03]} color="#221a52" radius={0.02} finish={FINISH.painted} />
      {[[0, 0.06], [-0.14, 0.2], [0.15, 0.18], [-0.16, -0.14], [0.14, -0.16], [0, -0.24]].map(([x, y], i) => (
        <Box key={i} size={[0.07, 0.07, 0.02]} pos={[x, y, 0.05]} color="#ffe840" radius={0.03} finish={FINISH.painted} />
      ))}
    </group>
  );
}

/** 1×1 wall — framed-fish */
export function FramedFish(): ReactElement {
  return (
    <group>
      <Box size={[0.7, 0.56, 0.05]} pos={[0, 0, 0]} color={PALETTE.woodDark} radius={0.02} />
      <Box size={[0.58, 0.44, 0.03]} pos={[0, 0, 0.03]} color={PALETTE.sky} radius={0.015} finish={FINISH.painted} />
      <mesh position={[-0.03, 0, 0.06]} castShadow>
        <sphereGeometry args={[0.11, 14, 10]} />
        <meshStandardMaterial color="#f79274" roughness={FINISH.painted} />
      </mesh>
      <mesh position={[0.12, 0, 0.06]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.08, 0.12, 3]} />
        <meshStandardMaterial color="#f26d6d" roughness={FINISH.painted} />
      </mesh>
    </group>
  );
}

/** 1×1 wall — lamp-string */
export function LampString(): ReactElement {
  const bulbs = [-0.34, -0.17, 0, 0.17, 0.34];
  return (
    <group>
      {bulbs.map((x, i) => (
        <group key={x}>
          <Box size={[0.02, 0.1, 0.02]} pos={[x, 0.12 - (i % 2) * 0.04, 0]} color="#8a7a5a" radius={0.008} />
          <mesh position={[x, 0.02 - (i % 2) * 0.04, 0]} castShadow>
            <sphereGeometry args={[0.06, 12, 10]} />
            <meshStandardMaterial color="#ffdf8e" roughness={0.35} emissive="#ffcf6a" emissiveIntensity={0.45} />
          </mesh>
        </group>
      ))}
      <Box size={[0.78, 0.015, 0.015]} pos={[0, 0.17, 0]} color="#8a7a5a" radius={0.006} />
    </group>
  );
}

// ─── YARD ─────────────────────────────────────────────────────────────────────

/** 2×2 — yard-swing */
export function YardSwing(): ReactElement {
  return (
    <group>
      {/* Two A-frames. Each leg leans only toward its own frame's apex —
          leaning all four on separate axes made the thing read as scaffolding. */}
      {[-0.78, 0.78].map((x) =>
        [-1, 1].map((d) => (
          <mesh key={`${x}${d}`} position={[x, 0.72, d * 0.36]} rotation={[-d * 0.44, 0, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.065, 1.62, 10]} />
            <meshStandardMaterial color={PALETTE.woodDark} roughness={FINISH.wood} />
          </mesh>
        )),
      )}
      {/* Beam, spanning the two apexes. */}
      <mesh position={[0, 1.44, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 1.72, 10]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={FINISH.wood} />
      </mesh>
      {[-0.24, 0.24].map((x) => (
        <Box key={x} size={[0.03, 0.7, 0.03]} pos={[x, 1.07, 0]} color="#8a7a5a" radius={0.01} />
      ))}
      <Box size={[0.7, 0.09, 0.32]} pos={[0, 0.7, 0]} color={PALETTE.coral} radius={0.035} finish={FINISH.painted} />
    </group>
  );
}

/** 2×1 — yard-sandbox */
export function YardSandbox(): ReactElement {
  return (
    <group>
      <Box size={[1.8, 0.26, 0.9]} pos={[0, 0.13, 0]} color={PALETTE.woodDark} />
      <Box size={[1.62, 0.1, 0.74]} pos={[0, 0.24, 0]} color="#f0dcae" finish={FINISH.fabric} radius={0.02} />
      <Box size={[0.3, 0.1, 0.24]} pos={[0.5, 0.31, 0.1]} color="#f26d6d" radius={0.03} finish={FINISH.painted} />
      <Box size={[0.04, 0.3, 0.04]} pos={[0.62, 0.42, 0.1]} color="#ffd166" radius={0.015} finish={FINISH.painted} />
    </group>
  );
}

/** 2×1 — yard-picnic-table */
export function YardPicnicTable(): ReactElement {
  return (
    <group>
      <Box size={[1.75, 0.1, 0.7]} pos={[0, 0.7, 0]} color={PALETTE.wood} />
      {[-0.55, 0.55].map((z) => (
        <Box key={z} size={[1.75, 0.08, 0.26]} pos={[0, 0.4, z]} color={PALETTE.wood} />
      ))}
      {[-0.7, 0.7].map((x) => (
        <group key={x}>
          <Box size={[0.09, 0.72, 0.09]} pos={[x, 0.36, -0.28]} rot={[0.28, 0, 0]} color={PALETTE.woodDark} radius={0.03} />
          <Box size={[0.09, 0.72, 0.09]} pos={[x, 0.36, 0.28]} rot={[-0.28, 0, 0]} color={PALETTE.woodDark} radius={0.03} />
        </group>
      ))}
    </group>
  );
}

/** 1×2 — yard-tree */
export function YardTree(): ReactElement {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.19, 1.1, 12]} />
        <meshStandardMaterial color="#9a6b45" roughness={FINISH.wood} />
      </mesh>
      {[
        [0, 1.42, 0, 0.52], [-0.28, 1.24, 0.16, 0.36], [0.3, 1.2, -0.14, 0.34], [0.06, 1.05, 0.3, 0.3],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 2 ? '#5fae52' : '#6fc45e'} roughness={FINISH.leaf} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** 2×1 — yard-flower-bed */
export function YardFlowerBed(): ReactElement {
  const cols = ['#f26d6d', '#ffd166', '#f79fd0', '#ffffff', '#c58cf0'];
  return (
    <group>
      <Box size={[1.8, 0.2, 0.86]} pos={[0, 0.1, 0]} color={PALETTE.woodDark} />
      <Box size={[1.64, 0.08, 0.7]} pos={[0, 0.2, 0]} color="#6b4a30" finish={FINISH.fabric} radius={0.02} />
      {Array.from({ length: 9 }, (_, i) => {
        const x = -0.68 + (i % 5) * 0.34;
        const z = i < 5 ? -0.16 : 0.16;
        return (
          <group key={i} position={[x, 0, z]}>
            <Box size={[0.03, 0.2, 0.03]} pos={[0, 0.32, 0]} color="#5fae52" radius={0.01} />
            <mesh position={[0, 0.45, 0]} castShadow>
              <sphereGeometry args={[0.09, 10, 8]} />
              <meshStandardMaterial color={cols[i % cols.length]} roughness={FINISH.painted} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}


// ─── added 2026-09-07 ─────────────────────────────────────────────────────────

/** 2×1 — wardrobe */
export function Wardrobe(): ReactElement {
  return (
    <group>
      <Box size={[1.7, 1.9, 0.55]} pos={[0, 0.95, 0]} color={PALETTE.woodDark} />
      {[-0.42, 0.42].map((x) => (
        <Box key={x} size={[0.78, 1.7, 0.06]} pos={[x, 0.97, 0.28]} color={PALETTE.wood} radius={0.03} />
      ))}
      {[-0.05, 0.05].map((x) => (
        <Box key={x} size={[0.05, 0.16, 0.06]} pos={[x, 0.95, 0.32]} color={PALETTE.cream} radius={0.02} finish={FINISH.painted} />
      ))}
      <Box size={[1.78, 0.1, 0.62]} pos={[0, 1.94, 0]} color="#9a6b45" />
    </group>
  );
}

/** 2×1 — bunk-bed */
export function BunkBed(): ReactElement {
  return (
    <group>
      {[-0.82, 0.82].map((x) =>
        [-0.4, 0.4].map((z) => (
          <Box key={`${x}${z}`} size={[0.11, 1.9, 0.11]} pos={[x, 0.95, z]} color={PALETTE.woodDark} radius={0.04} />
        )),
      )}
      {[0.44, 1.34].map((y, i) => (
        <group key={y}>
          <Box size={[1.72, 0.14, 0.86]} pos={[0, y, 0]} color={PALETTE.wood} />
          <Box size={[1.6, 0.14, 0.78]} pos={[0, y + 0.13, 0]} color={PALETTE.fabric} finish={FINISH.fabric} />
          <Box size={[1.0, 0.1, 0.78]} pos={[0.3, y + 0.21, 0]} color={i ? PALETTE.coral : PALETTE.teal} finish={FINISH.fabric} />
          <Box size={[0.42, 0.12, 0.6]} pos={[-0.55, y + 0.21, 0]} color={PALETTE.cream} finish={FINISH.fabric} />
        </group>
      ))}
      {/* Ladder */}
      {[0.5, 0.78, 1.06, 1.34].map((y) => (
        <Box key={y} size={[0.34, 0.05, 0.05]} pos={[0.95, y, 0.28]} color={PALETTE.wood} radius={0.02} />
      ))}
    </group>
  );
}

/** 1×1 — nightstand */
export function Nightstand(): ReactElement {
  return (
    <group>
      <Box size={[0.72, 0.68, 0.6]} pos={[0, 0.34, 0]} color={PALETTE.wood} />
      {[0.24, 0.5].map((y) => (
        <Box key={y} size={[0.6, 0.22, 0.05]} pos={[0, y, 0.3]} color={PALETTE.woodDark} radius={0.02} />
      ))}
      {[0.24, 0.5].map((y) => (
        <Box key={`k${y}`} size={[0.11, 0.05, 0.05]} pos={[0, y, 0.34]} color={PALETTE.cream} radius={0.02} finish={FINISH.painted} />
      ))}
      <Box size={[0.78, 0.06, 0.66]} pos={[0, 0.7, 0]} color="#9a6b45" />
    </group>
  );
}

/** 1×1 — treasure-chest */
export function TreasureChest(): ReactElement {
  return (
    <group>
      <Box size={[0.82, 0.44, 0.56]} pos={[0, 0.22, 0]} color="#8b5e3c" />
      {/* Domed lid: a half-cylinder is what makes a box read as a chest. */}
      <mesh position={[0, 0.46, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.82, 18, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#a3703f" roughness={FINISH.wood} />
      </mesh>
      {[-0.26, 0.26].map((x) => (
        <Box key={x} size={[0.07, 0.72, 0.6]} pos={[x, 0.32, 0]} color="#ffd166" radius={0.02} finish={FINISH.painted} />
      ))}
      <Box size={[0.16, 0.2, 0.06]} pos={[0, 0.4, 0.29]} color="#ffd166" radius={0.03} finish={FINISH.painted} />
    </group>
  );
}

/** 2×1 — rug-star */
export function RugStar(): ReactElement {
  return (
    <group>
      <Box size={[1.78, 0.024, 0.86]} pos={[0, 0.012, 0]} color="#3b4a86" finish={FINISH.fabric} radius={0.06} />
      <Box size={[1.6, 0.008, 0.7]} pos={[0, 0.026, 0]} color="#4f5fa6" finish={FINISH.fabric} radius={0.05} />
      {[-0.52, 0, 0.52].map((x, i) => (
        <mesh key={x} position={[x, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[i === 1 ? 0.19 : 0.14, 5]} />
          <meshStandardMaterial color="#ffd166" roughness={FINISH.fabric} />
        </mesh>
      ))}
    </group>
  );
}

/** 2×1 wall — map-pirate */
export function MapPirate(): ReactElement {
  return (
    <group>
      <Box size={[1.7, 0.95, 0.06]} pos={[0, 0, 0]} color="#8b5e3c" radius={0.02} />
      <Box size={[1.54, 0.8, 0.03]} pos={[0, 0, 0.04]} color="#f0dcae" radius={0.015} finish={FINISH.painted} />
      <Box size={[0.9, 0.03, 0.02]} pos={[-0.2, 0.12, 0.06]} color="#c9a97e" radius={0.008} />
      <Box size={[0.6, 0.03, 0.02]} pos={[0.25, -0.1, 0.06]} color="#c9a97e" radius={0.008} />
      {/* The X. */}
      {[0.6, -0.6].map((r) => (
        <Box key={r} size={[0.16, 0.035, 0.02]} pos={[0.42, 0.24, 0.07]} rot={[0, 0, r]} color="#b8232a" radius={0.01} finish={FINISH.painted} />
      ))}
    </group>
  );
}

/** 2×1 wall — shelf-wall */
export function ShelfWall(): ReactElement {
  return (
    <group>
      <Box size={[1.7, 0.08, 0.26]} pos={[0, -0.1, 0.06]} color="#8b5e3c" />
      {[-0.62, -0.5, -0.38].map((x, i) => (
        <Box key={x} size={[0.09, 0.34, 0.2]} pos={[x, 0.11, 0.06]} color={['#f26d6d', '#4fc0b4', '#3b4a86'][i]} radius={0.015} finish={FINISH.painted} />
      ))}
      <mesh position={[0.02, 0.14, 0.06]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color="#6fc45e" roughness={FINISH.leaf} />
      </mesh>
      <Box size={[0.16, 0.12, 0.16]} pos={[0.02, 0.0, 0.06]} color="#c9663f" radius={0.02} finish={FINISH.painted} />
      <Box size={[0.36, 0.22, 0.2]} pos={[0.56, 0.05, 0.06]} color="#ffd166" radius={0.03} finish={FINISH.painted} />
    </group>
  );
}

/** 1×1 wall — lantern-hanging */
export function LanternHanging(): ReactElement {
  return (
    <group>
      <Box size={[0.04, 0.24, 0.04]} pos={[0, 0.36, 0]} color="#6f4a2e" radius={0.015} />
      <Box size={[0.44, 0.08, 0.32]} pos={[0, 0.22, 0]} color="#8b5e3c" radius={0.02} />
      <mesh position={[0, -0.02, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.21, 0.42, 6]} />
        <meshStandardMaterial color="#ffd166" roughness={0.45} emissive="#ffcf6a" emissiveIntensity={0.35} />
      </mesh>
      <Box size={[0.36, 0.07, 0.28]} pos={[0, -0.25, 0]} color="#8b5e3c" radius={0.02} />
    </group>
  );
}

/** 1×1 — globe-desk */
export function GlobeDesk(): ReactElement {
  return (
    <group>
      <Box size={[0.36, 0.07, 0.3]} pos={[0, 0.035, 0]} color={PALETTE.woodDark} radius={0.02} />
      <Box size={[0.06, 0.24, 0.06]} pos={[0, 0.19, 0]} color={PALETTE.woodDark} radius={0.02} />
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.27, 20, 16]} />
        <meshStandardMaterial color="#7fc3e8" roughness={0.5} />
      </mesh>
      {/* Continents: a few flattened patches, enough to read as land. */}
      {[
        [0.3, 0.5, 0.11], [-0.9, -0.2, 0.09], [1.9, 0.1, 0.08], [2.7, -0.6, 0.07],
      ].map(([a, b, r], i) => (
        <mesh key={i} position={[Math.cos(a) * Math.cos(b) * 0.27, 0.52 + Math.sin(b) * 0.27, Math.sin(a) * Math.cos(b) * 0.27]} castShadow>
          <sphereGeometry args={[r, 10, 8]} />
          <meshStandardMaterial color="#6fc45e" roughness={FINISH.leaf} />
        </mesh>
      ))}
      <mesh position={[0, 0.52, 0]} rotation={[0, 0, 0.35]}>
        <torusGeometry args={[0.3, 0.018, 8, 28, Math.PI]} />
        <meshStandardMaterial color="#ffd166" roughness={FINISH.painted} />
      </mesh>
    </group>
  );
}

/** 2×1 — yard-bench */
export function YardBench(): ReactElement {
  return (
    <group>
      {[-0.16, 0.16].map((z) => (
        <Box key={z} size={[1.74, 0.09, 0.24]} pos={[0, 0.46, z]} color={PALETTE.wood} radius={0.03} />
      ))}
      {[0.66, 0.86].map((y) => (
        <Box key={y} size={[1.74, 0.16, 0.07]} pos={[0, y, -0.3]} color={PALETTE.wood} radius={0.03} />
      ))}
      {[-0.74, 0.74].map((x) => (
        <group key={x}>
          <Box size={[0.1, 0.5, 0.1]} pos={[x, 0.23, -0.24]} color={PALETTE.woodDark} radius={0.03} />
          <Box size={[0.1, 0.5, 0.1]} pos={[x, 0.23, 0.22]} color={PALETTE.woodDark} radius={0.03} />
          <Box size={[0.09, 0.5, 0.09]} pos={[x, 0.72, -0.3]} color={PALETTE.woodDark} radius={0.03} />
        </group>
      ))}
    </group>
  );
}

export const PIECES: Record<string, () => ReactElement> = {
  'bed-cozy': BedCozy,
  bookshelf: Bookshelf,
  'desk-study': DeskStudy,
  'toy-chest': ToyChest,
  'plant-fern': PlantFern,
  'teddy-bear': TeddyBear,
  'rug-round': RugRound,
  'clock-round': ClockRound,
  'window-sunny': WindowSunny,
  'sofa-teal': SofaTeal,
  'chair-wood': ChairWood,
  'table-round': TableRound,
  'rug-stripe': RugStripe,
  'floor-lamp': FloorLamp,
  'plant-cactus': PlantCactus,
  'ball-beach': BallBeach,
  'rocket-lamp': RocketLamp,
  'poster-stars': PosterStars,
  'framed-fish': FramedFish,
  'lamp-string': LampString,
  'yard-swing': YardSwing,
  'yard-sandbox': YardSandbox,
  'yard-picnic-table': YardPicnicTable,
  'yard-tree': YardTree,
  'yard-flower-bed': YardFlowerBed,
  wardrobe: Wardrobe,
  'bunk-bed': BunkBed,
  nightstand: Nightstand,
  'pirate-chest': TreasureChest,
  'rug-star': RugStar,
  'map-pirate': MapPirate,
  'shelf-wall': ShelfWall,
  'lantern-hanging': LanternHanging,
  'globe-desk': GlobeDesk,
  'yard-bench': YardBench,
};
