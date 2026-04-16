import { describe, expect, it } from 'vitest';

import type { RedisTtlPolicy } from '../packages/core/src/index.js';
import { claimSendTask, createSendTaskDedupeKey } from '../packages/sender/src/index.js';

class InMemoryStore {
  private readonly values = new Map<string, string>();

  async getText(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setText(key: string, value: string, _ttlPolicy?: RedisTtlPolicy): Promise<void> {
    this.values.set(key, value);
  }
}

describe('send task dedupe', () => {
  it('creates deterministic dedupe keys for single and split sends', () => {
    expect(
      createSendTaskDedupeKey({
        messageId: 'msg-1',
        taskId: 'task-1',
      }),
    ).toBe('bot-momo:send-task:msg-1:task-1:single');

    expect(
      createSendTaskDedupeKey({
        messageId: 'msg-1',
        taskId: 'task-1',
        sentenceIndex: 2,
      }),
    ).toBe('bot-momo:send-task:msg-1:task-1:2');
  });

  it('claims a send task once and flags repeated claims as duplicates', async () => {
    const store = new InMemoryStore();

    const firstClaim = await claimSendTask({
      store,
      messageId: 'msg-1',
      taskId: 'task-1',
    });
    const secondClaim = await claimSendTask({
      store,
      messageId: 'msg-1',
      taskId: 'task-1',
    });

    expect(firstClaim).toEqual({
      dedupeKey: 'bot-momo:send-task:msg-1:task-1:single',
      duplicate: false,
    });
    expect(secondClaim).toEqual({
      dedupeKey: 'bot-momo:send-task:msg-1:task-1:single',
      duplicate: true,
    });
  });

  it('keeps split sentence tasks isolated by sentence index', async () => {
    const store = new InMemoryStore();

    const sentenceZero = await claimSendTask({
      store,
      messageId: 'msg-1',
      taskId: 'task-1',
      sentenceIndex: 0,
    });
    const sentenceOne = await claimSendTask({
      store,
      messageId: 'msg-1',
      taskId: 'task-1',
      sentenceIndex: 1,
    });

    expect(sentenceZero.duplicate).toBe(false);
    expect(sentenceOne.duplicate).toBe(false);
    expect(sentenceZero.dedupeKey).not.toBe(sentenceOne.dedupeKey);
  });
});
