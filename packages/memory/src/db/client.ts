import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import { schemaTables } from './schema.js';

export async function createDatabaseClient(connectionString: string) {
  const client = new Client({
    connectionString,
  });

  await client.connect();

  return {
    client,
    db: drizzle(client, {
      schema: schemaTables,
    }),
  };
}
