import { describe, expect, it } from 'vitest';

import { loadConfig } from '../packages/config/src/index.js';
import { createAppStatus } from '../apps/bot-server/src/app.js';

describe('workspace structure', () => {
  it('creates the bot server app status', () => {
    const config = loadConfig({
      PORT: '8787',
      NAPCAT_BASE_URL: 'http://127.0.0.1:3000',
      NAPCAT_ACCESS_TOKEN: 'token',
      ADMIN_TOKEN: 'admin-token',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
      REDIS_URL: 'redis://127.0.0.1:6379',
    });

    expect(createAppStatus(config)).toEqual({
      service: 'bot-server',
      ready: true,
      config: {
        provider: 'openai',
        llmTransportMode: 'heuristic',
        botName: 'momo',
        activeReplyEnabled: true,
        napcatBaseUrl: 'http://127.0.0.1:3000',
        port: 8787,
      },
    });
  });
});
