import { createRedisKey, type RedisStateStore } from '@bot-momo/core';

export type SendTaskDedupeResult = {
  dedupeKey: string;
  duplicate: boolean;
};

export function createSendTaskDedupeKey(input: {
  messageId: string;
  taskId: string;
  sentenceIndex?: number;
}): string {
  return createRedisKey(
    'send-task',
    input.messageId,
    input.taskId,
    input.sentenceIndex === undefined ? 'single' : String(input.sentenceIndex),
  );
}

export async function claimSendTask(input: {
  store: Pick<RedisStateStore, 'getText' | 'setText'>;
  messageId: string;
  taskId: string;
  sentenceIndex?: number;
}): Promise<SendTaskDedupeResult> {
  const dedupeKey = createSendTaskDedupeKey({
    messageId: input.messageId,
    taskId: input.taskId,
    ...(input.sentenceIndex === undefined ? {} : { sentenceIndex: input.sentenceIndex }),
  });
  const existing = await input.store.getText(dedupeKey);

  if (existing === '1') {
    return {
      dedupeKey,
      duplicate: true,
    };
  }

  await input.store.setText(dedupeKey, '1', 'sendTask');

  return {
    dedupeKey,
    duplicate: false,
  };
}
