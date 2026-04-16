import { claimSendTask } from './dedupe.js';
import type { ScheduledSentence } from './schedule.js';
import type { RedisStateStore } from '@bot-momo/core';

export type SendReplyTask = {
  messageId: string;
  taskId: string;
  groupId: string;
  replyToMessageId?: string;
  traceId: string;
  sentences: ScheduledSentence[];
};

type SendTaskStore = Pick<RedisStateStore, 'getText' | 'setText'>;

type SendTransport = (input: {
  groupId: string;
  content: string;
  requestId: string;
  replyToMessageId?: string;
  traceId: string;
  sentenceIndex: number;
  sentenceCount: number;
}) => Promise<void>;

export async function dispatchReplyTask(input: {
  task: SendReplyTask;
  store: SendTaskStore;
  send: SendTransport;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ sentCount: number; skippedDuplicates: number }> {
  let sentCount = 0;
  let skippedDuplicates = 0;
  const sleep = input.sleep ?? defaultSleep;

  for (const sentence of input.task.sentences) {
    const claim = await claimSendTask({
      store: input.store,
      messageId: input.task.messageId,
      taskId: input.task.taskId,
      sentenceIndex: sentence.sentenceIndex,
    });

    if (claim.duplicate) {
      skippedDuplicates += 1;
      continue;
    }

    if (sentence.delayMs > 0) {
      await sleep(sentence.delayMs);
    }

    await input.send({
      groupId: input.task.groupId,
      content: sentence.content,
      requestId: `${input.task.taskId}:${sentence.sentenceIndex}`,
      ...(input.task.replyToMessageId ? { replyToMessageId: input.task.replyToMessageId } : {}),
      traceId: input.task.traceId,
      sentenceIndex: sentence.sentenceIndex,
      sentenceCount: input.task.sentences.length,
    });

    sentCount += 1;
  }

  return {
    sentCount,
    skippedDuplicates,
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
