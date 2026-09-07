'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { PIECES, PALETTE } from '@/lib/home3d/pieces';

/**
 * SPIKE — one bedroom, real 3D geometry, LOCKED camera.
 *
 * The question this exists to answer is not "can we render 3D" but "does
 * procedural low-poly reach 動物之森 warmth without an asset pipeline". It is
 * meant to be looked at and then either kept or deleted.
 *
 * **The camera is a parameter from the first commit, not a constant.** David
 * chose a locked camera over free orbit, and the reasoning held: rotation only
 * pays off once furniture has a facing, which needs a `rotation` column and a
 * shop/editor change. But the cheap upgrade path — four fixed 90° steps — only
 * stays cheap if nothing hard-codes this angle. So the view is `CAMERA`, and a
 * later stepped rotation is a change of one value plus wall culling.
 */

/** Grid, matching the 2D room exactly: 8 cols × 6 rows, one world unit per cell. */
const COLS = 8;
const ROWS = 6;
/** Rows at the back that are WALL rather than floor, as in RoomDef.wallRows. */
const WALL_ROWS = 2;
const FLOOR_ROWS = ROWS - WALL_ROWS;

/**
 * A high, slightly-off-axis three-quarter view — the angle that reads as
 * "dollhouse" rather than "architectural".
 *
 * Tuned BY LOOKING, which is the only way this can be tuned. The first values
 * were derived arithmetically to frame the whole 8×4 floor, and the result was
 * half a picture of empty boards with every object too small to identify — the
 * literal complaint. Aiming slightly BEHIND centre and pulling in fills the
 * frame with furniture instead of floor.
 */
const CAMERA = { position: [5.9, 5.0, 6.6] as const, fov: 33, target: [0.15, 0.85, -0.25] as const };

export interface Placed3D {
  slug: string;
  gridX: number;
  gridY: number;
  /** Footprint in cells, so a 2×1 piece centres across both. */
  w: number;
  h: number;
  surface: 'wall' | 'floor';
}

/**
 * Grid cell → world position, origin at the room's centre.
 *
 * Exported for test: this mapping is the ONE place the 3D room can silently
 * disagree with the 2D one. Both read the same `gridX/gridY` from
 * `home_placements`, so an off-by-one here puts her bed inside a wall while
 * every other surface still shows it correctly.
 */
export function cellToWorld(gridX: number, gridY: number, w: number, h: number) {
  const x = gridX + w / 2 - COLS / 2;
  const zRow = gridY - WALL_ROWS;
  const z = zRow + h / 2 - FLOOR_ROWS / 2;
  return { x, z };
}

function Room() {
  return (
    <group>
      {/* Floorboards, not one plane. A bare expanse of colour is the single
          biggest thing that reads as "3D demo" rather than "room" — planks give
          the eye a scale reference and a direction, and cost eight quads. */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, i % 2 ? 0.001 : 0, -FLOOR_ROWS / 2 + (i + 0.5) * (FLOOR_ROWS / 10)]}
          receiveShadow
        >
          <planeGeometry args={[COLS, FLOOR_ROWS / 10]} />
          <meshStandardMaterial color={i % 2 ? PALETTE.floor : PALETTE.floorAlt} roughness={0.78} />
        </mesh>
      ))}

      {/* Walls in two tones with a picture rail between them. Wainscoting is
          how a real room stops being a backdrop; the rail also gives the wall
          items something to sit against instead of floating on flat colour. */}
      {([
        [[0, 1.75, -FLOOR_ROWS / 2], [0, 0, 0], [COLS, 3.5]],
        [[-COLS / 2, 1.75, 0], [0, Math.PI / 2, 0], [FLOOR_ROWS, 3.5]],
      ] as const).map(([pos, rot, size], i) => (
        <group key={i}>
          <mesh position={[...pos]} rotation={[...rot]} receiveShadow>
            <planeGeometry args={[size[0], size[1]]} />
            <meshStandardMaterial color={PALETTE.wall} roughness={0.95} />
          </mesh>
          {/* Lower band, a shade deeper */}
          <mesh position={[pos[0], 0.55, pos[2]]} rotation={[...rot]} receiveShadow>
            <planeGeometry args={[size[0], 1.1]} />
            <meshStandardMaterial color="#eddcb8" roughness={0.95} />
          </mesh>
        </group>
      ))}
      {/* Picture rail */}
      <mesh position={[0, 1.12, -FLOOR_ROWS / 2 + 0.04]}>
        <boxGeometry args={[COLS, 0.07, 0.08]} />
        <meshStandardMaterial color={PALETTE.cream} roughness={0.6} />
      </mesh>
      <mesh position={[-COLS / 2 + 0.04, 1.12, 0]}>
        <boxGeometry args={[0.08, 0.07, FLOOR_ROWS]} />
        <meshStandardMaterial color={PALETTE.cream} roughness={0.6} />
      </mesh>
      {/* Skirting — a cheap trick that does a lot: it gives the wall/floor seam
          a shadow line, which is most of what makes a room feel built. */}
      <mesh position={[0, 0.09, -FLOOR_ROWS / 2 + 0.03]}>
        <boxGeometry args={[COLS, 0.18, 0.06]} />
        <meshStandardMaterial color={PALETTE.cream} roughness={0.8} />
      </mesh>
      <mesh position={[-COLS / 2 + 0.03, 0.09, 0]}>
        <boxGeometry args={[0.06, 0.18, FLOOR_ROWS]} />
        <meshStandardMaterial color={PALETTE.cream} roughness={0.8} />
      </mesh>
    </group>
  );
}

export function HomeRoom3D({ placements }: { placements: Placed3D[] }) {
  return (
    <Canvas
      // `demand`: nothing moves, so the scene renders once and then costs
      // nothing. On an iPad PWA that is the difference between a decorative
      // page and one that drains the battery while she looks at it. A stepped
      // rotation later re-renders only during the turn.
      frameloop="demand"
      shadows
      dpr={[1, 2]}
      camera={{ position: [...CAMERA.position], fov: CAMERA.fov }}
      onCreated={({ camera }) => camera.lookAt(...CAMERA.target)}
      style={{ width: '100%', aspectRatio: '4 / 3', touchAction: 'pan-y' }}
      data-testid="home-room-3d"
    >
      <color attach="background" args={['#fbf3e4']} />
      {/* Warm key light from the window side + a cool fill, the two-light setup
          that gives the AC look most of its warmth. */}
      {/* Hemisphere instead of flat ambient: warm from above, floor-coloured
          bounce from below. It costs nothing, needs no HDRI or network, and is
          the single biggest step away from "three.js defaults" — flat ambient
          at 0.85 was washing every form out. */}
      <hemisphereLight args={['#fff6e4', '#e0b98a', 1.05]} />
      <directionalLight
        position={[6, 9, 5]}
        intensity={2.1}
        color="#fff0d2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
      />
      {/* Cool rim from behind-left, so silhouettes separate from the wall. */}
      <directionalLight position={[-7, 5, -4]} intensity={0.5} color="#cfe4ff" />

      <Room />

      {placements.map((p) => {
        const Piece = PIECES[p.slug];
        if (!Piece) return null;
        const { x, z } = cellToWorld(p.gridX, p.gridY, p.w, p.h);
        if (p.surface === 'wall') {
          // Wall items hang on the back wall at the row's height.
          const y = 2.6 - p.gridY * 0.85;
          return (
            <group key={`${p.slug}-${p.gridX}-${p.gridY}`} position={[x, y, -FLOOR_ROWS / 2 + 0.06]}>
              <Piece />
            </group>
          );
        }
        return (
          <group key={`${p.slug}-${p.gridX}-${p.gridY}`} position={[x, 0, z]}>
            <Piece />
          </group>
        );
      })}

      {/* The single biggest contributor to "these objects are in a room"
          rather than "these objects are floating". */}
      <ContactShadows position={[0, 0.002, 0]} opacity={0.55} scale={11} blur={1.7} far={3.2} resolution={1024} />
    </Canvas>
  );
}
