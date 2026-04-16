import { describe, expect, it, vi } from 'vitest';

import type { RedisTtlPolicy } from '../packages/core/src/index.js';
import { dispatchReplyTask } from '../packages/sender/src/index.js';

class InMemorySendTaskStore {
  private readonly values = new Map<string, string>();

  async getText(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setText(key: string, value: string, _ttlPolicy?: RedisTtlPolicy): Promise<void> {
    this.values.set(key, value);
  }
}

describe('reply dispatch', () => {
  it('dispatches sentences in order and skips duplicate claimed tasks', async () => {
    const send = vi.fn(async () => undefined);
    const sleep = vi.fn(async () => undefined);
    const store = new InMemorySendTaskStore();

    const first = await dispatchReplyTask({
      task: {
        messageId: 'msg-1',
        taskId: 'task-1',
        groupId: 'group-1',
        replyToMessageId: 'msg-origin',
        traceId: 'trace-1',
        sentences: [
          { content: '第一句', sentenceIndex: 0, delayMs: 0 },
          { content: '第二句', sentenceIndex: 1, delayMs: 1200 },
        ],
      },
      store,
      send,
      sleep,
    });

    const duplicate = await dispatchReplyTask({
      task: {
        messageId: 'msg-1',
        taskId: 'task-1',
        groupId: 'group-1',
        replyToMessageId: 'msg-origin',
        traceId: 'trace-1',
        sentences: [
          { content: '第一句', sentenceIndex: 0, delayMs: 0 },
          { content: '第二句', sentenceIndex: 1, delayMs: 1200 },
        ],
      },
      store,
      send,
      sleep,
    });

    expect(first).toEqual({
      sentCount: 2,
      skippedDuplicates: 0,
    });
    expect(duplicate).toEqual({
      sentCount: 0,
      skippedDuplicates: 2,
    });
    expect(send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: '第一句',
        sentenceIndex: 0,
        sentenceCount: 2,
      }),
    );
    expect(send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        content: '第二句',
        sentenceIndex: 1,
        sentenceCount: 2,
      }),
    );
    expect(sleep).toHaveBeenCalledWith(1200);
  });
});
