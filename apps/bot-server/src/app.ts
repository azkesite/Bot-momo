import type { AppConfig } from '@bot-momo/config';
import { createLogger, type TraceContext } from '@bot-momo/core';

export type AppStatus = {
  service: 'bot-server';
  ready: true;
  config: {
    provider: AppConfig['defaultProvider'];
    botName: string;
    activeReplyEnabled: boolean;
  };
};

export type AppContext = {
  config: AppConfig;
  logger: ReturnType<typeof createLogger>;
};

export function createAppContext(config: AppConfig): AppContext {
  return {
    config,
    logger: createLogger({
      level: config.logLevel,
      service: 'bot-server',
    }),
  };
}

export function createAppStatus(config: AppConfig): AppStatus {
  return {
    service: 'bot-server',
    ready: true,
    config: {
      provider: config.defaultProvider,
      botName: config.botName,
      activeReplyEnabled: config.activeReplyEnabled,
    },
  };
}

export function createStartupTraceContext(): TraceContext {
  return {
    traceId: 'startup',
  };
}
