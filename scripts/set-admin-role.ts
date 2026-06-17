/**
 * Promote a login account to the 'admin' role by email. Idempotent.
 *   pnpm tsx scripts/set-admin-role.ts banbanhu4ever@gmail.com
 * Pass a second arg 'parent' to demote.
 */
import { config } from 'dotenv';

async function main() {
  config({ path: '.env.local' });
  const email = process.argv[2];
  const role = (process.argv[3] ?? 'admin') as 'admin' | 'parent';
  if (!email) throw new Error('Usage: set-admin-role.ts <email> [admin|parent]');
  const { db } = await import('@/db');
  const { users } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const [row] = await db.update(users).set({ role }).where(eq(users.email, email)).returning({ id: users.id, role: users.role });
  if (!row) throw new Error(`No user with email ${email}`);
  console.log(`Set ${email} → role=${row.role}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
