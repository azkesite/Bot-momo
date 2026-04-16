export type SupportedProvider = 'openai' | 'claude-code' | 'glm' | 'deepseek' | 'kimi';

export type LlmTaskType = 'reply' | 'summary' | 'memory';

export type LlmRequest = {
  provider: SupportedProvider;
  model: string;
  taskType: LlmTaskType;
  prompt: string;
  timeoutMs: number;
};

export type LlmResponse = {
  provider: SupportedProvider;
  model: string;
  outputText: string;
  finishReason: 'stop' | 'length' | 'error';
};

export type LlmTransport = (request: LlmRequest, signal: AbortSignal) => Promise<LlmResponse>;

export class LlmProviderError extends Error {
  readonly code: 'timeout' | 'upstream_failure' | 'invalid_output';
  readonly provider: SupportedProvider;

  constructor(input: {
    provider: SupportedProvider;
    code: 'timeout' | 'upstream_failure' | 'invalid_output';
    message: string;
  }) {
    super(input.message);
    this.name = 'LlmProviderError';
    this.provider = input.provider;
    this.code = input.code;
  }
}

export function createLlmProvider(transport: LlmTransport) {
  return {
    async generate(request: LlmRequest): Promise<LlmResponse> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs);

      try {
        const response = await transport(request, controller.signal);

        if (response.outputText.trim().length === 0) {
          throw new LlmProviderError({
            provider: request.provider,
            code: 'invalid_output',
            message: 'LLM output was empty.',
          });
        }

        return response;
      } catch (error) {
        if (error instanceof LlmProviderError) {
          throw error;
        }

        if (controller.signal.aborted) {
          throw new LlmProviderError({
            provider: request.provider,
            code: 'timeout',
            message: `LLM request timed out after ${request.timeoutMs}ms.`,
          });
        }

        throw new LlmProviderError({
          provider: request.provider,
          code: 'upstream_failure',
          message: error instanceof Error ? error.message : 'Unknown LLM upstream failure.',
        });
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}
