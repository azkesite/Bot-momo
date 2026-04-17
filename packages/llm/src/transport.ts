import type { AppConfig } from '@bot-momo/config';

import type { LlmRequest, LlmResponse, LlmTransport, SupportedProvider } from './provider.js';

type FetchLike = typeof fetch;

type RemoteProviderConfig = AppConfig['llmProviders'][SupportedProvider];

type OpenAiCompatibleResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

type AnthropicResponse = {
  stop_reason?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

const ANTHROPIC_PROVIDER: SupportedProvider = 'claude-code';

export function createConfiguredLlmTransport(
  config: Pick<AppConfig, 'llmProviders'>,
  fetchImpl: FetchLike = fetch,
): LlmTransport {
  return async (request, signal) => {
    const providerConfig = config.llmProviders[request.provider];

    if (request.provider === ANTHROPIC_PROVIDER) {
      return sendAnthropicRequest(request, providerConfig, fetchImpl, signal);
    }

    return sendOpenAiCompatibleRequest(request, providerConfig, fetchImpl, signal);
  };
}

export async function sendOpenAiCompatibleRequest(
  request: LlmRequest,
  providerConfig: RemoteProviderConfig,
  fetchImpl: FetchLike,
  signal: AbortSignal,
): Promise<LlmResponse> {
  const response = await fetchImpl(buildOpenAiCompatibleUrl(providerConfig.baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${providerConfig.apiKey ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      messages: [
        {
          role: 'user',
          content: request.prompt,
        },
      ],
    }),
    signal,
  });

  const payload = (await response.json()) as OpenAiCompatibleResponse;

  if (!response.ok) {
    throw new Error(`OpenAI-compatible request failed with status ${response.status}.`);
  }

  const firstChoice = payload.choices?.[0];
  const outputText = extractOpenAiCompatibleText(firstChoice?.message?.content);

  return {
    provider: request.provider,
    model: request.model,
    outputText,
    finishReason: normalizeFinishReason(firstChoice?.finish_reason),
  };
}

export async function sendAnthropicRequest(
  request: LlmRequest,
  providerConfig: RemoteProviderConfig,
  fetchImpl: FetchLike,
  signal: AbortSignal,
): Promise<LlmResponse> {
  const response = await fetchImpl(buildAnthropicUrl(providerConfig.baseUrl), {
    method: 'POST',
    headers: {
      'x-api-key': providerConfig.apiKey ?? '',
      'anthropic-version': providerConfig.apiVersion ?? '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: request.prompt,
        },
      ],
    }),
    signal,
  });

  const payload = (await response.json()) as AnthropicResponse;

  if (!response.ok) {
    throw new Error(`Anthropic request failed with status ${response.status}.`);
  }

  return {
    provider: request.provider,
    model: request.model,
    outputText: extractAnthropicText(payload.content),
    finishReason: normalizeFinishReason(payload.stop_reason),
  };
}

function buildOpenAiCompatibleUrl(baseUrl: string): URL {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return new URL('chat/completions', normalizedBaseUrl);
}

function buildAnthropicUrl(baseUrl: string): URL {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return new URL('v1/messages', normalizedBaseUrl);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function extractOpenAiCompatibleText(
  content: string | Array<{ type?: string; text?: string }> | undefined,
): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => (part.type === 'text' ? part.text ?? '' : ''))
    .join(' ')
    .trim();
}

function extractAnthropicText(content: AnthropicResponse['content']): string {
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => (part.type === 'text' ? part.text ?? '' : ''))
    .join(' ')
    .trim();
}

function normalizeFinishReason(
  finishReason: string | undefined,
): 'stop' | 'length' | 'error' {
  if (finishReason === 'length' || finishReason === 'max_tokens') {
    return 'length';
  }

  if (!finishReason || finishReason === 'stop' || finishReason === 'end_turn') {
    return 'stop';
  }

  return 'error';
}
