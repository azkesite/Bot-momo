import { describe, expect, it } from 'vitest';

import type { RedisTtlPolicy, UnifiedMessageEvent } from '../packages/core/src/index.js';
import {
  createIncomingMessageDedupeKey,
  getMessageAuditRecord,
  persistIncomingMessageEvent,
  toGroupRecordId,
  toPersistedMessageId,
  toUserRecordId,
  type MessageAuditPersistence,
  type MessageAuditRecord,
} from '../packages/memory/src/index.js';

class InMemoryDedupeStore {
  private readonly values = new Map<string, string>();

  async getText(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setText(key: string, value: string, _ttlPolicy?: RedisTtlPolicy): Promise<void> {
    this.values.set(key, value);
  }
}

class InMemoryMessageAuditPersistence implements MessageAuditPersistence {
  readonly groups = new Map<string, { platform: string; externalGroupId: string }>();
  readonly users = new Map<string, { platform: string; externalUserId: string; nickname: string }>();
  readonly messages = new Map<string, MessageAuditRecord>();

  async upsertGroup(input: { id: string; platform: string; externalGroupId: string }): Promise<void> {
    this.groups.set(input.id, {
      platform: input.platform,
      externalGroupId: input.externalGroupId,
    });
  }

  async upsertUser(input: {
    id: string;
    platform: string;
    externalUserId: string;
    nickname: string;
  }): Promise<void> {
    this.users.set(input.id, {
      platform: input.platform,
      externalUserId: input.externalUserId,
      nickname: input.nickname,
    });
  }

  async insertMessage(input: {
    id: string;
    platform: string;
    groupId: string;
    userId: string;
    replyToMessageId?: string;
    content: string;
    rawPayload: unknown;
    mentionedBot: boolean;
    sentAt: Date;
  }): Promise<'inserted' | 'duplicate'> {
    if (this.messages.has(input.id)) {
      return 'duplicate';
    }

    this.messages.set(input.id, {
      persistedMessageId: input.id,
      platform: input.platform,
      externalMessageId: input.id.split(':').at(-1) ?? input.id,
      groupRecordId: input.groupId,
      userRecordId: input.userId,
      content: input.content,
      mentionedBot: input.mentionedBot,
      rawPayload: input.rawPayload,
    });

    return 'inserted';
  }

  async getMessageAuditRecord(messageId: string): Promise<MessageAuditRecord | null> {
    return this.messages.get(messageId) ?? null;
  }
}

function createEvent(): UnifiedMessageEvent {
  return {
    eventType: 'message.created',
    platform: 'qq',
    messageId: '1001',
    groupId: '2002',
    userId: '3003',
    nickname: 'Tester',
    content: '@momo 今晚来吗',
    timestamp: 1_712_000_000,
    mentions: [
      {
        type: 'platform_mention',
        targetId: '9001',
        targetName: 'momo',
        text: '@momo',
        isBot: true,
      },
    ],
    replyTo: {
      messageId: '999',
      isBot: true,
    },
    rawPayload: {
      source: 'test',
    },
  };
}

describe('message audit persistence orchestration', () => {
  it('persists the first incoming unified event and records audit data', async () => {
    const dedupeStore = new InMemoryDedupeStore();
    const persistence = new InMemoryMessageAuditPersistence();
    const event = createEvent();

    const result = await persistIncomingMessageEvent({
      event,
      dedupeStore,
      persistence,
    });

    expect(result).toEqual({
      status: 'inserted',
      persistedMessageId: 'qq:message:1001',
      groupRecordId: 'qq:group:2002',
      userRecordId: 'qq:user:3003',
      dedupeKey: 'incoming-message:qq:1001',
    });
    expect(persistence.groups.get('qq:group:2002')).toEqual({
      platform: 'qq',
      externalGroupId: '2002',
    });
    expect(persistence.users.get('qq:user:3003')).toEqual({
      platform: 'qq',
      externalUserId: '3003',
      nickname: 'Tester',
    });

    const record = await getMessageAuditRecord({
      persistedMessageId: result.persistedMessageId,
      persistence,
    });

    expect(record).toMatchObject({
      persistedMessageId: 'qq:message:1001',
      platform: 'qq',
      externalMessageId: '1001',
      groupRecordId: 'qq:group:2002',
      userRecordId: 'qq:user:3003',
      content: '@momo 今晚来吗',
      mentionedBot: true,
      rawPayload: {
        source: 'test',
      },
    });
  });

  it('skips a duplicate incoming event when the dedupe store already contains it', async () => {
    const dedupeStore = new InMemoryDedupeStore();
    const persistence = new InMemoryMessageAuditPersistence();
    const event = createEvent();
    const dedupeKey = createIncomingMessageDedupeKey(event);

    await dedupeStore.setText(dedupeKey, '1', 'dedupe');

    const result = await persistIncomingMessageEvent({
      event,
      dedupeStore,
      persistence,
    });

    expect(result.status).toBe('duplicate');
    expect(persistence.groups.size).toBe(0);
    expect(persistence.users.size).toBe(0);
    expect(persistence.messages.size).toBe(0);
  });

  it('builds deterministic storage identifiers for platform records', () => {
    expect(toGroupRecordId('qq', '2002')).toBe('qq:group:2002');
    expect(toUserRecordId('qq', '3003')).toBe('qq:user:3003');
    expect(toPersistedMessageId('qq', '1001')).toBe('qq:message:1001');
  });
});
