import { describe, expect, it } from 'vitest';

import type { UnifiedMessageEvent } from '../packages/core/src/index.js';
import { decideReply } from '../packages/decision-engine/src/index.js';

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

describe('decision engine', () => {
  it('returns must_reply for platform mentions', () => {
    const result = decideReply({
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
      keywordRules: [],
      activeReply: {
        enabled: true,
        baseProbability: 0.15,
        randomValue: 0.99,
      },
    });

    expect(result.action).toBe('must_reply');
    expect(result.reason).toBe('mentioned');
  });

  it('returns must_reply for keyword hits even without a mention', () => {
    const result = decideReply({
      event: createBaseEvent({
        content: '今晚要不要开黑',
      }),
      identity: {
        botName: 'momo',
        botAliases: ['默默'],
      },
      keywordRules: [
        {
          id: 'rule-1',
          keyword: '开黑',
          matchType: 'exact',
          priority: 10,
          enabled: true,
          responseMode: 'must_reply',
        },
      ],
      activeReply: {
        enabled: true,
        baseProbability: 0.15,
        randomValue: 0.99,
      },
    });

    expect(result.action).toBe('must_reply');
    expect(result.reason).toBe('keyword_hit');
  });

  it('returns should_reply for relevant non-mandatory messages', () => {
    const result = decideReply({
      event: createBaseEvent({
        content: 'momo 你怎么看',
      }),
      identity: {
        botName: 'momo',
        botAliases: ['默默'],
      },
      keywordRules: [],
      activeReply: {
        enabled: true,
        baseProbability: 0.15,
        randomValue: 0.99,
      },
    });

    expect(result.action).toBe('should_reply');
    expect(result.reason).toBe('bot_name');
  });

  it('can produce an active reply candidate for otherwise unrelated messages', () => {
    const result = decideReply({
      event: createBaseEvent({
        content: '今晚有人打游戏吗',
      }),
      identity: {
        botName: 'momo',
        botAliases: ['默默'],
      },
      keywordRules: [],
      activeReply: {
        enabled: true,
        baseProbability: 0.2,
        randomValue: 0.1,
      },
    });

    expect(result.action).toBe('should_reply');
    expect(result.reason).toBe('active_reply_candidate');
  });

  it('skips unrelated messages when active reply does not trigger', () => {
    const result = decideReply({
      event: createBaseEvent({
        content: '我先去吃饭了',
      }),
      identity: {
        botName: 'momo',
        botAliases: ['默默'],
      },
      keywordRules: [],
      activeReply: {
        enabled: true,
        baseProbability: 0.2,
        randomValue: 0.8,
      },
    });

    expect(result.action).toBe('skip');
    expect(result.reason).toBe('not_relevant');
  });
});
