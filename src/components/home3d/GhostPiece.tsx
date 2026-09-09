'use client';
import type { ReactElement } from 'react';
import { PIECES } from '@/lib/home3d/pieces';
import { cellToWorld } from '@/lib/home3d/coords';
import { ghostTint, ghostTiles } from '@/lib/home3d/ghost';

export function GhostPiece({
  slug, gridX, gridY, w, h, legal,
}: {
  slug: string; gridX: number; gridY: number; w: number; h: number; legal: boolean;
}): ReactElement | null {
  const Piece = PIECES[slug];
  if (!Piece) return null;               // unknown slug renders nothing, never a guess
  const { x, z } = cellToWorld(gridX, gridY, w, h);
  const tint = ghostTint(legal);

  return (
    <group>
      {/* footprint tiles just above the floor, so they read on any surface */}
      {ghostTiles(gridX, gridY, w, h).map((c) => {
        const p = cellToWorld(c.x, c.y, 1, 1);
        return (
          <mesh key={`${c.x},${c.y}`} position={[p.x, 0.02, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.96, 0.96]} />
            <meshBasicMaterial color={tint} transparent opacity={0.45} />
          </mesh>
        );
      })}
      {/* the piece itself, translucent */}
      <group position={[x, 0, z]}>
        <Piece />
      </group>
    </group>
  );
}
