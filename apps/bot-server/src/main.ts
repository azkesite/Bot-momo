import { loadConfig } from '@bot-momo/config';
import {
  connectRedisClient,
  createRedisClient,
  createRedisStateStore,
  logMemoryWrite,
  logProcessingError,
  registerRedisLogging,
} from '@bot-momo/core';
import {
  createDatabaseClient,
  createMessageAuditPersistence,
  createReplyAuditLog,
  persistIncomingMessageEvent,
} from '@bot-momo/memory';
import {
  createAppContext,
  createServer,
  createStartupTraceContext,
  getDependencyStatus,
} from './app.js';

try {
  const config = loadConfig();
  const app = createAppContext(config);
  const redisClient = createRedisClient(config.redisUrl);
  registerRedisLogging(redisClient, app.logger);
  await connectRedisClient(redisClient);
  const stateStore = createRedisStateStore(redisClient);
  const { client: dbClient, db } = await createDatabaseClient(config.databaseUrl);
  const auditPersistence = createMessageAuditPersistence(db);
  const server = createServer(app);
  const dependencyStatus = getDependencyStatus(config);

  app.onNapCatEvent = async (event, trace) => {
    const result = await persistIncomingMessageEvent({
      event,
      dedupeStore: stateStore,
      persistence: auditPersistence,
    });

    if (result.status === 'inserted') {
      await createReplyAuditLog({
        db,
        replyLogId: `${result.persistedMessageId}:audit`,
        persistedMessageId: result.persistedMessageId,
        traceId: trace.traceId,
        decisionAction: 'skip',
        decisionReason: 'audited_only',
        contentPreview: event.content.slice(0, 80),
      });

      logMemoryWrite(app.logger, {
        ...trace,
        messageId: event.messageId,
        groupId: event.groupId,
        userId: event.userId,
        memoryScope: 'short_term',
        summary: `Audited incoming message ${result.persistedMessageId}.`,
      });
    }
  };

  app.logger.info(
    {
      event: 'app.startup',
      traceId: createStartupTraceContext().traceId,
      provider: config.defaultProvider,
      botName: config.botName,
      activeReplyEnabled: config.activeReplyEnabled,
      dependencyStatus,
    },
    'Application startup complete',
  );

  await server.listen({
    host: '0.0.0.0',
    port: config.port,
  });

  server.addHook('onClose', async () => {
    await Promise.allSettled([redisClient.quit(), dbClient.end()]);
  });
} catch (error) {
  const fallbackLogger = createAppContext({
    ...loadConfig({
      NAPCAT_BASE_URL: 'http://127.0.0.1:3001',
      NAPCAT_ACCESS_TOKEN: 'bootstrap-token',
      ADMIN_TOKEN: 'bootstrap-admin-token',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
      REDIS_URL: 'redis://127.0.0.1:6379',
    }),
    logLevel: 'error',
  }).logger;

  logProcessingError(fallbackLogger, {
    traceId: createStartupTraceContext().traceId,
    phase: 'startup',
    err: error instanceof Error ? error : new Error('Unknown startup error'),
  });

  process.exitCode = 1;
}
