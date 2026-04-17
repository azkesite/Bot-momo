import { describe, expect, it, vi } from 'vitest';

import { createConfiguredLlmTransport } from '../packages/llm/src/index.js';

describe('llm transport factory', () => {
  it('sends openai-compatible requests for openai-like providers', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: '你好，这里是 DeepSeek。',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const transport = createConfiguredLlmTransport(
      {
        llmProviders: {
          openai: {
            apiKey: 'openai-key',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4.1-mini',
          },
          'claude-code': {
            apiKey: 'claude-key',
            baseUrl: 'https://api.anthropic.com',
            model: 'claude-sonnet-4-5',
            apiVersion: '2023-06-01',
          },
          glm: {
            apiKey: 'glm-key',
            baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
            model: 'glm-4.5',
          },
          deepseek: {
            apiKey: 'deepseek-key',
            baseUrl: 'https://api.deepseek.com/v1',
            model: 'deepseek-chat',
          },
          kimi: {
            apiKey: 'kimi-key',
            baseUrl: 'https://api.moonshot.cn/v1',
            model: 'kimi-latest',
          },
        },
      },
      fetchMock as typeof fetch,
    );

    const result = await transport(
      {
        provider: 'deepseek',
        model: 'deepseek-chat',
        taskType: 'reply',
        prompt: 'hello',
        timeoutMs: 500,
      },
      new AbortController().signal,
    );

    expect(result.outputText).toBe('你好，这里是 DeepSeek。');
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('chat/completions', 'https://api.deepseek.com/v1/'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer deepseek-key',
        }),
      }),
    );
  });

  it('sends anthropic messages requests for claude provider', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'text',
              text: '你好，这里是 Claude。',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const transport = createConfiguredLlmTransport(
      {
        llmProviders: {
          openai: {
            apiKey: 'openai-key',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4.1-mini',
          },
          'claude-code': {
            apiKey: 'claude-key',
            baseUrl: 'https://api.anthropic.com',
            model: 'claude-sonnet-4-5',
            apiVersion: '2023-06-01',
          },
          glm: {
            apiKey: 'glm-key',
            baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
            model: 'glm-4.5',
          },
          deepseek: {
            apiKey: 'deepseek-key',
            baseUrl: 'https://api.deepseek.com/v1',
            model: 'deepseek-chat',
          },
          kimi: {
            apiKey: 'kimi-key',
            baseUrl: 'https://api.moonshot.cn/v1',
            model: 'kimi-latest',
          },
        },
      },
      fetchMock as typeof fetch,
    );

    const result = await transport(
      {
        provider: 'claude-code',
        model: 'claude-sonnet-4-5',
        taskType: 'summary',
        prompt: 'summarize',
        timeoutMs: 500,
      },
      new AbortController().signal,
    );

    expect(result.outputText).toBe('你好，这里是 Claude。');
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('v1/messages', 'https://api.anthropic.com/'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'claude-key',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
  });
});
