import Fastify, { type FastifyInstance } from 'fastify';
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

export type DependencyStatus = {
  database: {
    configured: boolean;
    status: 'configured' | 'missing';
  };
  redis: {
    configured: boolean;
    status: 'configured' | 'missing';
  };
  napcat: {
    configured: boolean;
    status: 'configured' | 'missing';
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

export function getDependencyStatus(config: AppConfig): DependencyStatus {
  return {
    database: {
      configured: config.databaseUrl.trim().length > 0,
      status: config.databaseUrl.trim().length > 0 ? 'configured' : 'missing',
    },
    redis: {
      configured: config.redisUrl.trim().length > 0,
      status: config.redisUrl.trim().length > 0 ? 'configured' : 'missing',
    },
    napcat: {
      configured: config.napcatBaseUrl.trim().length > 0 && config.napcatAccessToken.trim().length > 0,
      status:
        config.napcatBaseUrl.trim().length > 0 && config.napcatAccessToken.trim().length > 0
          ? 'configured'
          : 'missing',
    },
  };
}

export function createServer(app: AppContext): FastifyInstance {
  const server = Fastify();

  server.setErrorHandler((error, _request, reply) => {
    app.logger.error(
      {
        event: 'http.error',
        traceId: 'http-error',
        err: error,
      },
      'Unhandled HTTP error',
    );

    void reply.status(500).send({
      ok: false,
      error: 'internal_error',
    });
  });

  server.get('/health/live', async () => {
    return {
      ok: true,
      service: 'bot-server',
    };
  });

  server.get('/health', async () => {
    return {
      ok: true,
      service: 'bot-server',
      config: {
        provider: app.config.defaultProvider,
        botName: app.config.botName,
        activeReplyEnabled: app.config.activeReplyEnabled,
      },
      dependencies: getDependencyStatus(app.config),
    };
  });

  return server;
}
