import { clerkSetup } from '@clerk/testing/playwright';
import { config as loadDotenv } from 'dotenv';

export default async function globalSetup() {
  // Local runs: pull Clerk keys from .env.local; CI provides real env vars.
  loadDotenv({ path: '.env.local' });
  process.env.CLERK_PUBLISHABLE_KEY ??=
    process.env.E2E_CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  process.env.CLERK_SECRET_KEY ??= process.env.E2E_CLERK_SECRET_KEY;
  await clerkSetup();
}
