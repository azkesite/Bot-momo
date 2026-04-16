import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { RedisStateStore, UnifiedMessageEvent } from '@bot-momo/core';

import {
  groups,
  messages,
  replyLogs,
  users,
  type DatabaseSchema,
} from './db/schema.js';

export type MessageAuditStatus = 'inserted' | 'duplicate';

export type MessageAuditResult = {
  status: MessageAuditStatus;
  persistedMessageId: string;
  groupRecordId: string;
  userRecordId: string;
  dedupeKey: string;
};

export type MessageAuditRecord = {
  persistedMessageId: string;
  platform: string;
  externalMessageId: string;
  groupRecordId: string;
  userRecordId: string;
  content: string;
  mentionedBot: boolean;
  rawPayload: unknown;
};

export type MessageAuditPersistence = {
  upsertGroup: (input: {
    id: string;
    platform: string;
    externalGroupId: string;
  }) => Promise<void>;
  upsertUser: (input: {
    id: string;
    platform: string;
    externalUserId: string;
    nickname: string;
  }) => Promise<void>;
  insertMessage: (input: {
    id: string;
    platform: string;
    groupId: string;
    userId: string;
    replyToMessageId?: string;
    content: string;
    rawPayload: unknown;
    mentionedBot: boolean;
    sentAt: Date;
  }) => Promise<'inserted' | 'duplicate'>;
  getMessageAuditRecord: (messageId: string) => Promise<MessageAuditRecord | null>;
};

export function createMessageAuditPersistence(
  db: NodePgDatabase<DatabaseSchema>,
): MessageAuditPersistence {
  return {
    async upsertGroup(input) {
      await db
        .insert(groups)
        .values({
          id: input.id,
          platform: input.platform,
          externalGroupId: input.externalGroupId,
        })
        .onConflictDoUpdate({
          target: [groups.platform, groups.externalGroupId],
          set: {
            updatedAt: new Date(),
          },
        });
    },

    async upsertUser(input) {
      await db
        .insert(users)
        .values({
          id: input.id,
          platform: input.platform,
          externalUserId: input.externalUserId,
          nickname: input.nickname,
        })
        .onConflictDoUpdate({
          target: [users.platform, users.externalUserId],
          set: {
            nickname: input.nickname,
            updatedAt: new Date(),
          },
        });
    },

    async insertMessage(input) {
      const inserted = await db
        .insert(messages)
        .values({
          id: input.id,
          platform: input.platform,
          groupId: input.groupId,
          userId: input.userId,
          ...(input.replyToMessageId ? { replyToMessageId: input.replyToMessageId } : {}),
          content: input.content,
          rawPayload: input.rawPayload,
          mentionedBot: input.mentionedBot,
          sentAt: input.sentAt,
        })
        .onConflictDoNothing()
        .returning({
          id: messages.id,
        });

      return inserted.length > 0 ? 'inserted' : 'duplicate';
    },

    async getMessageAuditRecord(messageId) {
      const record = await db.query.messages.findFirst({
        where: eq(messages.id, messageId),
      });

      if (!record) {
        return null;
      }

      return {
        persistedMessageId: record.id,
        platform: record.platform,
        externalMessageId: parseExternalId(record.id),
        groupRecordId: record.groupId,
        userRecordId: record.userId,
        content: record.content,
        mentionedBot: record.mentionedBot,
        rawPayload: record.rawPayload,
      };
    },
  };
}

export async function persistIncomingMessageEvent(input: {
  event: UnifiedMessageEvent;
  dedupeStore: Pick<RedisStateStore, 'getText' | 'setText'>;
  persistence: MessageAuditPersistence;
}): Promise<MessageAuditResult> {
  const dedupeKey = createIncomingMessageDedupeKey(input.event);
  const persistedMessageId = toPersistedMessageId(input.event.platform, input.event.messageId);
  const groupRecordId = toGroupRecordId(input.event.platform, input.event.groupId);
  const userRecordId = toUserRecordId(input.event.platform, input.event.userId);

  const existingDedupe = await input.dedupeStore.getText(dedupeKey);

  if (existingDedupe === '1') {
    return {
      status: 'duplicate',
      persistedMessageId,
      groupRecordId,
      userRecordId,
      dedupeKey,
    };
  }

  await input.persistence.upsertGroup({
    id: groupRecordId,
    platform: input.event.platform,
    externalGroupId: input.event.groupId,
  });
  await input.persistence.upsertUser({
    id: userRecordId,
    platform: input.event.platform,
    externalUserId: input.event.userId,
    nickname: input.event.nickname,
  });

  const insertStatus = await input.persistence.insertMessage({
    id: persistedMessageId,
    platform: input.event.platform,
    groupId: groupRecordId,
    userId: userRecordId,
    ...(input.event.replyTo
      ? {
          replyToMessageId: toPersistedMessageId(input.event.platform, input.event.replyTo.messageId),
        }
      : {}),
    content: input.event.content,
    rawPayload: input.event.rawPayload,
    mentionedBot: input.event.mentions.some((mention) => mention.isBot === true),
    sentAt: new Date(input.event.timestamp * 1000),
  });

  await input.dedupeStore.setText(dedupeKey, '1', 'dedupe');

  return {
    status: insertStatus,
    persistedMessageId,
    groupRecordId,
    userRecordId,
    dedupeKey,
  };
}

export function createIncomingMessageDedupeKey(event: Pick<UnifiedMessageEvent, 'platform' | 'messageId'>): string {
  return `incoming-message:${event.platform}:${event.messageId}`;
}

export function toGroupRecordId(platform: string, externalGroupId: string): string {
  return `${platform}:group:${externalGroupId}`;
}

export function toUserRecordId(platform: string, externalUserId: string): string {
  return `${platform}:user:${externalUserId}`;
}

export function toPersistedMessageId(platform: string, externalMessageId: string): string {
  return `${platform}:message:${externalMessageId}`;
}

export async function getMessageAuditRecord(input: {
  persistedMessageId: string;
  persistence: MessageAuditPersistence;
}): Promise<MessageAuditRecord | null> {
  return input.persistence.getMessageAuditRecord(input.persistedMessageId);
}

export async function createReplyAuditLog(input: {
  db: NodePgDatabase<DatabaseSchema>;
  replyLogId: string;
  persistedMessageId: string;
  traceId: string;
  decisionAction: string;
  decisionReason: string;
  contentPreview: string;
}): Promise<void> {
  await input.db
    .insert(replyLogs)
    .values({
      id: input.replyLogId,
      messageId: input.persistedMessageId,
      traceId: input.traceId,
      decisionAction: input.decisionAction,
      decisionReason: input.decisionReason,
      contentPreview: input.contentPreview,
      status: 'queued',
      attemptCount: 0,
    })
    .onConflictDoNothing();
}

export async function updateReplyAuditLogStatus(input: {
  db: NodePgDatabase<DatabaseSchema>;
  replyLogId: string;
  status: 'queued' | 'sent' | 'failed';
  attemptCount: number;
  contentPreview?: string;
  sentAt?: Date;
}): Promise<void> {
  await input.db
    .update(replyLogs)
    .set({
      status: input.status,
      attemptCount: input.attemptCount,
      ...(input.contentPreview ? { contentPreview: input.contentPreview } : {}),
      ...(input.sentAt ? { sentAt: input.sentAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(replyLogs.id, input.replyLogId));
}

function parseExternalId(persistedMessageId: string): string {
  const parts = persistedMessageId.split(':');
  return parts[parts.length - 1] ?? persistedMessageId;
}
