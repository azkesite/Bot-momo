import type { LlmRequest, LlmResponse } from './provider.js';

export type SummaryGeneratorInput = {
  provider: LlmProviderLike;
  providerName: LlmRequest['provider'];
  model: string;
  scope: 'group' | 'user';
  recentMessages: string[];
  existingSummary: string;
  timeoutMs: number;
};

export type SummaryGenerationResult = {
  text: string;
  source: 'llm' | 'fallback';
};

type LlmProviderLike = {
  generate: (request: LlmRequest) => Promise<LlmResponse>;
};

export async function generateSummary(input: SummaryGeneratorInput): Promise<SummaryGenerationResult> {
  const prompt = buildSummaryPrompt(input);

  try {
    const response = await input.provider.generate({
      provider: input.providerName,
      model: input.model,
      taskType: 'summary',
      prompt,
      timeoutMs: input.timeoutMs,
    });

    return {
      text: sanitizeSummaryText(response.outputText),
      source: 'llm',
    };
  } catch {
    return {
      text: buildFallbackSummary(input.recentMessages, input.existingSummary),
      source: 'fallback',
    };
  }
}

export function buildSummaryPrompt(input: Omit<SummaryGeneratorInput, 'provider' | 'providerName' | 'model' | 'timeoutMs'>): string {
  const messageBlock = input.recentMessages.length > 0 ? input.recentMessages.join('\n') : '无';
  const existingSummary = input.existingSummary.trim().length > 0 ? input.existingSummary : '无';

  return [
    `请为${input.scope === 'group' ? '群聊' : '用户互动'}生成简短中文摘要。`,
    `已有摘要：${existingSummary}`,
    `最近对话：${messageBlock}`,
    '要求：保留最近主要话题、语气自然、控制在 60 字以内，不要写成分析报告。',
  ].join('\n');
}

export function buildFallbackSummary(recentMessages: string[], existingSummary: string): string {
  const recentTopics = recentMessages
    .slice(-3)
    .map((message) => message.trim())
    .filter((message) => message.length > 0)
    .map((message) => truncateText(message, 18));

  if (recentTopics.length === 0) {
    return existingSummary.trim();
  }

  return `最近在聊：${recentTopics.join(' / ')}`.slice(0, 60);
}

function sanitizeSummaryText(text: string): string {
  return text.trim().replace(/\s+/gu, ' ').slice(0, 60);
}

function truncateText(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}
