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
  wood: '#c89b6a',
  woodDark: '#a37a4e',
  cream: '#f5ead6',
  teal: '#5fb0a8',
  tealDark: '#3f8880',
  coral: '#e88a6f',
  leaf: '#79b56a',
  sky: '#a9d6e8',
  wall: '#f0e2cb',
  floor: '#d8b58a',
  fabric: '#efd9c2',
  night: '#3a4a7a',
} as const;

const R = 0.06;

function Box({
  size,
  pos,
  color,
  radius = R,
  rot,
}: {
  size: [number, number, number];
  pos: [number, number, number];
  color: string;
  radius?: number;
  rot?: [number, number, number];
}) {
  return (
    <RoundedBox
      args={size}
      radius={Math.min(radius, Math.min(...size) / 2.05)}
      smoothness={3}
      position={pos}
      rotation={rot}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.75} />
    </RoundedBox>
  );
}

/** 2×1 — bed-cozy */
export function BedCozy(): ReactElement {
  return (
    <group>
      <Box size={[1.8, 0.34, 0.9]} pos={[0, 0.22, 0]} color={PALETTE.wood} />
      <Box size={[1.7, 0.22, 0.82]} pos={[0, 0.45, 0]} color={PALETTE.fabric} />
      {/* Headboard, tall enough to read from the fixed camera angle. */}
      <Box size={[0.16, 0.75, 0.9]} pos={[-0.88, 0.42, 0]} color={PALETTE.woodDark} />
      <Box size={[0.5, 0.14, 0.66]} pos={[-0.6, 0.6, 0]} color={PALETTE.cream} />
      <Box size={[1.0, 0.1, 0.86]} pos={[0.32, 0.58, 0]} color={PALETTE.teal} />
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
    [-0.62, 0.42, PALETTE.coral], [-0.5, 0.5, PALETTE.teal], [-0.39, 0.44, PALETTE.night],
    [0.3, 0.46, PALETTE.leaf], [0.42, 0.52, PALETTE.coral], [0.53, 0.4, PALETTE.sky],
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
        <Box key={i} size={[0.11, 0.34 + h * 0.12, 0.26]} pos={[x, (i < 3 ? 0.54 : 1.02) + (0.34 + h * 0.12) / 2, 0.04]} color={c} radius={0.015} />
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
      <Box size={[0.3, 0.22, 0.2]} pos={[-0.5, 0.88, -0.1]} color={PALETTE.teal} radius={0.03} />
    </group>
  );
}

/** 1×1 — toy-chest */
export function ToyChest(): ReactElement {
  return (
    <group>
      <Box size={[0.82, 0.5, 0.6]} pos={[0, 0.25, 0]} color={PALETTE.coral} />
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
};
