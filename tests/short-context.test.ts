import { describe, expect, it } from 'vitest';

import type { RedisTtlPolicy, UnifiedMessageEvent } from '../packages/core/src/index.js';
import {
  createGroupContextKey,
  createShortContextMessage,
  createShortContextStore,
  createUserContextKey,
} from '../packages/memory/src/index.js';

class InMemoryJsonStore {
  private readonly values = new Map<string, string>();

  async getJson<T>(key: string): Promise<T | null> {
    const raw = this.values.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson<T>(key: string, value: T, _ttlPolicy?: RedisTtlPolicy): Promise<void> {
    this.values.set(key, JSON.stringify(value));
  }
}

function createEvent(overrides: Partial<UnifiedMessageEvent> = {}): UnifiedMessageEvent {
  return {
    eventType: 'message.created',
    platform: 'qq',
    messageId: 'msg-1',
    groupId: 'group-1',
    userId: 'user-1',
    nickname: 'Tester',
    content: 'hello',
    timestamp: 1_712_000_000,
    mentions: [],
    rawPayload: {},
    ...overrides,
  };
}

describe('short context store', () => {
  it('appends group context and trims older records when the window exceeds the limit', async () => {
    const store = createShortContextStore(new InMemoryJsonStore());

    await store.appendGroupMessage('group-1', createShortContextMessage(createEvent({ messageId: '1' })), 2);
    await store.appendGroupMessage('group-1', createShortContextMessage(createEvent({ messageId: '2' })), 2);
    const result = await store.appendGroupMessage(
      'group-1',
      createShortContextMessage(createEvent({ messageId: '3' })),
      2,
    );

    expect(result.map((item) => item.messageId)).toEqual(['2', '3']);
    expect(createGroupContextKey('group-1')).toBe('bot-momo:context:group:group-1');
  });

  it('keeps user context isolated per group and user', async () => {
    const store = createShortContextStore(new InMemoryJsonStore());

    await store.appendUserMessage(
      'group-1',
      'user-1',
      createShortContextMessage(createEvent({ messageId: '1', userId: 'user-1' })),
    );
    await store.appendUserMessage(
      'group-2',
      'user-1',
      createShortContextMessage(createEvent({ messageId: '2', groupId: 'group-2', userId: 'user-1' })),
    );

    expect((await store.getUserMessages('group-1', 'user-1')).map((item) => item.messageId)).toEqual(['1']);
    expect((await store.getUserMessages('group-2', 'user-1')).map((item) => item.messageId)).toEqual(['2']);
    expect(createUserContextKey('group-1', 'user-1')).toBe('bot-momo:context:group-user:group-1:user-1');
  });

  it('maps unified events into short-context messages with mention flags', () => {
    const message = createShortContextMessage(
      createEvent({
        messageId: 'msg-1',
        mentions: [
          {
            type: 'platform_mention',
            targetId: 'bot-1',
            text: '@momo',
            isBot: true,
          },
        ],
      }),
    );

    expect(message).toEqual({
      messageId: 'msg-1',
      userId: 'user-1',
      nickname: 'Tester',
      content: 'hello',
      timestamp: 1_712_000_000,
      mentionedBot: true,
    });
  });
});
