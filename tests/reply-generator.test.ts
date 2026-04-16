import { describe, expect, it } from 'vitest';

import { buildReplyPrompt, generateReply } from '../packages/llm/src/index.js';

describe('reply generator', () => {
  it('builds a prompt with message, context, memory and decision reason', () => {
    const prompt = buildReplyPrompt({
      botName: 'momo',
      messageText: '今晚来吗',
      decisionReason: 'mentioned',
      shortContext: ['A: 今晚有人吗', 'B: 在'],
      memorySummary: '这个用户喜欢开黑',
    });

    expect(prompt).toContain('你是群聊机器人 momo');
    expect(prompt).toContain('当前消息：今晚来吗');
    expect(prompt).toContain('决策原因：mentioned');
    expect(prompt).toContain('这个用户喜欢开黑');
  });

  it('returns llm output when the provider succeeds', async () => {
    const result = await generateReply({
      provider: {
        generate: async (request) => ({
          provider: request.provider,
          model: request.model,
          outputText: ' 可以啊，我晚上在。 ',
          finishReason: 'stop',
        }),
      },
      providerName: 'openai',
      model: 'gpt-4.1-mini',
      messageText: '今晚来吗',
      botName: 'momo',
      decisionReason: 'mentioned',
      shortContext: [],
      memorySummary: '',
      timeoutMs: 100,
    });

    expect(result).toEqual({
      text: '可以啊，我晚上在。',
      source: 'llm',
    });
  });

  it('falls back to a short reply when the provider fails', async () => {
    const result = await generateReply({
      provider: {
        generate: async () => {
          throw new Error('upstream');
        },
      },
      providerName: 'deepseek',
      model: 'deepseek-chat',
      messageText: '今晚来吗？',
      botName: 'momo',
      decisionReason: 'mentioned',
      shortContext: [],
      memorySummary: '',
      timeoutMs: 100,
    });

    expect(result.source).toBe('fallback');
    expect(result.text.length).toBeGreaterThan(0);
  });
});
