import { auth } from '@clerk/nextjs/server';
import { type ChildProfileRow, getChildOwnedBy } from '@/lib/db/children';
import { type UserRow, getUserById } from '@/lib/db/users';

export class UnauthorizedError extends Error {
  constructor(message = 'Not signed in') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Returns the current parent's mirrored DB row, or throws.
 * The Clerk webhook should have created it on signup; if it's missing,
 * the webhook lost a delivery — surface that loudly.
 */
export async function assertParent(): Promise<UserRow> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();

  const user = await getUserById(userId);
  if (!user) {
    throw new UnauthorizedError(
      `Clerk user ${userId} has no mirrored row — webhook delivery missing`,
    );
  }
  if (user.role !== 'parent' && user.role !== 'admin') {
    throw new ForbiddenError('Parent role required');
  }
  return user;
}

/**
 * Asserts the caller is a parent AND owns the given child.
 * Use in every server action that mutates child-scoped data.
 */
export async function requireChild(childId: string): Promise<{
  parent: UserRow;
  child: ChildProfileRow;
}> {
  const parent = await assertParent();
  const child = await getChildOwnedBy(childId, parent.id);
  if (!child) throw new NotFoundError(`Child ${childId} not found for parent`);
  return { parent, child };
}
