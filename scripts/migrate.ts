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

  // First pass: apply all schema migrations (including ALTER TYPE … ADD VALUE).
  // These run inside Drizzle's single wrapping transaction.
  {
    const sql = postgres(connectionString, { max: 1 });
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Schema migrations applied');
    await sql.end();
  }

  // Second pass (new connection): run any pending data-seed migrations that
  // could not be part of the same transaction as an ADD VALUE statement.
  // Postgres requires enum values to be committed before they can be used —
  // the fresh connection guarantees visibility.
  {
    const sql = postgres(connectionString, { max: 1 });
    try {
      await sql`
        INSERT INTO scene_templates (type, version, default_config, is_active)
        SELECT * FROM (VALUES
            ('pinyin_pick'::scene_type,    1::smallint, '{}'::jsonb, true),
            ('translate_pick'::scene_type, 1::smallint, '{}'::jsonb, true),
            ('sentence_cloze'::scene_type, 1::smallint, '{}'::jsonb, true),
            ('image_word'::scene_type,     1::smallint, '{}'::jsonb, true)
        ) AS new_rows(t, v, c, a)
        WHERE NOT EXISTS (
            SELECT 1 FROM scene_templates st
            WHERE st.type = new_rows.t AND st.version = new_rows.v
        )
      `;
      console.log('Scene-type seed applied (pinyin_pick / translate_pick / sentence_cloze / image_word)');
    } finally {
      await sql.end();
    }
  }

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
