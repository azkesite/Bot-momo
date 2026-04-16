import { loadConfig } from '@bot-momo/config';
import { decideReply } from '@bot-momo/decision-engine';
import {
  connectRedisClient,
  createRedisClient,
  createRedisStateStore,
  logMemoryWrite,
  logProcessingError,
  registerRedisLogging,
} from '@bot-momo/core';
import { createLlmProvider, generateReply, type LlmRequest, type LlmResponse } from '@bot-momo/llm';
import {
  createKeywordRuleStore,
  createDatabaseClient,
  createMessageAuditPersistence,
  createReplyAuditLog,
  createShortContextMessage,
  createShortContextStore,
  createUserMemoryStore,
  loadActiveKeywordRules,
  persistIncomingMessageEvent,
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
  buildPlaceholderReply,
  createSendSchedule,
  dispatchReplyTask,
  shouldSendPlaceholder,
  splitReplyText,
} from '@bot-momo/sender';

try {
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
  const shortContextStore = createShortContextStore(stateStore);
  const napCatSender = createNapCatSender(config);
  const llmProvider = createLlmProvider(createHeuristicTransport());
  const server = createServer(app);
  const dependencyStatus = getDependencyStatus(config);

  app.onNapCatEvent = async (event, trace) => {
    const result = await persistIncomingMessageEvent({
      event,
      dedupeStore: stateStore,
      persistence: auditPersistence,
    });

    if (result.status !== 'inserted') {
      return;
    }

    const existingGroupContext = await shortContextStore.getGroupMessages(event.groupId);
    const existingUserContext = await shortContextStore.getUserMessages(event.groupId, event.userId);
    const userMemory = await userMemoryStore.getOrCreate({
      id: `${result.userRecordId}:memory`,
      userId: result.userRecordId,
      nickname: event.nickname,
    });
    const keywordRules = await loadActiveKeywordRules({
      store: keywordRuleStore,
      cache: stateStore,
    });
    const replyContext = mergeUniqueStrings(
      existingGroupContext
        .slice(-4)
        .map((message) => `${message.nickname}: ${message.content}`),
      existingUserContext
        .slice(-2)
        .map((message) => `${message.nickname}: ${message.content}`),
    );

    const decision = decideReply({
      event,
      identity: {
        botName: config.botName,
        botAliases: config.botAliases,
      },
      keywordRules,
      activeReply: {
        enabled: config.activeReplyEnabled,
        baseProbability: config.activeReplyBaseProbability,
      },
    });

    const replyLogId = `${result.persistedMessageId}:reply`;

    await createReplyAuditLog({
      db,
      replyLogId,
      persistedMessageId: result.persistedMessageId,
      traceId: trace.traceId,
      decisionAction: decision.action,
      decisionReason: decision.reason,
      contentPreview: event.content.slice(0, 80),
    });

    await shortContextStore.appendGroupMessage(event.groupId, createShortContextMessage(event));
    await shortContextStore.appendUserMessage(event.groupId, event.userId, createShortContextMessage(event));

    if (decision.action === 'skip') {
      return;
    }

    try {
      if (shouldSendPlaceholder({ isMention: decision.reason === 'mentioned', expectedWaitMs: 0 })) {
        await napCatSender.sendGroupMessage({
          groupId: event.groupId,
          content: buildPlaceholderReply(),
          requestId: `${replyLogId}:placeholder`,
          replyToMessageId: event.messageId,
          traceId: trace.traceId,
        });
      }

      const reply = await generateReply({
        provider: llmProvider,
        providerName: config.defaultProvider,
        model: 'default-chat-model',
        messageText: event.content,
        botName: config.botName,
        decisionReason: decision.reason,
        shortContext: replyContext,
        memorySummary: userMemory.relationshipSummary,
        timeoutMs: 800,
      });

      const split = splitReplyText(reply.text);
      const schedule = createSendSchedule(split.sentences);

      await dispatchReplyTask({
        task: {
          messageId: event.messageId,
          taskId: replyLogId,
          groupId: event.groupId,
          replyToMessageId: event.messageId,
          traceId: trace.traceId,
          sentences: schedule,
        },
        store: stateStore,
        send: async (sendInput) => {
          await napCatSender.sendGroupMessage(sendInput);
        },
      });

      await updateReplyAuditLogStatus({
        db,
        replyLogId,
        status: 'sent',
        attemptCount: schedule.length,
        contentPreview: reply.text.slice(0, 80),
        sentAt: new Date(),
      });

      await shortContextStore.appendGroupMessage(event.groupId, {
        messageId: `${event.messageId}:bot`,
        userId: 'bot',
        nickname: config.botName,
        content: reply.text,
        timestamp: Math.trunc(Date.now() / 1000),
        mentionedBot: false,
      });
      await shortContextStore.appendUserMessage(event.groupId, event.userId, {
        messageId: `${event.messageId}:bot`,
        userId: 'bot',
        nickname: config.botName,
        content: reply.text,
        timestamp: Math.trunc(Date.now() / 1000),
        mentionedBot: false,
      });

      await userMemoryStore.update({
        id: `${result.userRecordId}:memory`,
        userId: result.userRecordId,
        nicknameHistory: mergeUniqueStrings(userMemory.nicknameHistory, [event.nickname]),
        lastInteractionAt: new Date(),
      });

      logMemoryWrite(app.logger, {
        ...trace,
        messageId: event.messageId,
        groupId: event.groupId,
        userId: event.userId,
        memoryScope: 'short_term',
        summary: `Generated and sent reply for ${result.persistedMessageId}.`,
      });
    } catch (error) {
      await updateReplyAuditLogStatus({
        db,
        replyLogId,
        status: 'failed',
        attemptCount: 1,
        contentPreview: event.content.slice(0, 80),
      });

      throw error;
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

function createHeuristicTransport() {
  return async (request: LlmRequest): Promise<LlmResponse> => {
    const messageText = extractPromptField(request.prompt, '当前消息：');

    return {
      provider: request.provider,
      model: request.model,
      outputText: buildHeuristicReply(messageText),
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

function mergeUniqueStrings(current: string[], incoming: string[]): string[] {
  return [...new Set([...current, ...incoming.map((item) => item.trim()).filter((item) => item.length > 0)])];
}
