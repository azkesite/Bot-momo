import { defineConfig } from 'drizzle-kit';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo';

export default defineConfig({
  out: './packages/memory/drizzle',
  schema: './packages/memory/src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
  verbose: true,
  strict: true,
});

