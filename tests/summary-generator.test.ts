import { describe, expect, it } from 'vitest';

import { buildFallbackSummary, generateSummary } from '@bot-momo/llm';

describe('summary generator', () => {
  it('returns llm summary when provider succeeds', async () => {
    const result = await generateSummary({
      provider: {
        generate: async () => ({
          provider: 'openai',
          model: 'summary-model',
          outputText: '最近在聊周末开黑和奶茶。',
          finishReason: 'stop',
        }),
      },
      providerName: 'openai',
      model: 'summary-model',
      scope: 'group',
      recentMessages: ['阿明: 周末开黑吗', 'momo: 可以啊', '小雨: 顺便点奶茶'],
      existingSummary: '',
      timeoutMs: 500,
    });

    expect(result).toEqual({
      text: '最近在聊周末开黑和奶茶。',
      source: 'llm',
    });
  });

  it('falls back to rule summary when provider fails', async () => {
    const result = await generateSummary({
      provider: {
        generate: async () => {
          throw new Error('upstream failed');
        },
      },
      providerName: 'openai',
      model: 'summary-model',
      scope: 'user',
      recentMessages: ['阿明: 我最喜欢抹茶', 'momo: 记住了'],
      existingSummary: '',
      timeoutMs: 500,
    });

    expect(result.source).toBe('fallback');
    expect(result.text).toContain('最近在聊');
  });

  it('builds a stable fallback summary from recent messages', () => {
    expect(buildFallbackSummary(['阿明: 周末开黑吗', 'momo: 可以', '小雨: 记得带耳机'], '')).toContain(
      '最近在聊',
    );
  });
});
