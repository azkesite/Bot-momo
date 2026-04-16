import { describe, expect, it } from 'vitest';

import { evaluateMentionMustReply } from '../packages/decision-engine/src/index.js';

describe('@ must-reply rule', () => {
  it('forces must_reply when the relevance reason is mentioned', () => {
    const result = evaluateMentionMustReply({
      relevance: {
        related: true,
        reason: 'mentioned',
        shouldReply: true,
        confidence: 1,
      },
      fallbackAction: 'skip',
    });

    expect(result).toEqual({
      action: 'must_reply',
      reason: 'mentioned',
      confidence: 1,
    });
  });

  it('does not override non-mention relevance results', () => {
    const result = evaluateMentionMustReply({
      relevance: {
        related: true,
        reason: 'bot_name',
        shouldReply: true,
        confidence: 0.92,
      },
      fallbackAction: 'should_reply',
    });

    expect(result).toEqual({
      action: 'should_reply',
      reason: 'bot_name',
      confidence: 0.92,
    });
  });

  it('keeps skip when the message is not relevant', () => {
    const result = evaluateMentionMustReply({
      relevance: {
        related: false,
        reason: 'not_relevant',
        shouldReply: false,
        confidence: 0.1,
      },
    });

    expect(result).toEqual({
      action: 'skip',
      reason: 'not_relevant',
      confidence: 0.1,
    });
  });
});
