import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@bot-momo/config': resolve(__dirname, 'packages/config/src/index.ts'),
      '@bot-momo/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@bot-momo/decision-engine': resolve(__dirname, 'packages/decision-engine/src/index.ts'),
      '@bot-momo/llm': resolve(__dirname, 'packages/llm/src/index.ts'),
      '@bot-momo/memory': resolve(__dirname, 'packages/memory/src/index.ts'),
      '@bot-momo/sender': resolve(__dirname, 'packages/sender/src/index.ts'),
      'drizzle-orm/pg-core': resolve(__dirname, 'node_modules/drizzle-orm/pg-core/index.js'),
      'drizzle-orm/node-postgres': resolve(
        __dirname,
        'node_modules/drizzle-orm/node-postgres/index.js',
      ),
      'drizzle-orm/node-postgres/migrator': resolve(
        __dirname,
        'node_modules/drizzle-orm/node-postgres/migrator.js',
      ),
      fastify: resolve(__dirname, 'node_modules/fastify/fastify.js'),
      pg: resolve(__dirname, 'node_modules/pg/esm/index.mjs'),
      redis: resolve(__dirname, 'node_modules/redis/dist/index.js'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      enabled: false,
    },
  },
});
