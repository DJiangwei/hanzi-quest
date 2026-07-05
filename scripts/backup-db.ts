// Off-Neon database backup (roadmap C2). Dumps every table in the public
// schema to gzipped JSONL: one line per row, prefixed sections per table.
// Zero deps beyond the existing postgres client + node zlib.
//
// Usage:
//   pnpm tsx scripts/backup-db.ts                 → backs up DATABASE_URL (dev branch by default post-C1)
//   (prod) swap DATABASE_URL in .env.local to the commented # PROD_DATABASE_URL line, run, swap back
//
// Output: backups/backup-<host>-<YYYY-MM-DDTHH-mm>.jsonl.gz  (backups/ is gitignored)
//
// Restore story (disaster recovery, tiny DB): gunzip, then for each `#table:`
// section INSERT the JSON rows back with a small script — column names are
// preserved verbatim. This is deliberately simple; it protects against
// account-level data loss, not point-in-time recovery (Neon handles short PITR).
import { config as loadEnv } from 'dotenv';
import { createWriteStream, mkdirSync } from 'node:fs';
import { createGzip } from 'node:zlib';

async function main() {
  loadEnv({ path: '.env.local' });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const host = new URL(url).hostname.split('.')[0];

  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { max: 1 });

  const tables = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`;

  mkdirSync('backups', { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
  const path = `backups/backup-${host}-${stamp}.jsonl.gz`;
  const gzip = createGzip();
  const out = createWriteStream(path);
  gzip.pipe(out);
  const write = (line: string) =>
    new Promise<void>((resolve, reject) =>
      gzip.write(line + '\n', (err) => (err ? reject(err) : resolve())),
    );

  console.log(`Backing up ${tables.length} tables from ${host} → ${path}`);
  let totalRows = 0;
  for (const { table_name } of tables) {
    const rows = await sql`SELECT * FROM ${sql(table_name)}`;
    await write(`#table:${table_name} rows:${rows.length}`);
    for (const row of rows) await write(JSON.stringify(row));
    totalRows += rows.length;
    console.log(`  ${table_name}: ${rows.length}`);
  }

  await new Promise<void>((resolve, reject) => {
    gzip.end(() => resolve());
    gzip.on('error', reject);
  });
  await sql.end();
  console.log(`Done: ${totalRows} rows total → ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
