import { describe, expect, it } from 'vitest';

import {
  createDefaultUserMemoryProfile,
  type UserMemoryProfile,
  type UserMemoryStore,
} from '../packages/memory/src/index.js';

class InMemoryUserMemoryStore implements UserMemoryStore {
  readonly memories = new Map<string, UserMemoryProfile>();

  async getOrCreate(input: { id: string; userId: string; nickname?: string }): Promise<UserMemoryProfile> {
    const existing = this.memories.get(input.userId);

    if (existing) {
      return existing;
    }

    const created = createDefaultUserMemoryProfile(input);
    this.memories.set(input.userId, created);
    return created;
  }

  async update(input: {
    id: string;
    userId: string;
    nicknameHistory?: string[];
    aliases?: string[];
    traits?: string[];
    preferences?: string[];
    relationshipSummary?: string;
    lastInteractionAt?: Date;
  }): Promise<UserMemoryProfile> {
    const existing = this.memories.get(input.userId);

    if (!existing) {
      throw new Error('User memory not found');
    }

    const updated: UserMemoryProfile = {
      ...existing,
      ...(input.nicknameHistory ? { nicknameHistory: input.nicknameHistory } : {}),
      ...(input.aliases ? { aliases: input.aliases } : {}),
      ...(input.traits ? { traits: input.traits } : {}),
      ...(input.preferences ? { preferences: input.preferences } : {}),
      ...(input.relationshipSummary !== undefined
        ? { relationshipSummary: input.relationshipSummary }
        : {}),
      ...(input.lastInteractionAt ? { lastInteractionAt: input.lastInteractionAt } : {}),
      updatedAt: new Date('2026-04-16T00:00:00.000Z'),
    };

    this.memories.set(input.userId, updated);
    return updated;
  }
}

describe('user memory profile model', () => {
  it('creates a minimal memory profile for a new user', async () => {
    const store = new InMemoryUserMemoryStore();

    const profile = await store.getOrCreate({
      id: 'memory-1',
      userId: 'qq:user:3003',
      nickname: 'Tester',
    });

    expect(profile).toEqual({
      id: 'memory-1',
      userId: 'qq:user:3003',
      nicknameHistory: ['Tester'],
      aliases: [],
      traits: [],
      preferences: [],
      relationshipSummary: '',
    });
  });

  it('updates only the targeted user memory without leaking into other users', async () => {
    const store = new InMemoryUserMemoryStore();

    await store.getOrCreate({
      id: 'memory-1',
      userId: 'qq:user:3003',
      nickname: 'TesterA',
    });
    await store.getOrCreate({
      id: 'memory-2',
      userId: 'qq:user:4004',
      nickname: 'TesterB',
    });

    const updated = await store.update({
      id: 'memory-1',
      userId: 'qq:user:3003',
      nicknameHistory: ['TesterA', '新昵称'],
      aliases: ['老哥'],
      preferences: ['开黑'],
      relationshipSummary: '会经常在群里聊游戏',
      lastInteractionAt: new Date('2026-04-16T12:00:00.000Z'),
    });

    expect(updated).toMatchObject({
      id: 'memory-1',
      userId: 'qq:user:3003',
      nicknameHistory: ['TesterA', '新昵称'],
      aliases: ['老哥'],
      preferences: ['开黑'],
      relationshipSummary: '会经常在群里聊游戏',
      lastInteractionAt: new Date('2026-04-16T12:00:00.000Z'),
    });
    expect(store.memories.get('qq:user:4004')).toEqual({
      id: 'memory-2',
      userId: 'qq:user:4004',
      nicknameHistory: ['TesterB'],
      aliases: [],
      traits: [],
      preferences: [],
      relationshipSummary: '',
    });
  });

  it('returns the same existing memory profile on repeated getOrCreate', async () => {
    const store = new InMemoryUserMemoryStore();

    const first = await store.getOrCreate({
      id: 'memory-1',
      userId: 'qq:user:3003',
      nickname: 'Tester',
    });
    const second = await store.getOrCreate({
      id: 'memory-1',
      userId: 'qq:user:3003',
      nickname: 'IgnoredNickname',
    });

    expect(second).toEqual(first);
    expect(second.nicknameHistory).toEqual(['Tester']);
  });
});
