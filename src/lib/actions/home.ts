'use server';

/**
 * Server actions for the home/furniture placement system.
 * Only async functions may be exported from 'use server' files.
 */

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { db } from '@/db';
import { placeFurnitureInTx, removeFurnitureInTx } from '@/lib/db/home';
import {
  setRoomSurface,
  InvalidSurfaceError,
  SurfaceNotOwnedError,
  type RoomSurface,
} from '@/lib/db/home-surfaces';
import type { SurfaceKind } from '@/lib/home/surfaces';
import type { HomeRoomId } from '@/lib/home/rooms';
import {
  FurnitureNotOwnedError,
  CellOccupiedError,
  InvalidPlacementError,
} from '@/lib/errors/home-errors';

export interface PlaceFurnitureResult {
  ok: boolean;
  reason?: string;
}

/**
 * Place (or move) a furniture item in a room for the given child.
 * Validates ownership and placement via placeFurnitureInTx.
 */
export async function placeFurnitureAction(
  childId: string,
  room: HomeRoomId,
  slug: string,
  x: number,
  y: number,
): Promise<PlaceFurnitureResult> {
  const { child } = await requireChild(childId);

  try {
    await db.transaction((tx) =>
      placeFurnitureInTx(tx, child.id, room, slug, x, y),
    );
  } catch (err) {
    if (
      err instanceof FurnitureNotOwnedError ||
      err instanceof CellOccupiedError ||
      err instanceof InvalidPlacementError
    ) {
      return { ok: false, reason: err.message };
    }
    throw err;
  }

  revalidatePath(`/play/${childId}/home`);
  return { ok: true };
}

export interface SetSurfaceResult {
  ok: boolean;
  reason?: string;
  surface?: RoomSurface;
}

/**
 * Equip a wallpaper or floor in a room. Validates kind + ownership (or default)
 * in `setRoomSurface`. Returns the new (wallpaper, floor) pair on success.
 */
export async function setRoomSurfaceAction(
  childId: string,
  room: HomeRoomId,
  kind: SurfaceKind,
  slug: string,
): Promise<SetSurfaceResult> {
  const { child } = await requireChild(childId);

  let surface: RoomSurface;
  try {
    surface = await setRoomSurface(child.id, room, kind, slug);
  } catch (err) {
    if (err instanceof InvalidSurfaceError || err instanceof SurfaceNotOwnedError) {
      return { ok: false, reason: err.message };
    }
    throw err;
  }

  revalidatePath(`/play/${childId}/home`);
  return { ok: true, surface };
}

/**
 * Remove a furniture item's placement for the given child.
 */
export async function removeFurnitureAction(
  childId: string,
  slug: string,
): Promise<PlaceFurnitureResult> {
  const { child } = await requireChild(childId);

  try {
    await db.transaction((tx) => removeFurnitureInTx(tx, child.id, slug));
  } catch (err) {
    if (
      err instanceof FurnitureNotOwnedError ||
      err instanceof CellOccupiedError ||
      err instanceof InvalidPlacementError
    ) {
      return { ok: false, reason: err.message };
    }
    throw err;
  }

  revalidatePath(`/play/${childId}/home`);
  return { ok: true };
}
