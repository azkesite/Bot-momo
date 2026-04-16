import type { AppConfig } from '@bot-momo/config';
import type { Logger } from 'pino';
import {
  createTraceContext,
  logMessageReceived,
  parseUnifiedMessageEvent,
  parseUnifiedSendResult,
  type TraceContext,
  type UnifiedMessageEvent,
  type UnifiedSendResult,
} from '@bot-momo/core';

type NapCatMessageSegment = {
  type?: string;
  data?: Record<string, unknown>;
};

type NapCatSender = {
  nickname?: unknown;
  card?: unknown;
};

type NapCatGroupMessagePayload = {
  post_type?: unknown;
  message_type?: unknown;
  sub_type?: unknown;
  time?: unknown;
  self_id?: unknown;
  user_id?: unknown;
  group_id?: unknown;
  message_id?: unknown;
  raw_message?: unknown;
  message?: unknown;
  sender?: unknown;
};

export type UnsupportedNapCatPayload = {
  accepted: false;
  reason:
    | 'unsupported_post_type'
    | 'unsupported_message_type'
    | 'invalid_payload'
    | 'invalid_unified_event';
  details?: string[];
};

export type AcceptedNapCatPayload = {
  accepted: true;
  event: UnifiedMessageEvent;
};

export type ParseNapCatEventResult = AcceptedNapCatPayload | UnsupportedNapCatPayload;

export type NapCatEventHandler = (event: UnifiedMessageEvent, context: TraceContext) => Promise<void> | void;

export type NapCatWebhookResult =
  | {
      accepted: true;
      traceId: string;
      event: UnifiedMessageEvent;
    }
  | {
      accepted: false;
      traceId: string;
      reason: UnsupportedNapCatPayload['reason'];
      details?: string[];
    };

export type NapCatTransport = (
  path: string,
  input: {
    headers: Record<string, string>;
    body: Record<string, unknown>;
  },
) => Promise<unknown>;

export type NapCatSendGroupMessageInput = {
  groupId: string;
  content: string;
  requestId: string;
  replyToMessageId?: string;
  traceId?: string;
  sentenceIndex?: number;
  sentenceCount?: number;
};

export function parseNapCatEvent(payload: unknown): ParseNapCatEventResult {
  if (!isRecord(payload)) {
    return {
      accepted: false,
      reason: 'invalid_payload',
      details: ['payload'],
    };
  }

  const candidate = payload as NapCatGroupMessagePayload;

  if (candidate.post_type !== 'message') {
    return {
      accepted: false,
      reason: 'unsupported_post_type',
      details: ['post_type'],
    };
  }

  if (candidate.message_type !== 'group') {
    return {
      accepted: false,
      reason: 'unsupported_message_type',
      details: ['message_type'],
    };
  }

  const messageSegments = normalizeSegments(candidate.message);
  const sender = normalizeSender(candidate.sender);
  const replySegment = messageSegments.find((segment) => segment.type === 'reply');
  const mentions = messageSegments
    .filter((segment) => segment.type === 'at')
    .map((segment) => {
      const targetId = asNonEmptyString(segment.data?.qq);
      const targetName = targetId === asNonEmptyString(candidate.self_id) ? 'bot' : undefined;

      return {
        type: 'platform_mention' as const,
        targetId,
        targetName,
        text: targetId ? `@${targetId}` : '@unknown',
        isBot: targetId === asNonEmptyString(candidate.self_id),
      };
    });

  const parsed = parseUnifiedMessageEvent({
    eventType: 'message.created',
    platform: 'qq',
    messageId: stringifyRequired(candidate.message_id),
    groupId: stringifyRequired(candidate.group_id),
    userId: stringifyRequired(candidate.user_id),
    nickname: sender.card ?? sender.nickname ?? stringifyRequired(candidate.user_id),
    content: asNonEmptyString(candidate.raw_message) ?? joinTextSegments(messageSegments),
    timestamp: normalizeTimestamp(candidate.time),
    mentions,
    replyTo: replySegment
      ? {
          messageId: stringifyRequired(replySegment.data?.id),
          isBot: false,
        }
      : undefined,
    rawPayload: payload,
  });

  if (!parsed.success) {
    return {
      accepted: false,
      reason: 'invalid_unified_event',
      details: parsed.error.issues,
    };
  }

  return {
    accepted: true,
    event: parsed.data,
  };
}

export async function handleNapCatWebhook(input: {
  payload: unknown;
  logger: Logger;
  onEvent?: NapCatEventHandler;
}): Promise<NapCatWebhookResult> {
  const parsed = parseNapCatEvent(input.payload);
  const trace = createTraceContext(
    parsed.accepted
      ? {
          messageId: parsed.event.messageId,
          groupId: parsed.event.groupId,
          userId: parsed.event.userId,
        }
      : {},
  );

  if (!parsed.accepted) {
    const ignoredResult: NapCatWebhookResult = {
      accepted: false,
      traceId: trace.traceId,
      reason: parsed.reason,
    };

    if (parsed.details) {
      ignoredResult.details = parsed.details;
    }

    input.logger.warn(
      {
        event: 'napcat.event.ignored',
        traceId: trace.traceId,
        reason: parsed.reason,
        details: parsed.details,
      },
      'Ignored unsupported NapCat payload',
    );

    return ignoredResult;
  }

  logMessageReceived(input.logger, {
    ...trace,
    messageId: parsed.event.messageId,
    groupId: parsed.event.groupId,
    userId: parsed.event.userId,
    platform: parsed.event.platform,
    contentPreview: parsed.event.content.slice(0, 80),
  });

  if (input.onEvent) {
    await input.onEvent(parsed.event, trace);
  }

  return {
    accepted: true,
    traceId: trace.traceId,
    event: parsed.event,
  };
}

export function createNapCatSender(
  config: Pick<AppConfig, 'napcatAccessToken' | 'napcatBaseUrl'>,
  transport: NapCatTransport = createFetchTransport(config),
) {
  return {
    async sendGroupMessage(input: NapCatSendGroupMessageInput): Promise<UnifiedSendResult> {
      const response = await transport('/send_group_msg', {
        headers: {
          Authorization: `Bearer ${config.napcatAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: {
          group_id: input.groupId,
          message: buildNapCatMessage(input),
        },
      });

      const responseRecord = isRecord(response) ? response : {};
      const responseData = isRecord(responseRecord.data) ? responseRecord.data : {};
      const status =
        responseRecord.status === 'ok' || responseRecord.retcode === 0 ? 'sent' : 'failed';

      const parsed = parseUnifiedSendResult({
        status,
        platform: 'qq',
        requestId: input.requestId,
        traceId: input.traceId,
        sentenceIndex: input.sentenceIndex,
        sentenceCount: input.sentenceCount,
        sentAt: Date.now(),
        target: {
          platform: 'qq',
          groupId: input.groupId,
          replyToMessageId: input.replyToMessageId,
        },
        providerMessageId: asNonEmptyString(responseData.message_id),
        errorCode: status === 'failed' ? 'NAPCAT_SEND_FAILED' : undefined,
        errorMessage:
          status === 'failed' ? asNonEmptyString(responseRecord.wording) ?? 'NapCat send failed' : undefined,
        rawResponse: response,
      });

      if (!parsed.success) {
        throw new Error(`Invalid NapCat send result: ${parsed.error.issues.join(', ')}`);
      }

      return parsed.data;
    },
  };
}

function createFetchTransport(
  config: Pick<AppConfig, 'napcatBaseUrl'>,
): NapCatTransport {
  return async (path, input) => {
    const response = await fetch(new URL(path, normalizeBaseUrl(config.napcatBaseUrl)), {
      method: 'POST',
      headers: input.headers,
      body: JSON.stringify(input.body),
    });

    return response.json();
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function buildNapCatMessage(input: NapCatSendGroupMessageInput): Array<Record<string, unknown>> {
  const segments: Array<Record<string, unknown>> = [];

  if (input.replyToMessageId) {
    segments.push({
      type: 'reply',
      data: {
        id: input.replyToMessageId,
      },
    });
  }

  segments.push({
    type: 'text',
    data: {
      text: input.content,
    },
  });

  return segments;
}

function normalizeSegments(message: unknown): NapCatMessageSegment[] {
  if (!Array.isArray(message)) {
    return [];
  }

  return message.filter(isRecord).map((segment) => {
    const normalized: NapCatMessageSegment = {
      data: isRecord(segment.data) ? segment.data : {},
    };
    const type = asNonEmptyString(segment.type);

    if (type) {
      normalized.type = type;
    }

    return normalized;
  });
}

function normalizeSender(sender: unknown): { nickname?: string; card?: string } {
  if (!isRecord(sender)) {
    return {};
  }

  const normalizedSender = sender as NapCatSender;

  const normalized: { nickname?: string; card?: string } = {};
  const nickname = asNonEmptyString(normalizedSender.nickname);
  const card = asNonEmptyString(normalizedSender.card);

  if (nickname) {
    normalized.nickname = nickname;
  }

  if (card) {
    normalized.card = card;
  }

  return normalized;
}

function joinTextSegments(segments: NapCatMessageSegment[]): string {
  return segments
    .filter((segment) => segment.type === 'text')
    .map((segment) => asNonEmptyString(segment.data?.text))
    .filter((text): text is string => text !== undefined)
    .join('')
    .trim();
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function stringifyRequired(value: unknown): string {
  const normalized = asNonEmptyString(value);

  if (normalized) {
    return normalized;
  }

  return String(value ?? '');
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
