import { describe, expect, it } from 'vitest';

import { LlmProviderError, createLlmProvider } from '../packages/llm/src/index.js';

describe('llm provider abstraction', () => {
  it('returns successful responses through the unified provider interface', async () => {
    const provider = createLlmProvider(async (request) => ({
      provider: request.provider,
      model: request.model,
      outputText: '好的，我来看看',
      finishReason: 'stop',
    }));

    const result = await provider.generate({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      taskType: 'reply',
      prompt: 'say hi',
      timeoutMs: 50,
    });

    expect(result).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      outputText: '好的，我来看看',
      finishReason: 'stop',
    });
  });

  it('wraps timeout failures into a unified timeout error', async () => {
    const provider = createLlmProvider(
      (_request, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    await expect(
      provider.generate({
        provider: 'deepseek',
        model: 'deepseek-chat',
        taskType: 'summary',
        prompt: 'summarize',
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({
      name: 'LlmProviderError',
      provider: 'deepseek',
      code: 'timeout',
    } satisfies Partial<LlmProviderError>);
  });

  it('wraps upstream failures and rejects empty output', async () => {
    const upstreamFailureProvider = createLlmProvider(async () => {
      throw new Error('503 upstream');
    });

    await expect(
      upstreamFailureProvider.generate({
        provider: 'kimi',
        model: 'kimi-latest',
        taskType: 'reply',
        prompt: 'hello',
        timeoutMs: 50,
      }),
    ).rejects.toMatchObject({
      name: 'LlmProviderError',
      provider: 'kimi',
      code: 'upstream_failure',
    } satisfies Partial<LlmProviderError>);

    const emptyOutputProvider = createLlmProvider(async (request) => ({
      provider: request.provider,
      model: request.model,
      outputText: '   ',
      finishReason: 'stop',
    }));

    await expect(
      emptyOutputProvider.generate({
        provider: 'glm',
        model: 'glm-4',
        taskType: 'memory',
        prompt: 'extract facts',
        timeoutMs: 50,
      }),
    ).rejects.toMatchObject({
      name: 'LlmProviderError',
      provider: 'glm',
      code: 'invalid_output',
    } satisfies Partial<LlmProviderError>);
  });
});
