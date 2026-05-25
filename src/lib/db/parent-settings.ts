import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { parentSettings } from '@/db/schema';
import { COOLDOWN_MS, MAX_FAILED_ATTEMPTS } from '@/lib/auth/parent-pin';

export interface ParentSettingsRow {
  clerkUserId: string;
  parentPinHash: string;
  pinSetAt: Date;
  failedAttempts: number;
  lockedUntil: Date | null;
}

export async function getParentSettings(
  clerkUserId: string,
): Promise<ParentSettingsRow | null> {
  const rows = await db
    .select()
    .from(parentSettings)
    .where(eq(parentSettings.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setParentPin(
  clerkUserId: string,
  parentPinHash: string,
): Promise<void> {
  await db
    .insert(parentSettings)
    .values({
      clerkUserId,
      parentPinHash,
      failedAttempts: 0,
      lockedUntil: null,
    })
    .onConflictDoUpdate({
      target: parentSettings.clerkUserId,
      set: {
        parentPinHash,
        pinSetAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
}

export async function recordFailedAttempt(
  clerkUserId: string,
  currentAttempts: number,
): Promise<void> {
  const next = currentAttempts + 1;
  const reachesThreshold = next >= MAX_FAILED_ATTEMPTS;
  const set: { failedAttempts: number; lockedUntil?: Date } = {
    failedAttempts: next,
  };
  if (reachesThreshold) {
    set.lockedUntil = new Date(Date.now() + COOLDOWN_MS);
  }
  await db
    .update(parentSettings)
    .set(set)
    .where(eq(parentSettings.clerkUserId, clerkUserId));
}

export async function clearFailedAttempts(
  clerkUserId: string,
): Promise<void> {
  await db
    .update(parentSettings)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(parentSettings.clerkUserId, clerkUserId));
}
