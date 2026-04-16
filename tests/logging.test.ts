import { describe, expect, it } from 'vitest';

import {
  createLogCapture,
  createLogger,
  createTraceContext,
  logMemoryWrite,
  logMessageReceived,
  logProcessingError,
  logReplyDecision,
  logSendTaskQueued,
} from '../packages/core/src/index.js';

describe('logging and traceability', () => {
  it('keeps the same trace identifier across a simulated processing flow', () => {
    const capture = createLogCapture();
    const logger = createLogger({
      level: 'info',
      service: 'bot-server',
      destination: capture.destination,
    });
    const trace = createTraceContext({
      messageId: 'msg-1',
      groupId: 'group-1',
      userId: 'user-1',
    });

    logMessageReceived(logger, {
      ...trace,
      platform: 'qq',
      contentPreview: '@momo 今晚有空吗',
    });
    logReplyDecision(logger, {
      ...trace,
      action: 'must_reply',
      reason: 'mentioned',
      confidence: 1,
    });
    logSendTaskQueued(logger, {
      ...trace,
      taskId: 'send-1',
      sentenceCount: 2,
      delayMs: 900,
    });
    logMemoryWrite(logger, {
      ...trace,
      memoryScope: 'summary',
      summary: 'User asked for availability tonight.',
    });

    const logs = capture.readLogs();

    expect(logs).toHaveLength(4);
    expect(logs.map((entry) => entry.traceId)).toEqual([
      trace.traceId,
      trace.traceId,
      trace.traceId,
      trace.traceId,
    ]);
    expect(logs[0]).toMatchObject({
      service: 'bot-server',
      event: 'message.received',
      messageId: 'msg-1',
      groupId: 'group-1',
      userId: 'user-1',
      platform: 'qq',
    });
    expect(logs[1]).toMatchObject({
      event: 'reply.decision',
      decision: 'must_reply',
      reason: 'mentioned',
    });
    expect(logs[2]).toMatchObject({
      event: 'send.task.queued',
      taskId: 'send-1',
      sentenceCount: 2,
      delayMs: 900,
    });
    expect(logs[3]).toMatchObject({
      event: 'memory.write',
      memoryScope: 'summary',
      summary: 'User asked for availability tonight.',
    });
  });

  it('records structured error logs with trace id and phase', () => {
    const capture = createLogCapture();
    const logger = createLogger({
      level: 'error',
      service: 'bot-server',
      destination: capture.destination,
    });
    const trace = createTraceContext({
      messageId: 'msg-2',
      groupId: 'group-2',
      userId: 'user-2',
    });

    logProcessingError(logger, {
      ...trace,
      phase: 'decision',
      err: new Error('Classifier timeout'),
    });

    const [entry] = capture.readLogs();

    expect(entry).toMatchObject({
      service: 'bot-server',
      event: 'processing.error',
      traceId: trace.traceId,
      phase: 'decision',
      messageId: 'msg-2',
      groupId: 'group-2',
      userId: 'user-2',
    });
    expect(entry.err).toMatchObject({
      type: 'Error',
      message: 'Classifier timeout',
    });
  });
});
