import type { UnifiedMessageEvent } from '@bot-momo/core';

import { evaluateMentionMustReply, type ReplyDecisionResult } from './must-reply.js';
import { detectKeywordMatch, type KeywordRuleInput, type KeywordMatchResult } from './keyword-match.js';
import {
  detectMessageRelevance,
  type BotIdentity,
  type RelevanceContext,
  type RelevanceResult,
} from './relevance.js';

export type ActiveReplyContext = {
  enabled: boolean;
  baseProbability: number;
  randomValue?: number;
};

export type DecisionEngineInput = {
  event: UnifiedMessageEvent;
  identity: BotIdentity;
  relevanceContext?: RelevanceContext;
  keywordRules: KeywordRuleInput[];
  activeReply: ActiveReplyContext;
};

export type DecisionEngineOutput = ReplyDecisionResult & {
  relevance: RelevanceResult;
  keywordMatch: KeywordMatchResult;
};

export function decideReply(input: DecisionEngineInput): DecisionEngineOutput {
  const relevance = detectMessageRelevance({
    event: input.event,
    identity: input.identity,
    ...(input.relevanceContext ? { context: input.relevanceContext } : {}),
  });
  const keywordMatch = detectKeywordMatch({
    content: input.event.content,
    rules: input.keywordRules,
  });

  const mentionDecision = evaluateMentionMustReply({
    relevance,
    fallbackAction: relevance.shouldReply ? 'should_reply' : 'skip',
  });

  if (mentionDecision.action === 'must_reply') {
    return {
      ...mentionDecision,
      relevance,
      keywordMatch,
    };
  }

  if (keywordMatch.matched) {
    return {
      action: 'must_reply',
      reason: 'keyword_hit',
      confidence: 0.99,
      relevance,
      keywordMatch,
    };
  }

  if (relevance.shouldReply) {
    return {
      action: 'should_reply',
      reason: relevance.reason,
      confidence: relevance.confidence,
      relevance,
      keywordMatch,
    };
  }

  if (shouldActiveReply(input.activeReply)) {
    return {
      action: 'should_reply',
      reason: 'active_reply_candidate',
      confidence: input.activeReply.baseProbability,
      relevance,
      keywordMatch,
    };
  }

  return {
    action: 'skip',
    reason: 'not_relevant',
    confidence: relevance.confidence,
    relevance,
    keywordMatch,
  };
}

function shouldActiveReply(input: ActiveReplyContext): boolean {
  if (!input.enabled) {
    return false;
  }

  const randomValue = input.randomValue ?? Math.random();
  return randomValue < input.baseProbability;
}
