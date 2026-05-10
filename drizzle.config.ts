import { defineConfig } from 'drizzle-kit';
import { config as loadEnv } from 'dotenv';

// Vercel CLI writes env vars to .env.local; dotenv/config only loads .env.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn(
    '[drizzle] DATABASE_URL not set. Run `vercel env pull .env.local` after provisioning Neon.',
  );
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: url ?? 'postgres://placeholder' },
  strict: true,
  verbose: true,
});
