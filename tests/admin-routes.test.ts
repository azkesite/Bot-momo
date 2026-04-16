import { describe, expect, it } from 'vitest';

import { loadConfig } from '@bot-momo/config';
import { createAppContext, createServer } from '../apps/bot-server/src/app.js';

describe('admin routes', () => {
  const config = loadConfig({
    NAPCAT_BASE_URL: 'http://127.0.0.1:3001',
    NAPCAT_ACCESS_TOKEN: 'napcat-token',
    ADMIN_TOKEN: 'admin-token',
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
    REDIS_URL: 'redis://127.0.0.1:6379',
  });

  it('rejects unauthorized admin access', async () => {
    const app = createAppContext(config);
    const server = createServer(app);

    const response = await server.inject({
      method: 'GET',
      url: '/admin/keyword-rules',
    });

    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it('returns keyword rules and reply logs with valid token', async () => {
    const app = createAppContext(config);
    app.adminHandlers = {
      getHealth: () => ({ ok: true }),
      listKeywordRules: () => [{ id: 'rule-1', keyword: 'momo', matchType: 'exact' }],
      createKeywordRule: (body) => body,
      getUserMemory: () => ({ profile: { userId: 'qq:user:1' } }),
      listReplyLogs: () => [{ id: 'reply-1', status: 'sent' }],
    };
    const server = createServer(app);

    const [rulesResponse, logsResponse] = await Promise.all([
      server.inject({
        method: 'GET',
        url: '/admin/keyword-rules',
        headers: {
          'x-admin-token': 'admin-token',
        },
      }),
      server.inject({
        method: 'GET',
        url: '/admin/reply-logs',
        headers: {
          'x-admin-token': 'admin-token',
        },
      }),
    ]);

    expect(rulesResponse.statusCode).toBe(200);
    expect(rulesResponse.json().data).toHaveLength(1);
    expect(logsResponse.statusCode).toBe(200);
    expect(logsResponse.json().data[0].status).toBe('sent');
    await server.close();
  });
});
