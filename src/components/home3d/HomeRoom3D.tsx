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
const CAMERA = { position: [5.4, 4.6, 6.0] as const, fov: 34, target: [0, 0.75, -0.35] as const };

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
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[COLS, FLOOR_ROWS]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={0.9} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 1.75, -FLOOR_ROWS / 2]} receiveShadow>
        <planeGeometry args={[COLS, 3.5]} />
        <meshStandardMaterial color={PALETTE.wall} roughness={1} />
      </mesh>
      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-COLS / 2, 1.75, 0]} receiveShadow>
        <planeGeometry args={[FLOOR_ROWS, 3.5]} />
        <meshStandardMaterial color={PALETTE.wall} roughness={1} />
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
      <ambientLight intensity={0.85} color="#fff4e2" />
      <directionalLight
        position={[5, 8, 4]}
        intensity={1.6}
        color="#ffe9c9"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
      />
      <directionalLight position={[-6, 4, -3]} intensity={0.35} color="#cfe4ff" />

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
      <ContactShadows position={[0, 0.002, 0]} opacity={0.42} scale={12} blur={2.2} far={4} resolution={512} />
    </Canvas>
  );
}
