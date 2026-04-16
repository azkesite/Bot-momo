import { describe, expect, it } from 'vitest';

import type { UnifiedMessageEvent } from '../packages/core/src/index.js';
import { detectMessageRelevance } from '../packages/decision-engine/src/index.js';

function createBaseEvent(overrides: Partial<UnifiedMessageEvent> = {}): UnifiedMessageEvent {
  return {
    eventType: 'message.created',
    platform: 'qq',
    messageId: 'msg-1',
    groupId: 'group-1',
    userId: 'user-1',
    nickname: 'Tester',
    content: '普通消息',
    timestamp: 1_712_000_000,
    mentions: [],
    rawPayload: {
      source: 'test',
    },
    ...overrides,
  };
}

describe('message relevance detection', () => {
  it('marks platform mentions as related with the highest confidence', () => {
    const result = detectMessageRelevance({
      event: createBaseEvent({
        content: '@momo 今晚来吗',
        mentions: [
          {
            type: 'platform_mention',
            targetId: 'bot-1',
            text: '@momo',
            isBot: true,
          },
        ],
      }),
      identity: {
        botName: 'momo',
        botAliases: ['默默'],
      },
    });

    expect(result).toEqual({
      related: true,
      reason: 'mentioned',
      shouldReply: true,
      confidence: 1,
    });
  });

  it('marks replies to the bot as related even without a mention', () => {
    const result = detectMessageRelevance({
      event: createBaseEvent({
        content: '那你觉得呢',
        replyTo: {
          messageId: 'bot-msg-1',
          isBot: true,
        },
      }),
      identity: {
        botName: 'momo',
        botAliases: ['默默'],
      },
    });

    expect(result).toMatchObject({
      related: true,
      reason: 'replied_to_bot',
      shouldReply: true,
    });
  });

  it('marks bot names and aliases as related', () => {
    const byName = detectMessageRelevance({
      event: createBaseEvent({
        content: 'momo 今晚打不打',
      }),
      identity: {
        botName: 'momo',
        botAliases: ['默默'],
      },
    });
    const byAlias = detectMessageRelevance({
      event: createBaseEvent({
        content: '默默 你人呢',
      }),
      identity: {
        botName: 'momo',
        botAliases: ['默默'],
      },
    });

    expect(byName.reason).toBe('bot_name');
    expect(byAlias.reason).toBe('bot_alias');
    expect(byName.related).toBe(true);
    expect(byAlias.related).toBe(true);
  });

  it('marks continuation phrases as related when they look directed at the bot', () => {
    const result = detectMessageRelevance({
      event: createBaseEvent({
        content: '刚才问你那个你怎么看',
      }),
      identity: {
        botName: 'momo',
        botAliases: ['默默'],
      },
      context: {
        lastBotMessageId: 'bot-msg-2',
      },
    });

    expect(result).toMatchObject({
      related: true,
      reason: 'continued_context',
      shouldReply: true,
    });
  });

  it('keeps normal group chat messages as not relevant', () => {
    const result = detectMessageRelevance({
      event: createBaseEvent({
        content: '我先去吃饭了',
      }),
      identity: {
        botName: 'momo',
        botAliases: ['默默'],
      },
    });

    expect(result).toEqual({
      related: false,
      reason: 'not_relevant',
      shouldReply: false,
      confidence: 0.1,
    });
  });
});
