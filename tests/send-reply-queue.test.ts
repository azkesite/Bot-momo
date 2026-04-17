import { describe, expect, it, vi } from 'vitest';

import { createLogger, type RedisStateStore } from '@bot-momo/core';
import {
  createSendReplyJobProcessor,
  enqueueSendReplyTask,
  getDefaultSendReplyJobOptions,
  SEND_REPLY_JOB_NAME,
} from '../apps/bot-server/src/jobs/send-reply-queue.js';
import type { SendReplyTask } from '@bot-momo/sender';

describe('send reply queue', () => {
  it('enqueues reply tasks with a stable job id', async () => {
    const add = vi.fn(async () => ({}));
    const task = createTask();

    const result = await enqueueSendReplyTask({
      queue: { add },
      task,
    });

    expect(result).toEqual({
      mode: 'queued',
    });
    expect(add).toHaveBeenCalledWith(
      SEND_REPLY_JOB_NAME,
      task,
      expect.objectContaining({
        jobId: task.taskId,
      }),
    );
  });

  it('processes queued reply tasks and updates audit status', async () => {
    const sentMessages: string[] = [];
    const statuses: Array<{ status: 'queued' | 'sent' | 'failed'; attemptCount: number }> = [];
    const processor = createSendReplyJobProcessor({
      logger: createLogger({
        level: 'error',
        service: 'bot-server',
      }),
      stateStore: createInMemoryStateStore(),
      replyAuditStore: {
        async updateStatus(input) {
          statuses.push({
            status: input.status,
            attemptCount: input.attemptCount,
          });
        },
      },
      sendGroupMessage: async (input) => {
        sentMessages.push(input.content);
      },
    });

    const task = createTask();
    const result = await processor({
      data: task,
    } as never);

    expect(result).toEqual({
      sentCount: 2,
      skippedDuplicates: 0,
    });
    expect(sentMessages).toEqual(['第一句', '第二句']);
    expect(statuses.at(-1)).toEqual({
      status: 'sent',
      attemptCount: 2,
    });
  });

  it('uses exponential retry defaults', () => {
    expect(getDefaultSendReplyJobOptions()).toEqual({
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: false,
    });
  });
});

function createTask(): SendReplyTask {
  return {
    messageId: 'message-1',
    taskId: 'reply-log-1',
    groupId: 'group-1',
    traceId: 'trace-1',
    sentences: [
      {
        content: '第一句',
        sentenceIndex: 0,
        delayMs: 0,
      },
      {
        content: '第二句',
        sentenceIndex: 1,
        delayMs: 0,
      },
    ],
  };
}

function createInMemoryStateStore(): RedisStateStore {
  const textStore = new Map<string, string>();
  const jsonStore = new Map<string, unknown>();

  return {
    async getText(key) {
      return textStore.get(key) ?? null;
    },
    async setText(key, value) {
      textStore.set(key, value);
    },
    async getJson(key) {
      return jsonStore.get(key) ?? null;
    },
    async setJson(key, value) {
      jsonStore.set(key, value);
    },
    async deleteKey(key) {
      textStore.delete(key);
      jsonStore.delete(key);
    },
  };
}
