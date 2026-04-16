import type { AppConfig } from '@bot-momo/config';
import { decideReply } from '@bot-momo/decision-engine';
import {
  logMemoryWrite,
  logProcessingError,
  logReplyDecision,
  logSendTaskQueued,
  type RedisStateStore,
  type TraceContext,
  type UnifiedMessageEvent,
  type UnifiedSendResult,
} from '@bot-momo/core';
import { generateReply, generateSummary, type LlmRequest, type LlmResponse } from '@bot-momo/llm';
import {
  buildMemoryWritebackPlan,
  createShortContextMessage,
  loadActiveKeywordRules,
  persistIncomingMessageEvent,
  type ConversationSummaryStore,
  type KeywordRuleStore,
  type MemoryFactStore,
  type MessageAuditPersistence,
  type ShortContextStore,
  type UserMemoryStore,
} from '@bot-momo/memory';
import {
  buildPlaceholderReply,
  createSendSchedule,
  dispatchReplyTask,
  shouldSendPlaceholder,
  splitReplyText,
} from '@bot-momo/sender';
import type { Logger } from 'pino';

type ProviderLike = {
  generate: (request: LlmRequest) => Promise<LlmResponse>;
};

export type MessageProcessorDependencies = {
  config: Pick<
    AppConfig,
    'activeReplyBaseProbability' | 'activeReplyEnabled' | 'botAliases' | 'botName' | 'defaultProvider'
  >;
  logger: Logger;
  stateStore: RedisStateStore;
  auditPersistence: MessageAuditPersistence;
  replyAuditStore: {
    create: (input: {
      replyLogId: string;
      persistedMessageId: string;
      traceId: string;
      decisionAction: string;
      decisionReason: string;
      contentPreview: string;
    }) => Promise<void>;
    updateStatus: (input: {
      replyLogId: string;
      status: 'queued' | 'sent' | 'failed';
      attemptCount: number;
      contentPreview?: string;
      sentAt?: Date;
    }) => Promise<void>;
  };
  keywordRuleStore: Pick<KeywordRuleStore, 'listActiveRules'>;
  userMemoryStore: UserMemoryStore;
  memoryFactStore: MemoryFactStore;
  shortContextStore: ShortContextStore;
  conversationSummaryStore: ConversationSummaryStore;
  llmProvider: ProviderLike;
  sendGroupMessage: (input: {
    groupId: string;
    content: string;
    requestId: string;
    replyToMessageId?: string;
    traceId: string;
    sentenceIndex?: number;
    sentenceCount?: number;
  }) => Promise<UnifiedSendResult>;
  now?: () => Date;
  replyModel?: string;
  summaryModel?: string;
};

export type MessageProcessingResult = {
  status: 'skipped' | 'sent';
  reason: string;
  replyText?: string;
  sentCount?: number;
};

export function createMessageProcessor(deps: MessageProcessorDependencies) {
  const now = deps.now ?? (() => new Date());

  return async function processMessage(
    event: UnifiedMessageEvent,
    trace: TraceContext,
  ): Promise<MessageProcessingResult> {
    const result = await persistIncomingMessageEvent({
      event,
      dedupeStore: deps.stateStore,
      persistence: deps.auditPersistence,
    });

    if (result.status !== 'inserted') {
      return {
        status: 'skipped',
        reason: 'duplicate_incoming_message',
      };
    }

    const existingGroupContext = await deps.shortContextStore.getGroupMessages(event.groupId);
    const existingUserContext = await deps.shortContextStore.getUserMessages(event.groupId, event.userId);
    const userMemory = await deps.userMemoryStore.getOrCreate({
      id: `${result.userRecordId}:memory`,
      userId: result.userRecordId,
      nickname: event.nickname,
    });
    const keywordRules = await loadActiveKeywordRules({
      store: deps.keywordRuleStore,
      cache: deps.stateStore,
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
        botName: deps.config.botName,
        botAliases: deps.config.botAliases,
      },
      keywordRules,
      activeReply: {
        enabled: deps.config.activeReplyEnabled,
        baseProbability: deps.config.activeReplyBaseProbability,
      },
    });

    logReplyDecision(deps.logger, {
      ...trace,
      messageId: event.messageId,
      groupId: event.groupId,
      userId: event.userId,
      action: decision.action,
      reason: decision.reason,
      confidence: decision.confidence,
    });

    const replyLogId = `${result.persistedMessageId}:reply`;

    await deps.replyAuditStore.create({
      replyLogId,
      persistedMessageId: result.persistedMessageId,
      traceId: trace.traceId,
      decisionAction: decision.action,
      decisionReason: decision.reason,
      contentPreview: event.content.slice(0, 80),
    });

    await deps.shortContextStore.appendGroupMessage(event.groupId, createShortContextMessage(event));
    await deps.shortContextStore.appendUserMessage(
      event.groupId,
      event.userId,
      createShortContextMessage(event),
    );

    if (decision.action === 'skip') {
      return {
        status: 'skipped',
        reason: decision.reason,
      };
    }

    try {
      if (shouldSendPlaceholder({ isMention: decision.reason === 'mentioned', expectedWaitMs: 0 })) {
        await deps.sendGroupMessage({
          groupId: event.groupId,
          content: buildPlaceholderReply(),
          requestId: `${replyLogId}:placeholder`,
          replyToMessageId: event.messageId,
          traceId: trace.traceId,
        });
      }

      const reply = await generateReply({
        provider: deps.llmProvider,
        providerName: deps.config.defaultProvider,
        model: deps.replyModel ?? 'default-chat-model',
        messageText: event.content,
        botName: deps.config.botName,
        decisionReason: decision.reason,
        shortContext: replyContext,
        memorySummary: userMemory.relationshipSummary,
        timeoutMs: 800,
      });

      const split = splitReplyText(reply.text);
      const schedule = createSendSchedule(split.sentences);

      logSendTaskQueued(deps.logger, {
        ...trace,
        messageId: event.messageId,
        groupId: event.groupId,
        userId: event.userId,
        taskId: replyLogId,
        sentenceCount: schedule.length,
        ...(schedule[1]?.delayMs !== undefined ? { delayMs: schedule[1].delayMs } : {}),
      });

      const dispatchResult = await dispatchReplyTask({
        task: {
          messageId: event.messageId,
          taskId: replyLogId,
          groupId: event.groupId,
          replyToMessageId: event.messageId,
          traceId: trace.traceId,
          sentences: schedule,
        },
        store: deps.stateStore,
        send: async (input) => {
          await deps.sendGroupMessage(input);
        },
      });

      await deps.replyAuditStore.updateStatus({
        replyLogId,
        status: 'sent',
        attemptCount: schedule.length,
        contentPreview: reply.text.slice(0, 80),
        sentAt: now(),
      });

      const botMessage = {
        messageId: `${event.messageId}:bot`,
        userId: 'bot',
        nickname: deps.config.botName,
        content: reply.text,
        timestamp: Math.trunc(now().getTime() / 1000),
        mentionedBot: false,
      };

      await deps.shortContextStore.appendGroupMessage(event.groupId, botMessage);
      await deps.shortContextStore.appendUserMessage(event.groupId, event.userId, botMessage);

      const writebackPlan = buildMemoryWritebackPlan({
        messageText: event.content,
        replyText: reply.text,
        nickname: event.nickname,
        currentProfile: userMemory,
        now: now(),
      });

      await deps.userMemoryStore.update({
        id: `${result.userRecordId}:memory`,
        userId: result.userRecordId,
        nicknameHistory: writebackPlan.profileUpdate.nicknameHistory,
        ...(writebackPlan.profileUpdate.preferences
          ? { preferences: writebackPlan.profileUpdate.preferences }
          : {}),
        relationshipSummary: writebackPlan.profileUpdate.relationshipSummary,
        lastInteractionAt: writebackPlan.profileUpdate.lastInteractionAt,
      });

      if (writebackPlan.factToPersist) {
        await deps.memoryFactStore.appendFact({
          id: `${replyLogId}:fact`,
          userId: result.userRecordId,
          scope: writebackPlan.factToPersist.scope,
          fact: writebackPlan.factToPersist.fact,
          sourceMessageId: result.persistedMessageId,
          confidence: writebackPlan.factToPersist.confidence,
        });

        logMemoryWrite(deps.logger, {
          ...trace,
          messageId: event.messageId,
          groupId: event.groupId,
          userId: event.userId,
          memoryScope: writebackPlan.factToPersist.scope,
          summary: writebackPlan.factToPersist.fact,
        });
      }

      const refreshedGroupContext = await deps.shortContextStore.getGroupMessages(event.groupId);
      const refreshedUserContext = await deps.shortContextStore.getUserMessages(event.groupId, event.userId);
      const existingGroupSummary =
        (await deps.conversationSummaryStore.getSummary({
          scope: 'group',
          groupId: result.groupRecordId,
        }))?.summary ?? '';
      const existingUserSummary =
        (await deps.conversationSummaryStore.getSummary({
          scope: 'user',
          userId: result.userRecordId,
        }))?.summary ?? '';

      const [groupSummary, userSummary] = await Promise.all([
        generateSummary({
          provider: deps.llmProvider,
          providerName: deps.config.defaultProvider,
          model: deps.summaryModel ?? 'default-summary-model',
          scope: 'group',
          recentMessages: refreshedGroupContext
            .slice(-6)
            .map((message) => `${message.nickname}: ${message.content}`),
          existingSummary: existingGroupSummary,
          timeoutMs: 600,
        }),
        generateSummary({
          provider: deps.llmProvider,
          providerName: deps.config.defaultProvider,
          model: deps.summaryModel ?? 'default-summary-model',
          scope: 'user',
          recentMessages: refreshedUserContext
            .slice(-6)
            .map((message) => `${message.nickname}: ${message.content}`),
          existingSummary: existingUserSummary,
          timeoutMs: 600,
        }),
      ]);

      await Promise.all([
        deps.conversationSummaryStore.upsertSummary({
          id: `${result.groupRecordId}:summary`,
          scope: 'group',
          groupId: result.groupRecordId,
          summary: groupSummary.text,
          sourceMessageCount: refreshedGroupContext.length,
        }),
        deps.conversationSummaryStore.upsertSummary({
          id: `${result.userRecordId}:summary`,
          scope: 'user',
          userId: result.userRecordId,
          summary: userSummary.text,
          sourceMessageCount: refreshedUserContext.length,
        }),
      ]);

      logMemoryWrite(deps.logger, {
        ...trace,
        messageId: event.messageId,
        groupId: event.groupId,
        userId: event.userId,
        memoryScope: 'summary',
        summary: groupSummary.text,
      });

      return {
        status: 'sent',
        reason: decision.reason,
        replyText: reply.text,
        sentCount: dispatchResult.sentCount,
      };
    } catch (error) {
      await deps.replyAuditStore.updateStatus({
        replyLogId,
        status: 'failed',
        attemptCount: 1,
        contentPreview: event.content.slice(0, 80),
      });

      logProcessingError(deps.logger, {
        ...trace,
        messageId: event.messageId,
        groupId: event.groupId,
        userId: event.userId,
        phase: 'send',
        err: error instanceof Error ? error : new Error('Unknown message processing error'),
      });

      throw error;
    }
  };
}

function mergeUniqueStrings(current: string[], incoming: string[]): string[] {
  return [...new Set([...current, ...incoming.map((item) => item.trim()).filter((item) => item.length > 0)])];
}
