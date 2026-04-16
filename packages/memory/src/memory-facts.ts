import { desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { memoryFacts, type DatabaseSchema } from './db/schema.js';

export type MemoryFactRecord = {
  id: string;
  userId: string;
  scope: 'short_term' | 'mid_term' | 'long_term';
  fact: string;
  sourceMessageId?: string;
  confidence: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type MemoryFactStore = {
  appendFact: (input: Omit<MemoryFactRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  listFactsByUser: (userId: string, limit?: number) => Promise<MemoryFactRecord[]>;
};

export function createMemoryFactStore(db: NodePgDatabase<DatabaseSchema>): MemoryFactStore {
  return {
    async appendFact(input) {
      await db
        .insert(memoryFacts)
        .values({
          id: input.id,
          userId: input.userId,
          scope: input.scope,
          fact: input.fact,
          ...(input.sourceMessageId ? { sourceMessageId: input.sourceMessageId } : {}),
          confidence: input.confidence,
        })
        .onConflictDoNothing();
    },

    async listFactsByUser(userId, limit = 10) {
      const records = await db.query.memoryFacts.findMany({
        where: eq(memoryFacts.userId, userId),
        orderBy: [desc(memoryFacts.createdAt)],
        limit,
      });

      return records.map((record) => ({
        id: record.id,
        userId: record.userId,
        scope: record.scope,
        fact: record.fact,
        ...(record.sourceMessageId ? { sourceMessageId: record.sourceMessageId } : {}),
        confidence: record.confidence,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));
    },
  };
}
