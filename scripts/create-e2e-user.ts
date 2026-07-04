// One-off: create the permanent e2e smoke-test user in Clerk (dev instance).
// Idempotent: exits cleanly if the user already exists.
// Usage: pnpm tsx scripts/create-e2e-user.ts   (prints the generated password ONCE)
import { config as loadEnv } from 'dotenv';
import { randomBytes } from 'node:crypto';

const EMAIL = 'e2e-smoke+clerk_test@example.com';

async function main() {
  loadEnv({ path: '.env.local' });
  const sk = process.env.CLERK_SECRET_KEY;
  if (!sk) throw new Error('CLERK_SECRET_KEY not set');

  const headers = { Authorization: `Bearer ${sk}`, 'Content-Type': 'application/json' };

  const existing = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(EMAIL)}`,
    { headers },
  ).then((r) => r.json());
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`e2e user already exists: ${existing[0].id} (${EMAIL})`);
    return;
  }

  const password = randomBytes(18).toString('base64url');
  const res = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email_address: [EMAIL],
      password,
      first_name: 'E2E',
      last_name: 'Smoke',
      skip_password_checks: true,
    }),
  });
  if (!res.ok) throw new Error(`Clerk create failed: ${res.status} ${await res.text()}`);
  const user = await res.json();
  console.log(`created e2e user: ${user.id}`);
  console.log(`EMAIL:    ${EMAIL}`);
  console.log(`PASSWORD: ${password}   <-- save to gh secret E2E_USER_PASSWORD now`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
