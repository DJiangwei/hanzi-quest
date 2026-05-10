import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';

export type UserRow = typeof users.$inferSelect;

export interface UpsertUserInput {
  id: string;
  email: string;
  displayName?: string | null;
  locale?: string;
}

export async function upsertUser(input: UpsertUserInput): Promise<UserRow> {
  const [row] = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      displayName: input.displayName ?? null,
      locale: input.locale ?? 'en',
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        displayName: input.displayName ?? null,
        locale: input.locale ?? 'en',
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row;
}

export async function getUserById(id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function deleteUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}
