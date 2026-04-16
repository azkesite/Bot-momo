import { EventEmitter } from 'node:events';

import { createClient, type RedisClientType } from 'redis';
import type { Logger } from 'pino';

export const REDIS_KEY_PREFIX = 'bot-momo';

export const redisTtlSeconds = {
  dedupe: 120,
  shortTermState: 300,
  activeReply: 180,
  sendTask: 900,
  test: 2,
} as const;

export type RedisTtlPolicy = keyof typeof redisTtlSeconds;

export type RedisKeyNamespace =
  | 'dedupe'
  | 'short-state'
  | 'active-reply'
  | 'send-task'
  | 'context'
  | 'test';

export type RedisEventClient = Pick<EventEmitter, 'on'>;

export type RedisStateStore = {
  getText: (key: string) => Promise<string | null>;
  setText: (key: string, value: string, ttlPolicy?: RedisTtlPolicy) => Promise<void>;
  getJson: <T>(key: string) => Promise<T | null>;
  setJson: <T>(key: string, value: T, ttlPolicy?: RedisTtlPolicy) => Promise<void>;
  deleteKey: (key: string) => Promise<void>;
};

type RedisClientLike = Pick<RedisClientType, 'get' | 'set' | 'del'>;

export function createRedisClient(redisUrl: string): RedisClientType {
  return createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries: number) => Math.min(250 * 2 ** retries, 5_000),
    },
  });
}

export function registerRedisLogging(client: RedisEventClient, logger: Logger, name = 'redis'): void {
  client.on('connect', () => {
    logger.info(
      {
        event: 'redis.connect',
        client: name,
      },
      'Redis client connected',
    );
  });

  client.on('ready', () => {
    logger.info(
      {
        event: 'redis.ready',
        client: name,
      },
      'Redis client ready',
    );
  });

  client.on('reconnecting', () => {
    logger.warn(
      {
        event: 'redis.reconnecting',
        client: name,
      },
      'Redis client reconnecting',
    );
  });

  client.on('end', () => {
    logger.warn(
      {
        event: 'redis.end',
        client: name,
      },
      'Redis client disconnected',
    );
  });

  client.on('error', (error: unknown) => {
    logger.error(
      {
        event: 'redis.error',
        client: name,
        err: error,
      },
      'Redis client error',
    );
  });
}

export async function connectRedisClient(client: RedisClientType): Promise<RedisClientType> {
  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export function createRedisKey(namespace: RedisKeyNamespace, ...parts: string[]): string {
  const cleanedParts = parts.map((part) => part.trim()).filter((part) => part.length > 0);
  return [REDIS_KEY_PREFIX, namespace, ...cleanedParts].join(':');
}

export function getRedisTtlSeconds(policy: RedisTtlPolicy): number {
  return redisTtlSeconds[policy];
}

export function createRedisStateStore(client: RedisClientLike): RedisStateStore {
  return {
    async getText(key) {
      return client.get(key);
    },

    async setText(key, value, ttlPolicy: RedisTtlPolicy = 'shortTermState') {
      await client.set(key, value, {
        EX: getRedisTtlSeconds(ttlPolicy),
      });
    },

    async getJson<T>(key: string): Promise<T | null> {
      const rawValue = await client.get(key);

      if (rawValue === null) {
        return null;
      }

      return JSON.parse(rawValue) as T;
    },

    async setJson<T>(key: string, value: T, ttlPolicy: RedisTtlPolicy = 'shortTermState') {
      await client.set(key, JSON.stringify(value), {
        EX: getRedisTtlSeconds(ttlPolicy),
      });
    },

    async deleteKey(key: string) {
      await client.del(key);
    },
  };
}
