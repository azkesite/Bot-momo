import type { LlmRequest, LlmResponse } from './provider.js';

export type ReplyGeneratorInput = {
  provider: LlmProviderLike;
  providerName: LlmRequest['provider'];
  model: string;
  messageText: string;
  botName: string;
  decisionReason: string;
  shortContext: string[];
  memorySummary: string;
  timeoutMs: number;
};

export type ReplyGenerationResult = {
  text: string;
  source: 'llm' | 'fallback';
};

type LlmProviderLike = {
  generate: (request: LlmRequest) => Promise<LlmResponse>;
};

export async function generateReply(input: ReplyGeneratorInput): Promise<ReplyGenerationResult> {
  const prompt = buildReplyPrompt(input);

  try {
    const response = await input.provider.generate({
      provider: input.providerName,
      model: input.model,
      taskType: 'reply',
      prompt,
      timeoutMs: input.timeoutMs,
    });

    return {
      text: sanitizeReplyText(response.outputText),
      source: 'llm',
    };
  } catch {
    return {
      text: buildFallbackReply(input),
      source: 'fallback',
    };
  }
}

export function buildReplyPrompt(input: Omit<ReplyGeneratorInput, 'provider' | 'providerName' | 'model' | 'timeoutMs'>): string {
  const contextBlock = input.shortContext.length > 0 ? input.shortContext.join('\n') : '无';
  const memoryBlock = input.memorySummary.trim().length > 0 ? input.memorySummary : '无';

  return [
    `你是群聊机器人 ${input.botName}。`,
    '请生成一条自然、口语化、不要太长的中文回复。',
    `当前消息：${input.messageText}`,
    `决策原因：${input.decisionReason}`,
    `最近上下文：${contextBlock}`,
    `用户记忆摘要：${memoryBlock}`,
    '要求：像群友一样说话，不要写成长段客服回复。',
  ].join('\n');
}

export function buildFallbackReply(input: Pick<ReplyGeneratorInput, 'messageText' | 'decisionReason'>): string {
  if (input.decisionReason === 'mentioned') {
    return '我在，刚看到。';
  }

  if (input.decisionReason === 'keyword_hit') {
    return '这话题我能接一下。';
  }

  if (input.messageText.includes('?') || input.messageText.includes('？')) {
    return '我先想一下，感觉可以。';
  }

  return '行，我接上这个话题。';
}

function sanitizeReplyText(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}
