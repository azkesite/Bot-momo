import { loadConfig } from '@bot-momo/config';
import {
  connectRedisClient,
  createRedisClient,
  createRedisStateStore,
  logProcessingError,
  registerRedisLogging,
} from '@bot-momo/core';
import {
  createConfiguredLlmTransport,
  createLlmProvider,
  type LlmRequest,
  type LlmResponse,
} from '@bot-momo/llm';
import {
  createConversationSummaryStore,
  createKeywordRuleStore,
  createDatabaseClient,
  createMemoryFactStore,
  createMessageAuditPersistence,
  createReplyAuditLog,
  createShortContextStore,
  createUserMemoryStore,
  listRecentReplyAuditLogs,
  saveKeywordRule,
  updateReplyAuditLogStatus,
} from '@bot-momo/memory';
import { createNapCatSender } from './napcat-adapter.js';
import {
  createAppContext,
  createServer,
  createStartupTraceContext,
  getDependencyStatus,
} from './app.js';
import {
  createSendReplyQueue,
  createSendReplyWorker,
  enqueueSendReplyTask,
} from './jobs/send-reply-queue.js';
import { loadLocalEnvFile } from './load-local-env.js';
import { createMessageProcessor } from './message-processor.js';

try {
  const localEnv = loadLocalEnvFile();
  const config = loadConfig();
  const app = createAppContext(config);
  const redisClient = createRedisClient(config.redisUrl);
  registerRedisLogging(redisClient, app.logger);
  await connectRedisClient(redisClient);
  const stateStore = createRedisStateStore(redisClient);
  const { client: dbClient, db } = await createDatabaseClient(config.databaseUrl);
  const auditPersistence = createMessageAuditPersistence(db);
  const keywordRuleStore = createKeywordRuleStore(db);
  const userMemoryStore = createUserMemoryStore(db);
  const memoryFactStore = createMemoryFactStore(db);
  const conversationSummaryStore = createConversationSummaryStore(db);
  const shortContextStore = createShortContextStore(stateStore);
  const napCatSender = createNapCatSender(config);
  const sendReplyQueue = createSendReplyQueue(config.redisUrl);
  const llmProvider = createLlmProvider(
    config.llmTransportMode === 'remote'
      ? createConfiguredLlmTransport(config)
      : createHeuristicTransport(),
  );
  const dependencyStatus = getDependencyStatus(config);
  const selectedProviderConfig = config.llmProviders[config.defaultProvider];
  const processMessage = createMessageProcessor({
    config,
    logger: app.logger,
    stateStore,
    auditPersistence,
    replyAuditStore: {
      create: (input) =>
        createReplyAuditLog({
          db,
          ...input,
        }),
      updateStatus: (input) =>
        updateReplyAuditLogStatus({
          db,
          ...input,
        }),
    },
    keywordRuleStore,
    userMemoryStore,
    memoryFactStore,
    shortContextStore,
    conversationSummaryStore,
    llmProvider,
    sendGroupMessage: (input) => napCatSender.sendGroupMessage(input),
    scheduleReplyTask: (task) =>
      enqueueSendReplyTask({
        queue: sendReplyQueue,
        task,
      }),
    replyModel: selectedProviderConfig.model ?? 'default-chat-model',
    summaryModel: selectedProviderConfig.model ?? 'default-summary-model',
  });
  app.onNapCatEvent = async (event, trace) => {
    await processMessage(event, trace);
  };
  app.adminHandlers = {
    getHealth: () => ({
      service: 'bot-server',
      config: {
        provider: config.defaultProvider,
        llmTransportMode: config.llmTransportMode,
        botName: config.botName,
        activeReplyEnabled: config.activeReplyEnabled,
        napcatBaseUrl: config.napcatBaseUrl,
        port: config.port,
      },
      dependencies: dependencyStatus,
    }),
    listKeywordRules: () => keywordRuleStore.listActiveRules(),
    createKeywordRule: async (body) => {
      const payload = isRecord(body) ? body : {};
      const rule = {
        id: asString(payload.id) ?? `rule:${Date.now()}`,
        keyword: asString(payload.keyword) ?? '',
        matchType: normalizeMatchType(payload.matchType),
        priority: asNumber(payload.priority) ?? 100,
        enabled: payload.enabled !== false,
        responseMode: 'must_reply',
      };

      await saveKeywordRule({
        rule,
        store: keywordRuleStore,
        cache: stateStore,
      });

      return rule;
    },
    getUserMemory: async (userId) => {
      const profile = await userMemoryStore.getByUserId(userId);
      const facts = await memoryFactStore.listFactsByUser(userId, 10);
      const summary = await conversationSummaryStore.getSummary({
        scope: 'user',
        userId,
      });

      return {
        profile,
        facts,
        summary,
      };
    },
    listReplyLogs: () => listRecentReplyAuditLogs({ db, limit: 20 }),
  };
  const server = createServer(app);
  const sendReplyWorker = createSendReplyWorker({
    redisUrl: config.redisUrl,
    logger: app.logger,
    stateStore,
    replyAuditStore: {
      updateStatus: (input) =>
        updateReplyAuditLogStatus({
          db,
          ...input,
        }),
    },
    sendGroupMessage: (input) => napCatSender.sendGroupMessage(input),
  });

  app.logger.info(
    {
      event: 'app.startup',
      traceId: createStartupTraceContext().traceId,
      provider: config.defaultProvider,
      llmTransportMode: config.llmTransportMode,
      botName: config.botName,
      activeReplyEnabled: config.activeReplyEnabled,
      napcatBaseUrl: config.napcatBaseUrl,
      port: config.port,
      localEnvFileLoaded: localEnv.loaded,
      localEnvFilePath: localEnv.path,
      localEnvAppliedKeys: localEnv.appliedKeys,
      dependencyStatus,
    },
    'Application startup complete',
  );

  await server.listen({
    host: '0.0.0.0',
    port: config.port,
  });

  server.addHook('onClose', async () => {
    await Promise.allSettled([sendReplyWorker.close(), sendReplyQueue.close(), redisClient.quit(), dbClient.end()]);
  });
} catch (error) {
  const fallbackLogger = createAppContext({
    ...loadConfig({
      PORT: '8787',
      NAPCAT_BASE_URL: 'http://127.0.0.1:3000',
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

function createHeuristicTransport() {
  return async (request: LlmRequest): Promise<LlmResponse> => {
    const messageText =
      request.taskType === 'summary'
        ? extractPromptField(request.prompt, '最近对话：')
        : extractPromptField(request.prompt, '当前消息：');

    return {
      provider: request.provider,
      model: request.model,
      outputText:
        request.taskType === 'summary' ? buildHeuristicSummary(messageText) : buildHeuristicReply(messageText),
      finishReason: 'stop',
    };
  };
}

function extractPromptField(prompt: string, prefix: string): string {
  const line = prompt
    .split('\n')
    .find((item) => item.startsWith(prefix));

  return line ? line.slice(prefix.length).trim() : '';
}

function buildHeuristicReply(messageText: string): string {
  if (messageText.includes('来吗') || messageText.includes('在吗')) {
    return '我在，晚上可以。';
  }

  if (messageText.includes('开黑')) {
    return '可以啊，到时候喊我。';
  }

  if (messageText.includes('怎么看') || messageText.includes('？') || messageText.includes('?')) {
    return '我感觉可以，不过我先想一下细节。';
  }

  return '这个话题我能接上。';
}

function buildHeuristicSummary(messageText: string): string {
  const normalized = messageText
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(-3)
    .join(' / ');

  return normalized.length > 0 ? `最近在聊：${normalized}`.slice(0, 60) : '最近互动比较轻松。';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeMatchType(value: unknown): 'exact' | 'fuzzy' | 'regex' {
  return value === 'fuzzy' || value === 'regex' ? value : 'exact';
}
