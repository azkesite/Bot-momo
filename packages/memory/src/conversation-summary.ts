import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { conversationSummaries, type DatabaseSchema } from './db/schema.js';

export type ConversationSummaryRecord = {
  id: string;
  scope: 'group' | 'user';
  groupId?: string;
  userId?: string;
  summary: string;
  sourceMessageCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ConversationSummaryStore = {
  upsertSummary: (input: Omit<ConversationSummaryRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  getSummary: (input: { scope: 'group'; groupId: string } | { scope: 'user'; userId: string }) => Promise<ConversationSummaryRecord | null>;
};

export function createConversationSummaryStore(
  db: NodePgDatabase<DatabaseSchema>,
): ConversationSummaryStore {
  return {
    async upsertSummary(input) {
      await db
        .insert(conversationSummaries)
        .values({
          id: input.id,
          scope: input.scope,
          ...(input.groupId ? { groupId: input.groupId } : {}),
          ...(input.userId ? { userId: input.userId } : {}),
          summary: input.summary,
          sourceMessageCount: input.sourceMessageCount,
        })
        .onConflictDoUpdate({
          target: conversationSummaries.id,
          set: {
            summary: input.summary,
            sourceMessageCount: input.sourceMessageCount,
            updatedAt: new Date(),
          },
        });
    },

    async getSummary(input) {
      const record =
        input.scope === 'group'
          ? await db.query.conversationSummaries.findFirst({
              where: and(
                eq(conversationSummaries.scope, 'group'),
                eq(conversationSummaries.groupId, input.groupId),
              ),
              orderBy: [desc(conversationSummaries.updatedAt)],
            })
          : await db.query.conversationSummaries.findFirst({
              where: and(
                eq(conversationSummaries.scope, 'user'),
                eq(conversationSummaries.userId, input.userId),
              ),
              orderBy: [desc(conversationSummaries.updatedAt)],
            });

      if (!record) {
        return null;
      }

      return {
        id: record.id,
        scope: record.scope,
        ...(record.groupId ? { groupId: record.groupId } : {}),
        ...(record.userId ? { userId: record.userId } : {}),
        summary: record.summary,
        sourceMessageCount: record.sourceMessageCount,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    },
  };
}
