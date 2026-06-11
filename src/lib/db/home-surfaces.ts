import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { homeRoomSurfaces } from '@/db/schema';
import {
  getSurface,
  isDefaultSurface,
  ROOM_DEFAULT_SURFACES,
  type SurfaceKind,
} from '@/lib/home/surfaces';
import { getOwnedFurnitureSlugs } from './home';

export interface RoomSurface {
  wallpaperSlug: string;
  floorSlug: string;
}

export class InvalidSurfaceError extends Error {}
export class SurfaceNotOwnedError extends Error {}

/**
 * The equipped wallpaper + floor for every room. Rooms without a row fall back
 * to their default surfaces (`ROOM_DEFAULT_SURFACES`).
 */
export async function getRoomSurfaces(
  childId: string,
): Promise<Record<string, RoomSurface>> {
  const rows = await db
    .select()
    .from(homeRoomSurfaces)
    .where(eq(homeRoomSurfaces.childId, childId));
  const byRoom = new Map(rows.map((r) => [r.room, r]));

  const result: Record<string, RoomSurface> = {};
  for (const [room, def] of Object.entries(ROOM_DEFAULT_SURFACES)) {
    const row = byRoom.get(room);
    result[room] = row
      ? { wallpaperSlug: row.wallpaperSlug, floorSlug: row.floorSlug }
      : { wallpaperSlug: def.wallpaper, floorSlug: def.floor };
  }
  return result;
}

/**
 * Equip a wallpaper or floor in a room. Validates the slug is a real surface of
 * the right kind, owned (via `shop_purchases` kind='home') OR a free default,
 * then upserts — preserving the other axis. Returns the new pair.
 */
export async function setRoomSurface(
  childId: string,
  room: string,
  kind: SurfaceKind,
  slug: string,
): Promise<RoomSurface> {
  const surface = getSurface(slug);
  if (!surface || surface.kind !== kind || !ROOM_DEFAULT_SURFACES[room]) {
    throw new InvalidSurfaceError(`invalid surface ${slug} for ${kind}/${room}`);
  }
  if (!isDefaultSurface(slug)) {
    const owned = await getOwnedFurnitureSlugs(childId);
    if (!owned.includes(slug)) throw new SurfaceNotOwnedError(slug);
  }

  const existing = await db
    .select()
    .from(homeRoomSurfaces)
    .where(
      and(eq(homeRoomSurfaces.childId, childId), eq(homeRoomSurfaces.room, room)),
    )
    .limit(1);

  const def = ROOM_DEFAULT_SURFACES[room];
  const cur = existing[0] ?? { wallpaperSlug: def.wallpaper, floorSlug: def.floor };
  const next: RoomSurface = {
    wallpaperSlug: kind === 'wallpaper' ? slug : cur.wallpaperSlug,
    floorSlug: kind === 'floor' ? slug : cur.floorSlug,
  };

  await db
    .insert(homeRoomSurfaces)
    .values({ childId, room, ...next })
    .onConflictDoUpdate({
      target: [homeRoomSurfaces.childId, homeRoomSurfaces.room],
      set: { ...next, updatedAt: new Date() },
    });

  return next;
}
