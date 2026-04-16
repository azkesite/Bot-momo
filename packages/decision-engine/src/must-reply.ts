import type { RelevanceResult } from './relevance.js';

export type ReplyDecisionAction = 'must_reply' | 'should_reply' | 'skip' | 'delay_reply';

export type ReplyDecisionResult = {
  action: ReplyDecisionAction;
  reason: string;
  confidence: number;
};

export function evaluateMentionMustReply(input: {
  relevance: RelevanceResult;
  fallbackAction?: Exclude<ReplyDecisionAction, 'must_reply'>;
}): ReplyDecisionResult {
  if (input.relevance.reason === 'mentioned') {
    return {
      action: 'must_reply',
      reason: 'mentioned',
      confidence: 1,
    };
  }

  return {
    action: input.fallbackAction ?? 'skip',
    reason: input.relevance.reason,
    confidence: input.relevance.confidence,
  };
}
