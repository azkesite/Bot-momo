import { describe, expect, it } from 'vitest';

import {
  parseUnifiedMessageEvent,
  parseUnifiedSendResult,
  type UnifiedMessageEvent,
} from '../packages/core/src/index.js';

describe('unified message event model', () => {
  it('accepts a complete normalized message event with mentions and reply metadata', () => {
    const event: UnifiedMessageEvent = {
      eventType: 'message.created',
      platform: 'qq',
      messageId: 'msg-100',
      groupId: 'group-200',
      userId: 'user-300',
      nickname: 'Tester',
      content: '@momo 今晚你来吗',
      timestamp: 1_712_000_000,
      mentions: [
        {
          type: 'platform_mention',
          targetId: 'bot-1',
          targetName: 'momo',
          text: '@momo',
          isBot: true,
        },
      ],
      replyTo: {
        messageId: 'msg-099',
        userId: 'bot-1',
        quotedText: '我晚点看',
        isBot: true,
      },
      rawPayload: {
        postType: 'message',
      },
    };

    const result = parseUnifiedMessageEvent(event);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toMatchObject({
      platform: 'qq',
      messageId: 'msg-100',
      groupId: 'group-200',
      userId: 'user-300',
      nickname: 'Tester',
      content: '@momo 今晚你来吗',
      mentions: [
        {
          type: 'platform_mention',
          targetId: 'bot-1',
          targetName: 'momo',
          text: '@momo',
          isBot: true,
        },
      ],
      replyTo: {
        messageId: 'msg-099',
        userId: 'bot-1',
        quotedText: '我晚点看',
        isBot: true,
      },
    });
  });

  it('rejects a message event when required fields are missing', () => {
    const result = parseUnifiedMessageEvent({
      eventType: 'message.created',
      platform: 'qq',
      groupId: 'group-200',
      userId: 'user-300',
      nickname: 'Tester',
      content: 'hello',
      timestamp: 1_712_000_000,
      rawPayload: {},
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.reason).toBe('schema_invalid');
    expect(result.error.issues).toContain('messageId');
  });

  it('rejects a message event when content becomes empty after trimming', () => {
    const result = parseUnifiedMessageEvent({
      eventType: 'message.created',
      platform: 'qq',
      messageId: 'msg-100',
      groupId: 'group-200',
      userId: 'user-300',
      nickname: 'Tester',
      content: '   ',
      timestamp: 1_712_000_000,
      rawPayload: {},
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues).toContain('content');
  });
});

describe('unified send result model', () => {
  it('accepts a normalized send result', () => {
    const result = parseUnifiedSendResult({
      status: 'sent',
      platform: 'qq',
      requestId: 'send-1',
      target: {
        platform: 'qq',
        groupId: 'group-200',
        userId: 'user-300',
        replyToMessageId: 'msg-100',
      },
      providerMessageId: 'qq-900',
      traceId: 'trace-1',
      sentenceIndex: 0,
      sentenceCount: 2,
      sentAt: 1_712_000_100,
      rawResponse: {
        message_id: 'qq-900',
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toMatchObject({
      status: 'sent',
      platform: 'qq',
      requestId: 'send-1',
      target: {
        groupId: 'group-200',
        userId: 'user-300',
        replyToMessageId: 'msg-100',
      },
      sentenceCount: 2,
    });
  });

  it('rejects an invalid send result target', () => {
    const result = parseUnifiedSendResult({
      status: 'failed',
      platform: 'qq',
      requestId: 'send-2',
      target: {
        platform: 'qq',
      },
      errorCode: 'NAPCAT_TIMEOUT',
      errorMessage: 'timeout',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues).toContain('target.groupId');
  });
});
