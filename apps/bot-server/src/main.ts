import { loadConfig } from '@bot-momo/config';
import { logProcessingError } from '@bot-momo/core';
import {
  createAppContext,
  createServer,
  createStartupTraceContext,
  getDependencyStatus,
} from './app.js';

try {
  const config = loadConfig();
  const app = createAppContext(config);
  const server = createServer(app);
  const dependencyStatus = getDependencyStatus(config);

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
