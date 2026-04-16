import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';

import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';

export const CORE_PACKAGE_NAME = '@bot-momo/core';

export * from './redis.js';

export type TraceContext = {
  traceId: string;
  messageId?: string;
  groupId?: string;
  userId?: string;
};

export type DecisionLogInput = TraceContext & {
  action: 'must_reply' | 'should_reply' | 'skip' | 'delay_reply';
  reason: string;
  confidence?: number;
};

export type SendTaskLogInput = TraceContext & {
  taskId: string;
  sentenceCount: number;
  delayMs?: number;
};

export type MemoryWriteLogInput = TraceContext & {
  memoryScope: 'short_term' | 'mid_term' | 'long_term' | 'summary';
  summary: string;
};

export type MessageReceivedLogInput = TraceContext & {
  platform: string;
  contentPreview: string;
};

export type ProcessingErrorLogInput = TraceContext & {
  phase: 'receive' | 'decision' | 'send' | 'memory' | 'startup' | 'unknown';
  err: Error;
};

export type CapturedLog = Record<string, unknown>;

export function createTraceContext(context: Omit<TraceContext, 'traceId'> & { traceId?: string } = {}): TraceContext {
  const traceContext: TraceContext = {
    traceId: context.traceId ?? randomUUID(),
  };

  if (context.messageId !== undefined) {
    traceContext.messageId = context.messageId;
  }

  if (context.groupId !== undefined) {
    traceContext.groupId = context.groupId;
  }

  if (context.userId !== undefined) {
    traceContext.userId = context.userId;
  }

  return traceContext;
}

export function createLogger(
  options: {
    level: NonNullable<LoggerOptions['level']>;
    service: string;
    destination?: DestinationStream;
  },
): Logger {
  return pino(
    {
      level: options.level,
      base: {
        service: options.service,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    options.destination,
  );
}

export function createTraceLogger(logger: Logger, context: TraceContext): Logger {
  return logger.child(context);
}

export function logMessageReceived(logger: Logger, input: MessageReceivedLogInput): void {
  createTraceLogger(logger, input).info(
    {
      event: 'message.received',
      platform: input.platform,
      contentPreview: input.contentPreview,
    },
    'Received message',
  );
}

export function logReplyDecision(logger: Logger, input: DecisionLogInput): void {
  createTraceLogger(logger, input).info(
    {
      event: 'reply.decision',
      decision: input.action,
      reason: input.reason,
      confidence: input.confidence,
    },
    'Computed reply decision',
  );
}

export function logSendTaskQueued(logger: Logger, input: SendTaskLogInput): void {
  createTraceLogger(logger, input).info(
    {
      event: 'send.task.queued',
      taskId: input.taskId,
      sentenceCount: input.sentenceCount,
      delayMs: input.delayMs,
    },
    'Queued send task',
  );
}

export function logMemoryWrite(logger: Logger, input: MemoryWriteLogInput): void {
  createTraceLogger(logger, input).info(
    {
      event: 'memory.write',
      memoryScope: input.memoryScope,
      summary: input.summary,
    },
    'Persisted memory write',
  );
}

export function logProcessingError(logger: Logger, input: ProcessingErrorLogInput): void {
  createTraceLogger(logger, input).error(
    {
      event: 'processing.error',
      phase: input.phase,
      err: input.err,
    },
    'Processing failed',
  );
}

export function createLogCapture(): {
  destination: DestinationStream;
  readLogs: () => CapturedLog[];
} {
  const stream = new PassThrough();
  const chunks: string[] = [];

  stream.on('data', (chunk) => {
    chunks.push(chunk.toString());
  });

  return {
    destination: stream,
    readLogs: () =>
      chunks
        .join('')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as CapturedLog),
  };
}
