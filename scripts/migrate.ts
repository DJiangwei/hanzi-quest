import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Vercel CLI writes env vars to .env.local; dotenv/config only loads .env.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
