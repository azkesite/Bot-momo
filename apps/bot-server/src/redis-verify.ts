import { loadConfig } from '@bot-momo/config';
import { createLogger } from '@bot-momo/core';
import {
  connectRedisClient,
  createRedisClient,
  createRedisKey,
  createRedisStateStore,
  registerRedisLogging,
} from '@bot-momo/core';
import { loadLocalEnvFile } from './load-local-env.js';

async function main() {
  loadLocalEnvFile();

  const config = loadConfig({
    ...process.env,
    PORT: process.env.PORT ?? '8787',
    NAPCAT_BASE_URL: process.env.NAPCAT_BASE_URL ?? 'http://127.0.0.1:3000',
    NAPCAT_ACCESS_TOKEN: process.env.NAPCAT_ACCESS_TOKEN ?? 'verification-token',
    ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? 'verification-admin-token',
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    LOG_LEVEL: process.env.LOG_LEVEL,
  });
  const logger = createLogger({
    level: config.logLevel,
    service: 'redis-verify',
  });

  const client = createRedisClient(config.redisUrl);
  registerRedisLogging(client, logger, 'verification');

  await connectRedisClient(client);

  try {
    const store = createRedisStateStore(client);
    const key = createRedisKey('test', 'verification-key');

    await store.setJson(
      key,
      {
        ok: true,
        source: 'redis-verify',
      },
      'test',
    );

    const immediateValue = await store.getJson<{ ok: boolean; source: string }>(key);

    if (!immediateValue?.ok) {
      throw new Error('Redis verification failed: could not read value immediately after write.');
    }

    await new Promise((resolve) => setTimeout(resolve, 2_300));

    const expiredValue = await store.getJson<{ ok: boolean; source: string }>(key);

    if (expiredValue !== null) {
      throw new Error('Redis verification failed: key did not expire as expected.');
    }

    console.log(
      JSON.stringify({
        ok: true,
        verified: ['connect', 'set-with-ttl', 'get', 'expiration'],
      }),
    );
  } finally {
    await client.disconnect();
  }
}

void main();
