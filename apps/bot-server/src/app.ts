import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from '@bot-momo/config';
import { createLogger, type TraceContext } from '@bot-momo/core';
import { handleNapCatWebhook, type NapCatEventHandler } from './napcat-adapter.js';

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
  onNapCatEvent?: NapCatEventHandler;
  adminHandlers?: {
    getHealth: () => Promise<unknown> | unknown;
    listKeywordRules: () => Promise<unknown> | unknown;
    createKeywordRule: (body: unknown) => Promise<unknown> | unknown;
    getUserMemory: (userId: string) => Promise<unknown> | unknown;
    listReplyLogs: () => Promise<unknown> | unknown;
  };
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

  async function ensureAdmin(request: { headers: Record<string, unknown> }, reply: { status: (code: number) => { send: (body: unknown) => unknown } }): Promise<boolean> {
    const token = request.headers['x-admin-token'];

    if (typeof token !== 'string' || token !== app.config.adminToken) {
      void reply.status(401).send({
        ok: false,
        error: 'unauthorized',
      });
      return false;
    }

    return true;
  }

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

  server.post('/adapters/napcat/events', async (request, reply) => {
    const result = await handleNapCatWebhook({
      payload: request.body,
      logger: app.logger,
      ...(app.onNapCatEvent ? { onEvent: app.onNapCatEvent } : {}),
    });

    if (!result.accepted) {
      return reply.status(202).send({
        ok: true,
        accepted: false,
        traceId: result.traceId,
        reason: result.reason,
      });
    }

    return reply.status(202).send({
      ok: true,
      accepted: true,
      traceId: result.traceId,
      event: {
        platform: result.event.platform,
        messageId: result.event.messageId,
        groupId: result.event.groupId,
        userId: result.event.userId,
      },
    });
  });

  server.get('/admin/health', async (request, reply) => {
    if (!(await ensureAdmin(request, reply))) {
      return;
    }

    return {
      ok: true,
      data: app.adminHandlers ? await app.adminHandlers.getHealth() : createAppStatus(app.config),
    };
  });

  server.get('/admin/keyword-rules', async (request, reply) => {
    if (!(await ensureAdmin(request, reply))) {
      return;
    }

    return {
      ok: true,
      data: app.adminHandlers ? await app.adminHandlers.listKeywordRules() : [],
    };
  });

  server.post('/admin/keyword-rules', async (request, reply) => {
    if (!(await ensureAdmin(request, reply))) {
      return;
    }

    return {
      ok: true,
      data: app.adminHandlers ? await app.adminHandlers.createKeywordRule(request.body) : null,
    };
  });

  server.get('/admin/users/:userId/memory', async (request, reply) => {
    if (!(await ensureAdmin(request, reply))) {
      return;
    }

    const { userId } = request.params as { userId: string };

    return {
      ok: true,
      data: app.adminHandlers ? await app.adminHandlers.getUserMemory(userId) : null,
    };
  });

  server.get('/admin/reply-logs', async (request, reply) => {
    if (!(await ensureAdmin(request, reply))) {
      return;
    }

    return {
      ok: true,
      data: app.adminHandlers ? await app.adminHandlers.listReplyLogs() : [],
    };
  });

  return server;
}
