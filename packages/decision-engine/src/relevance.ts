import type { UnifiedMessageEvent } from '@bot-momo/core';

export type BotIdentity = {
  botName: string;
  botAliases: string[];
};

export type RelevanceContext = {
  lastBotMessageId?: string;
  recentBotReplyMessageIds?: string[];
};

export type RelevanceReason =
  | 'mentioned'
  | 'bot_name'
  | 'bot_alias'
  | 'replied_to_bot'
  | 'continued_context'
  | 'not_relevant';

export type RelevanceResult = {
  related: boolean;
  reason: RelevanceReason;
  shouldReply: boolean;
  confidence: number;
};

const CONTINUATION_PATTERNS = [
  '你怎么看',
  '刚才问你',
  '你人呢',
  '你觉得呢',
  '你说呢',
  '刚刚那个',
  '刚才那个',
];

export function detectMessageRelevance(input: {
  event: UnifiedMessageEvent;
  identity: BotIdentity;
  context?: RelevanceContext;
}): RelevanceResult {
  if (input.event.mentions.some((mention) => mention.isBot === true)) {
    return {
      related: true,
      reason: 'mentioned',
      shouldReply: true,
      confidence: 1,
    };
  }

  if (isReplyToBot(input.event, input.context)) {
    return {
      related: true,
      reason: 'replied_to_bot',
      shouldReply: true,
      confidence: 0.98,
    };
  }

  const content = normalizeText(input.event.content);
  const botName = normalizeText(input.identity.botName);

  if (botName.length > 0 && content.includes(botName)) {
    return {
      related: true,
      reason: 'bot_name',
      shouldReply: true,
      confidence: 0.92,
    };
  }

  const matchedAlias = input.identity.botAliases.find((alias) => {
    const normalizedAlias = normalizeText(alias);
    return normalizedAlias.length > 0 && content.includes(normalizedAlias);
  });

  if (matchedAlias) {
    return {
      related: true,
      reason: 'bot_alias',
      shouldReply: true,
      confidence: 0.88,
    };
  }

  if (CONTINUATION_PATTERNS.some((pattern) => content.includes(normalizeText(pattern)))) {
    return {
      related: true,
      reason: 'continued_context',
      shouldReply: true,
      confidence: 0.72,
    };
  }

  return {
    related: false,
    reason: 'not_relevant',
    shouldReply: false,
    confidence: 0.1,
  };
}

function isReplyToBot(event: UnifiedMessageEvent, context?: RelevanceContext): boolean {
  if (event.replyTo?.isBot === true) {
    return true;
  }

  if (!event.replyTo) {
    return false;
  }

  if (context?.lastBotMessageId && event.replyTo.messageId === context.lastBotMessageId) {
    return true;
  }

  return context?.recentBotReplyMessageIds?.includes(event.replyTo.messageId) ?? false;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}
