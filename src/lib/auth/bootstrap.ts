import { auth, currentUser } from '@clerk/nextjs/server';
import { ensureSchoolCustomPack } from '@/lib/db/curriculum';
import { type UserRow, getUserById, upsertUser } from '@/lib/db/users';

/**
 * Returns the parent's mirrored DB row, creating it on first touch from the
 * Clerk session if it's missing. Lets the app work without the Clerk
 * webhook configured — the webhook is still preferred for delete/update
 * propagation but is not load-bearing for the happy path.
 *
 * Call this once near the top of every authenticated layout (e.g. /parent).
 */
export async function ensureUserBootstrapped(): Promise<UserRow | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await getUserById(userId);
  if (existing) return existing;

  const cu = await currentUser();
  if (!cu) return null;

  const email =
    cu.primaryEmailAddress?.emailAddress ??
    cu.emailAddresses[0]?.emailAddress ??
    null;
  if (!email) {
    throw new Error(`Clerk user ${userId} has no email address`);
  }

  const displayName =
    [cu.firstName, cu.lastName].filter((p): p is string => Boolean(p)).join(' ') ||
    null;

  const row = await upsertUser({ id: userId, email, displayName });
  await ensureSchoolCustomPack(userId);
  return row;
}
