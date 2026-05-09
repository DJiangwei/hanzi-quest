import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

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
