import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import { createLogCapture, createLogger } from '../packages/core/src/index.js';
import {
  createRedisKey,
  createRedisStateStore,
  getRedisTtlSeconds,
  registerRedisLogging,
} from '../packages/core/src/redis.js';

class FakeRedisClient extends EventEmitter {
  readonly values = new Map<string, string>();
  readonly ttl = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    options: {
      EX: number;
    },
  ): Promise<void> {
    this.values.set(key, value);
    this.ttl.set(key, options.EX);
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
    this.ttl.delete(key);
  }
}

describe('redis helpers', () => {
  it('builds deterministic redis keys', () => {
    expect(createRedisKey('dedupe', 'qq', 'message-1')).toBe('bot-momo:dedupe:qq:message-1');
    expect(createRedisKey('active-reply', 'group-1', 'user-1')).toBe(
      'bot-momo:active-reply:group-1:user-1',
    );
  });

  it('stores text and json values with ttl policies', async () => {
    const client = new FakeRedisClient();
    const store = createRedisStateStore(client);
    const textKey = createRedisKey('short-state', 'text');
    const jsonKey = createRedisKey('context', 'json');

    await store.setText(textKey, 'hello', 'dedupe');
    await store.setJson(jsonKey, { ok: true }, 'activeReply');

    expect(await store.getText(textKey)).toBe('hello');
    expect(await store.getJson<{ ok: boolean }>(jsonKey)).toEqual({ ok: true });
    expect(client.ttl.get(textKey)).toBe(getRedisTtlSeconds('dedupe'));
    expect(client.ttl.get(jsonKey)).toBe(getRedisTtlSeconds('activeReply'));

    await store.deleteKey(textKey);
    expect(await store.getText(textKey)).toBeNull();
  });

  it('logs reconnect and error diagnostics', () => {
    const capture = createLogCapture();
    const logger = createLogger({
      level: 'info',
      service: 'redis-test',
      destination: capture.destination,
    });
    const client = new FakeRedisClient();

    registerRedisLogging(client, logger, 'state');

    client.emit('connect');
    client.emit('ready');
    client.emit('reconnecting');
    client.emit('error', new Error('socket closed'));
    client.emit('end');

    const logs = capture.readLogs();

    expect(logs.map((entry) => entry.event)).toEqual([
      'redis.connect',
      'redis.ready',
      'redis.reconnecting',
      'redis.error',
      'redis.end',
    ]);
    expect(logs[3]).toMatchObject({
      event: 'redis.error',
      client: 'state',
    });
  });
});
