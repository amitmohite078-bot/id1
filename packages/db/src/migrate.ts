import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://salonbridge:salonbridge_dev@localhost:5432/salonbridge';

  const { db, pool } = createDb(connectionString);
  console.log('Running Drizzle migrations...');
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../drizzle') });
  console.log('Migrations completed successfully.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

