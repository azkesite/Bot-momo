import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '@bot-momo/config';
import { EnvFileError, loadLocalEnvFile } from '../apps/bot-server/src/load-local-env.js';

describe('local env loader', () => {
  it('loads .env.local into env without overriding shell variables', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'bot-momo-env-'));

    try {
      writeFileSync(
        join(tempDir, '.env.local'),
        [
          'PORT=8787',
          'NAPCAT_BASE_URL=http://127.0.0.1:3000',
          'NAPCAT_ACCESS_TOKEN=napcat-token',
          'ADMIN_TOKEN=admin-token',
          'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
          'REDIS_URL=redis://127.0.0.1:6379',
          'DEFAULT_PROVIDER=kimi',
          'LLM_TRANSPORT_MODE=remote',
          'KIMI_API_KEY=kimi-key',
          'KIMI_MODEL=kimi-latest',
        ].join('\n'),
        'utf8',
      );

      const env: NodeJS.ProcessEnv = {
        PORT: '9999',
      };

      const result = loadLocalEnvFile({
        cwd: tempDir,
        env,
      });

      const config = loadConfig(env);

      expect(result.loaded).toBe(true);
      expect(result.appliedKeys).toContain('DEFAULT_PROVIDER');
      expect(env.PORT).toBe('9999');
      expect(config.port).toBe(9999);
      expect(config.defaultProvider).toBe('kimi');
      expect(config.llmTransportMode).toBe('remote');
      expect(config.llmProviders.kimi.apiKey).toBe('kimi-key');
      expect(config.llmProviders.kimi.model).toBe('kimi-latest');
      expect(config.napcatBaseUrl).toBe('http://127.0.0.1:3000');
    } finally {
      rmSync(tempDir, {
        force: true,
        recursive: true,
      });
    }
  });

  it('silently skips missing .env.local files', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'bot-momo-env-missing-'));

    try {
      const result = loadLocalEnvFile({
        cwd: tempDir,
        env: {},
      });

      expect(result.loaded).toBe(false);
      expect(result.appliedKeys).toEqual([]);
    } finally {
      rmSync(tempDir, {
        force: true,
        recursive: true,
      });
    }
  });

  it('fails fast when .env.local contains an invalid line', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'bot-momo-env-invalid-'));

    try {
      writeFileSync(join(tempDir, '.env.local'), 'THIS IS NOT VALID', 'utf8');

      expect(() =>
        loadLocalEnvFile({
          cwd: tempDir,
          env: {},
        }),
      ).toThrowError(EnvFileError);
    } finally {
      rmSync(tempDir, {
        force: true,
        recursive: true,
      });
    }
  });
});
