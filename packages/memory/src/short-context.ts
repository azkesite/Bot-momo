import { createRedisKey, type RedisStateStore, type UnifiedMessageEvent } from '@bot-momo/core';

export type ShortContextMessage = {
  messageId: string;
  userId: string;
  nickname: string;
  content: string;
  timestamp: number;
  mentionedBot: boolean;
};

export type ShortContextStore = {
  appendGroupMessage: (groupId: string, message: ShortContextMessage, limit?: number) => Promise<ShortContextMessage[]>;
  appendUserMessage: (
    groupId: string,
    userId: string,
    message: ShortContextMessage,
    limit?: number,
  ) => Promise<ShortContextMessage[]>;
  getGroupMessages: (groupId: string) => Promise<ShortContextMessage[]>;
  getUserMessages: (groupId: string, userId: string) => Promise<ShortContextMessage[]>;
};

const DEFAULT_GROUP_CONTEXT_LIMIT = 20;
const DEFAULT_USER_CONTEXT_LIMIT = 12;

export function createShortContextStore(
  stateStore: Pick<RedisStateStore, 'getJson' | 'setJson'>,
): ShortContextStore {
  return {
    async appendGroupMessage(groupId, message, limit = DEFAULT_GROUP_CONTEXT_LIMIT) {
      const key = createGroupContextKey(groupId);
      const nextWindow = appendWindow(await stateStore.getJson<ShortContextMessage[]>(key), message, limit);
      await stateStore.setJson(key, nextWindow, 'shortTermState');
      return nextWindow;
    },

    async appendUserMessage(groupId, userId, message, limit = DEFAULT_USER_CONTEXT_LIMIT) {
      const key = createUserContextKey(groupId, userId);
      const nextWindow = appendWindow(await stateStore.getJson<ShortContextMessage[]>(key), message, limit);
      await stateStore.setJson(key, nextWindow, 'shortTermState');
      return nextWindow;
    },

    async getGroupMessages(groupId) {
      return (await stateStore.getJson<ShortContextMessage[]>(createGroupContextKey(groupId))) ?? [];
    },

    async getUserMessages(groupId, userId) {
      return (await stateStore.getJson<ShortContextMessage[]>(createUserContextKey(groupId, userId))) ?? [];
    },
  };
}

export function createShortContextMessage(event: UnifiedMessageEvent): ShortContextMessage {
  return {
    messageId: event.messageId,
    userId: event.userId,
    nickname: event.nickname,
    content: event.content,
    timestamp: event.timestamp,
    mentionedBot: event.mentions.some((mention) => mention.isBot === true),
  };
}

export function createGroupContextKey(groupId: string): string {
  return createRedisKey('context', 'group', groupId);
}

export function createUserContextKey(groupId: string, userId: string): string {
  return createRedisKey('context', 'group-user', groupId, userId);
}

function appendWindow(
  current: ShortContextMessage[] | null,
  message: ShortContextMessage,
  limit: number,
): ShortContextMessage[] {
  const next = [...(current ?? []), message];

  if (next.length <= limit) {
    return next;
  }

  return next.slice(next.length - limit);
}
