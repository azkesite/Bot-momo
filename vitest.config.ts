import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@bot-momo/config': resolve(__dirname, 'packages/config/src/index.ts'),
      '@bot-momo/core': resolve(__dirname, 'packages/core/src/index.ts'),
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
