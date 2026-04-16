import { loadConfig } from '@bot-momo/config';
import { logProcessingError } from '@bot-momo/core';
import { createAppContext, createAppStatus, createStartupTraceContext } from './app.js';

try {
  const config = loadConfig();
  const app = createAppContext(config);
  const status = createAppStatus(config);

  app.logger.info(
    {
      event: 'app.startup',
      traceId: createStartupTraceContext().traceId,
      provider: config.defaultProvider,
      botName: config.botName,
      activeReplyEnabled: config.activeReplyEnabled,
    },
    'Application startup complete',
  );

  console.log(JSON.stringify(status));
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
