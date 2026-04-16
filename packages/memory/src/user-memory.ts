import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { userMemories, type DatabaseSchema } from './db/schema.js';

export type UserMemoryProfile = {
  id: string;
  userId: string;
  nicknameHistory: string[];
  aliases: string[];
  traits: string[];
  preferences: string[];
  relationshipSummary: string;
  lastInteractionAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UserMemoryStore = {
  getByUserId: (userId: string) => Promise<UserMemoryProfile | null>;
  getOrCreate: (input: { id: string; userId: string; nickname?: string }) => Promise<UserMemoryProfile>;
  update: (input: {
    id: string;
    userId: string;
    nicknameHistory?: string[];
    aliases?: string[];
    traits?: string[];
    preferences?: string[];
    relationshipSummary?: string;
    lastInteractionAt?: Date;
  }) => Promise<UserMemoryProfile>;
};

export function createUserMemoryStore(db: NodePgDatabase<DatabaseSchema>): UserMemoryStore {
  return {
    async getByUserId(userId) {
      const existing = await db.query.userMemories.findFirst({
        where: eq(userMemories.userId, userId),
      });

      return existing ? mapUserMemoryProfile(existing) : null;
    },

    async getOrCreate(input) {
      const existing = await db.query.userMemories.findFirst({
        where: eq(userMemories.userId, input.userId),
      });

      if (existing) {
        return mapUserMemoryProfile(existing);
      }

      const nicknameHistory = input.nickname ? [input.nickname] : [];

      const inserted = await db
        .insert(userMemories)
        .values({
          id: input.id,
          userId: input.userId,
          nicknameHistory,
          aliases: [],
          traits: [],
          preferences: [],
          relationshipSummary: '',
        })
        .returning();

      return mapUserMemoryProfile(inserted[0]!);
    },

    async update(input) {
      const existing = await db.query.userMemories.findFirst({
        where: eq(userMemories.userId, input.userId),
      });

      if (!existing) {
        throw new Error(`User memory not found for userId=${input.userId}`);
      }

      const updated = await db
        .update(userMemories)
        .set({
          ...(input.nicknameHistory ? { nicknameHistory: input.nicknameHistory } : {}),
          ...(input.aliases ? { aliases: input.aliases } : {}),
          ...(input.traits ? { traits: input.traits } : {}),
          ...(input.preferences ? { preferences: input.preferences } : {}),
          ...(input.relationshipSummary !== undefined
            ? { relationshipSummary: input.relationshipSummary }
            : {}),
          ...(input.lastInteractionAt ? { lastInteractionAt: input.lastInteractionAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(userMemories.id, input.id))
        .returning();

      return mapUserMemoryProfile(updated[0]!);
    },
  };
}

export function createDefaultUserMemoryProfile(input: {
  id: string;
  userId: string;
  nickname?: string;
}): UserMemoryProfile {
  return {
    id: input.id,
    userId: input.userId,
    nicknameHistory: input.nickname ? [input.nickname] : [],
    aliases: [],
    traits: [],
    preferences: [],
    relationshipSummary: '',
  };
}

function mapUserMemoryProfile(record: typeof userMemories.$inferSelect): UserMemoryProfile {
  return {
    id: record.id,
    userId: record.userId,
    nicknameHistory: parseStringArray(record.nicknameHistory),
    aliases: parseStringArray(record.aliases),
    traits: parseStringArray(record.traits),
    preferences: parseStringArray(record.preferences),
    relationshipSummary: record.relationshipSummary,
    ...(record.lastInteractionAt ? { lastInteractionAt: record.lastInteractionAt } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}
