import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../packages/config/src/index.js';
import { createLogger } from '../packages/core/src/index.js';
import { createAppContext, createServer } from '../apps/bot-server/src/app.js';
import { createNapCatSender, handleNapCatWebhook, parseNapCatEvent } from '../apps/bot-server/src/napcat-adapter.js';

function createTestConfig() {
  return loadConfig({
    PORT: '3000',
    NAPCAT_BASE_URL: 'http://127.0.0.1:3001',
    NAPCAT_ACCESS_TOKEN: 'token',
    ADMIN_TOKEN: 'admin-token',
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
    REDIS_URL: 'redis://127.0.0.1:6379',
    BOT_NAME: 'momo',
  });
}

function createNapCatGroupPayload() {
  return {
    post_type: 'message',
    message_type: 'group',
    time: 1_712_000_000,
    self_id: 9001,
    message_id: 101,
    group_id: 202,
    user_id: 303,
    raw_message: '@momo 今晚来吗',
    sender: {
      nickname: 'Tester',
      card: '群名片Tester',
    },
    message: [
      {
        type: 'reply',
        data: {
          id: '99',
        },
      },
      {
        type: 'at',
        data: {
          qq: '9001',
        },
      },
      {
        type: 'text',
        data: {
          text: ' 今晚来吗',
        },
      },
    ],
  };
}

describe('NapCat event parsing', () => {
  it('converts a group message payload into a unified event', () => {
    const result = parseNapCatEvent(createNapCatGroupPayload());

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }

    expect(result.event).toMatchObject({
      platform: 'qq',
      messageId: '101',
      groupId: '202',
      userId: '303',
      nickname: '群名片Tester',
      content: '@momo 今晚来吗',
      mentions: [
        {
          type: 'platform_mention',
          targetId: '9001',
          isBot: true,
        },
      ],
      replyTo: {
        messageId: '99',
      },
    });
  });

  it('rejects unsupported NapCat payloads', () => {
    const result = parseNapCatEvent({
      post_type: 'notice',
      message_type: 'group',
    });

    expect(result).toMatchObject({
      accepted: false,
      reason: 'unsupported_post_type',
    });
  });
});

describe('NapCat webhook entrypoint', () => {
  it('accepts supported payloads and forwards the unified event', async () => {
    const receivedEvents: string[] = [];
    const config = createTestConfig();
    const server = createServer({
      ...createAppContext(config),
      onNapCatEvent: (event) => {
        receivedEvents.push(event.messageId);
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/adapters/napcat/events',
      payload: createNapCatGroupPayload(),
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      ok: true,
      accepted: true,
      event: {
        platform: 'qq',
        messageId: '101',
        groupId: '202',
        userId: '303',
      },
    });
    expect(receivedEvents).toEqual(['101']);

    await server.close();
  });

  it('returns accepted false for unsupported payloads', async () => {
    const server = createServer(createAppContext(createTestConfig()));

    const response = await server.inject({
      method: 'POST',
      url: '/adapters/napcat/events',
      payload: {
        post_type: 'notice',
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      ok: true,
      accepted: false,
      reason: 'unsupported_post_type',
    });

    await server.close();
  });
});

describe('NapCat sender', () => {
  it('returns a normalized send result and preserves reply metadata', async () => {
    const transport = vi.fn(async () => ({
      status: 'ok',
      retcode: 0,
      data: {
        message_id: 8080,
      },
    }));
    const sender = createNapCatSender(createTestConfig(), transport);

    const result = await sender.sendGroupMessage({
      groupId: '202',
      content: '来了',
      requestId: 'send-1',
      traceId: 'trace-1',
      replyToMessageId: '101',
      sentenceIndex: 0,
      sentenceCount: 1,
    });

    expect(transport).toHaveBeenCalledWith(
      '/send_group_msg',
      expect.objectContaining({
        body: {
          group_id: '202',
          message: [
            {
              type: 'reply',
              data: {
                id: '101',
              },
            },
            {
              type: 'text',
              data: {
                text: '来了',
              },
            },
          ],
        },
      }),
    );
    expect(result).toMatchObject({
      status: 'sent',
      platform: 'qq',
      requestId: 'send-1',
      traceId: 'trace-1',
      target: {
        platform: 'qq',
        groupId: '202',
        replyToMessageId: '101',
      },
      providerMessageId: '8080',
    });
  });

  it('can ignore unsupported payloads outside the HTTP layer', async () => {
    const logger = createLogger({
      level: 'info',
      service: 'bot-server',
    });

    const result = await handleNapCatWebhook({
      payload: {
        post_type: 'meta_event',
      },
      logger,
    });

    expect(result).toMatchObject({
      accepted: false,
      reason: 'unsupported_post_type',
    });
  });
});
