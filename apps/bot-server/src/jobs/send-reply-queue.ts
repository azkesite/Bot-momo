import { Queue, Worker, type JobsOptions, type Processor } from 'bullmq';
import {
  createRedisConnectionOptions,
  logProcessingError,
  type RedisStateStore,
} from '@bot-momo/core';
import { dispatchReplyTask, type SendReplyTask } from '@bot-momo/sender';
import type { Logger } from 'pino';

export const SEND_REPLY_QUEUE_NAME = 'send-reply';
export const SEND_REPLY_JOB_NAME = 'send-reply-job';

export type SendReplyScheduleResult =
  | {
      mode: 'queued';
    }
  | {
      mode: 'sent';
      sentCount: number;
    };

export type ReplyAuditStore = {
  updateStatus: (input: {
    replyLogId: string;
    status: 'queued' | 'sent' | 'failed';
    attemptCount: number;
    contentPreview?: string;
    sentAt?: Date;
  }) => Promise<void>;
};

export function createSendReplyQueue(redisUrl: string): Queue<SendReplyTask> {
  return new Queue<SendReplyTask>(SEND_REPLY_QUEUE_NAME, {
    connection: createRedisConnectionOptions(redisUrl),
    defaultJobOptions: getDefaultSendReplyJobOptions(),
  });
}

export async function enqueueSendReplyTask(input: {
  queue: Pick<Queue<SendReplyTask>, 'add'>;
  task: SendReplyTask;
}): Promise<SendReplyScheduleResult> {
  await input.queue.add(SEND_REPLY_JOB_NAME, input.task, {
    jobId: input.task.taskId,
  });

  return {
    mode: 'queued',
  };
}

export function createSendReplyWorker(input: {
  redisUrl: string;
  logger: Logger;
  stateStore: RedisStateStore;
  replyAuditStore: ReplyAuditStore;
  sendGroupMessage: (sendInput: {
    groupId: string;
    content: string;
    requestId: string;
    replyToMessageId?: string;
    traceId: string;
    sentenceIndex?: number;
    sentenceCount?: number;
  }) => Promise<unknown>;
}): Worker<SendReplyTask> {
  const processor = createSendReplyJobProcessor({
    logger: input.logger,
    stateStore: input.stateStore,
    replyAuditStore: input.replyAuditStore,
    sendGroupMessage: input.sendGroupMessage,
  });

  const worker = new Worker<SendReplyTask>(SEND_REPLY_QUEUE_NAME, processor, {
    connection: createRedisConnectionOptions(input.redisUrl),
    concurrency: 1,
  });

  worker.on('failed', (job, error) => {
    logProcessingError(input.logger, {
      traceId: job?.data.traceId ?? 'send-reply-worker',
      ...(job?.data.messageId ? { messageId: job.data.messageId } : {}),
      ...(job?.data.groupId ? { groupId: job.data.groupId } : {}),
      phase: 'send',
      err: error,
    });
  });

  return worker;
}

export function createSendReplyJobProcessor(input: {
  logger: Logger;
  stateStore: RedisStateStore;
  replyAuditStore: ReplyAuditStore;
  sendGroupMessage: (sendInput: {
    groupId: string;
    content: string;
    requestId: string;
    replyToMessageId?: string;
    traceId: string;
    sentenceIndex?: number;
    sentenceCount?: number;
  }) => Promise<unknown>;
}): Processor<SendReplyTask> {
  return async (job) => {
    const dispatchResult = await dispatchReplyTask({
      task: job.data,
      store: input.stateStore,
      send: async (sendInput) => {
        await input.sendGroupMessage(sendInput);
      },
    });

    await input.replyAuditStore.updateStatus({
      replyLogId: job.data.taskId,
      status: 'sent',
      attemptCount: dispatchResult.sentCount,
      contentPreview: job.data.sentences.map((sentence) => sentence.content).join(' ').slice(0, 80),
      sentAt: new Date(),
    });

    return dispatchResult;
  };
}

export function getDefaultSendReplyJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: false,
  };
}
