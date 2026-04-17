import { describe, expect, it } from 'vitest';

import { loadConfig } from '../packages/config/src/index.js';
import { createAppContext, createServer } from '../apps/bot-server/src/app.js';

function createTestConfig() {
  return loadConfig({
    PORT: '8787',
    NAPCAT_BASE_URL: 'http://127.0.0.1:3000',
    NAPCAT_ACCESS_TOKEN: 'token',
    ADMIN_TOKEN: 'admin-token',
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
    REDIS_URL: 'redis://127.0.0.1:6379',
  });
}

describe('healthcheck endpoints', () => {
  it('returns liveness information', async () => {
    const server = createServer(createAppContext(createTestConfig()));

    const response = await server.inject({
      method: 'GET',
      url: '/health/live',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'bot-server',
    });

    await server.close();
  });

  it('returns readiness information with dependency visibility', async () => {
    const server = createServer(createAppContext(createTestConfig()));

    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'bot-server',
      config: {
        provider: 'openai',
        llmTransportMode: 'heuristic',
        botName: 'momo',
        activeReplyEnabled: true,
        napcatBaseUrl: 'http://127.0.0.1:3000',
        port: 8787,
      },
      dependencies: {
        database: {
          configured: true,
          status: 'configured',
        },
        redis: {
          configured: true,
          status: 'configured',
        },
        napcat: {
          configured: true,
          status: 'configured',
        },
      },
    });

    await server.close();
  });
});
