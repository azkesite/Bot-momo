import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDatabaseClient } from './client.js';

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo';

  const { client, db } = await createDatabaseClient(connectionString);

  try {
    await migrate(db, {
      migrationsFolder: 'packages/memory/drizzle',
    });
  } finally {
    await client.end();
  }
}

void main();
