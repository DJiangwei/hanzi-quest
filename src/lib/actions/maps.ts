'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { listMapsForChild, setCurrentPackForChild } from '@/lib/db/maps';
import { MapLockedError } from '@/lib/errors/maps-errors';

export async function switchMapAction(
  childId: string,
  packId: string,
): Promise<void> {
  const { child } = await requireChild(childId);
  const maps = await listMapsForChild(child.id);
  const target = maps.find((m) => m.packId === packId);
  if (!target) {
    throw new Error('Map not found');
  }
  if (target.isLocked) {
    throw new MapLockedError(target.gated ? 'gated' : 'no_weeks');
  }
  await setCurrentPackForChild(child.id, packId);
  revalidatePath(`/play/${child.id}`);
}
