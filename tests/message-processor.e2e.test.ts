import { describe, expect, it } from 'vitest';

import { createLogger, createTraceContext, type RedisStateStore, type UnifiedMessageEvent } from '@bot-momo/core';
import { createMessageProcessor } from '../apps/bot-server/src/message-processor.js';
import { dispatchReplyTask, type SendReplyTask } from '@bot-momo/sender';
import type {
  ConversationSummaryStore,
  KeywordRuleRecord,
  MemoryFactRecord,
  MessageAuditPersistence,
  ShortContextMessage,
  ShortContextStore,
  UserMemoryProfile,
  UserMemoryStore,
} from '@bot-momo/memory';

describe('message processor e2e', () => {
  it('replies on mention, splits long replies, writes memory and summaries', async () => {
    const harness = createHarness({
      llmText: '我觉得可以，不过你喜欢抹茶这点我先记住。然后周末有空我们再约。',
    });

    const result = await harness.process(
      createEvent({
        content: '@momo 我最喜欢抹茶拿铁',
        mentions: [{ type: 'platform_mention', targetId: 'bot', text: '@momo', isBot: true }],
      }),
    );

    expect(result.status).toBe('sent');
    expect(harness.sentMessages.length).toBeGreaterThan(1);
    expect(harness.memoryFacts).toHaveLength(1);
    expect(harness.userProfiles.get('qq:user:300')?.preferences).toContain('我最喜欢抹茶拿铁');
    expect(harness.summaries.get('qq:group:200:group')?.summary).toContain('最近');
    expect(harness.replyStatuses.at(-1)?.status).toBe('sent');
  });

  it('skips unrelated ordinary chatter', async () => {
    const harness = createHarness({
      llmText: '这条不会被发送',
      activeReplyEnabled: false,
    });

    const result = await harness.process(
      createEvent({
        content: '今天天气不错',
      }),
    );

    expect(result).toEqual({
      status: 'skipped',
      reason: 'not_relevant',
    });
    expect(harness.sentMessages).toHaveLength(0);
  });

  it('replies when keyword rules hit', async () => {
    const harness = createHarness({
      llmText: '我来了，这个关键词我会接。',
      keywordRules: [
        {
          id: 'rule-1',
          keyword: '召唤momo',
          matchType: 'exact',
          priority: 1,
          enabled: true,
          responseMode: 'must_reply',
        },
      ],
      activeReplyEnabled: false,
    });

    const result = await harness.process(
      createEvent({
        content: '召唤momo',
      }),
    );

    expect(result.status).toBe('sent');
    expect(result.reason).toBe('keyword_hit');
    expect(harness.sentMessages).toHaveLength(1);
  });
});

function createHarness(input: {
  llmText: string;
  keywordRules?: KeywordRuleRecord[];
  providerThrows?: boolean;
  sendThrows?: boolean;
  activeReplyEnabled?: boolean;
}) {
  const groupMessages = new Map<string, ShortContextMessage[]>();
  const userMessages = new Map<string, ShortContextMessage[]>();
  const userProfiles = new Map<string, UserMemoryProfile>();
  const memoryFacts: MemoryFactRecord[] = [];
  const summaries = new Map<string, { summary: string; sourceMessageCount: number }>();
  const sentMessages: Array<{ content: string; sentenceIndex?: number }> = [];
  const replyStatuses: Array<{ id: string; status: 'queued' | 'sent' | 'failed'; attemptCount: number }> = [];
  const auditMessageIds = new Set<string>();
  const auditPersistence: MessageAuditPersistence = {
    async upsertGroup() {},
    async upsertUser() {},
    async insertMessage(inputMessage) {
      if (auditMessageIds.has(inputMessage.id)) {
        return 'duplicate';
      }

      auditMessageIds.add(inputMessage.id);
      return 'inserted';
    },
    async getMessageAuditRecord() {
      return null;
    },
  };
  const stateStore: RedisStateStore = {
    async getText(key) {
      return textStore.get(key) ?? null;
    },
    async setText(key, value) {
      textStore.set(key, value);
    },
    async getJson(key) {
      return jsonStore.get(key) ?? null;
    },
    async setJson(key, value) {
      jsonStore.set(key, value);
    },
    async deleteKey(key) {
      textStore.delete(key);
      jsonStore.delete(key);
    },
  };
  const textStore = new Map<string, string>();
  const jsonStore = new Map<string, unknown>();
  const shortContextStore: ShortContextStore = {
    async appendGroupMessage(groupId, message, limit = 20) {
      const next = [...(groupMessages.get(groupId) ?? []), message].slice(-limit);
      groupMessages.set(groupId, next);
      return next;
    },
    async appendUserMessage(groupId, userId, message, limit = 12) {
      const key = `${groupId}:${userId}`;
      const next = [...(userMessages.get(key) ?? []), message].slice(-limit);
      userMessages.set(key, next);
      return next;
    },
    async getGroupMessages(groupId) {
      return groupMessages.get(groupId) ?? [];
    },
    async getUserMessages(groupId, userId) {
      return userMessages.get(`${groupId}:${userId}`) ?? [];
    },
  };
  const userMemoryStore: UserMemoryStore = {
    async getByUserId(userId) {
      return userProfiles.get(userId) ?? null;
    },
    async getOrCreate(inputProfile) {
      const existing = userProfiles.get(inputProfile.userId);

      if (existing) {
        return existing;
      }

      const created: UserMemoryProfile = {
        id: inputProfile.id,
        userId: inputProfile.userId,
        nicknameHistory: inputProfile.nickname ? [inputProfile.nickname] : [],
        aliases: [],
        traits: [],
        preferences: [],
        relationshipSummary: '',
      };
      userProfiles.set(inputProfile.userId, created);
      return created;
    },
    async update(update) {
      const current = userProfiles.get(update.userId);

      if (!current) {
        throw new Error('missing user profile');
      }

      const next: UserMemoryProfile = {
        ...current,
        ...(update.nicknameHistory ? { nicknameHistory: update.nicknameHistory } : {}),
        ...(update.preferences ? { preferences: update.preferences } : {}),
        ...(update.relationshipSummary !== undefined
          ? { relationshipSummary: update.relationshipSummary }
          : {}),
        ...(update.lastInteractionAt ? { lastInteractionAt: update.lastInteractionAt } : {}),
      };
      userProfiles.set(update.userId, next);
      return next;
    },
  };
  const conversationSummaryStore: ConversationSummaryStore = {
    async upsertSummary(summary) {
      summaries.set(
        `${summary.scope === 'group' ? summary.groupId : summary.userId}:${summary.scope}`,
        {
          summary: summary.summary,
          sourceMessageCount: summary.sourceMessageCount,
        },
      );
    },
    async getSummary(summary) {
      const key = `${summary.scope === 'group' ? summary.groupId : summary.userId}:${summary.scope}`;
      const record = summaries.get(key);
      return record
        ? {
            id: `${key}:summary`,
            scope: summary.scope,
            ...(summary.scope === 'group' ? { groupId: summary.groupId } : { userId: summary.userId }),
            summary: record.summary,
            sourceMessageCount: record.sourceMessageCount,
          }
        : null;
    },
  };

  const processor = createMessageProcessor({
    config: {
      botName: 'momo',
      botAliases: ['莫莫'],
      defaultProvider: 'openai',
      activeReplyEnabled: input.activeReplyEnabled ?? false,
      activeReplyBaseProbability: 0.15,
    },
    logger: createLogger({
      level: 'error',
      service: 'bot-server',
    }),
    stateStore,
    auditPersistence,
    replyAuditStore: {
      async create(payload) {
        replyStatuses.push({
          id: payload.replyLogId,
          status: 'queued',
          attemptCount: 0,
        });
      },
      async updateStatus(payload) {
        replyStatuses.push({
          id: payload.replyLogId,
          status: payload.status,
          attemptCount: payload.attemptCount,
        });
      },
    },
    keywordRuleStore: {
      async listActiveRules() {
        return input.keywordRules ?? [];
      },
    },
    userMemoryStore,
    memoryFactStore: {
      async appendFact(fact) {
        memoryFacts.push(fact);
      },
      async listFactsByUser() {
        return memoryFacts;
      },
    },
    shortContextStore,
    conversationSummaryStore,
    llmProvider: {
      async generate(request) {
        if (input.providerThrows) {
          throw new Error('provider failed');
        }

        return {
          provider: 'openai',
          model: 'test-model',
          outputText:
            request.taskType === 'summary'
              ? '最近在聊抹茶偏好和周末约局。'
              : input.llmText,
          finishReason: 'stop',
        };
      },
    },
    sendGroupMessage: async (payload) => {
      if (input.sendThrows) {
        throw new Error('send failed');
      }

      sentMessages.push({
        content: payload.content,
        sentenceIndex: payload.sentenceIndex,
      });

      return {
        status: 'sent',
        platform: 'qq',
        requestId: payload.requestId,
        traceId: payload.traceId,
        sentAt: Date.now(),
        target: {
          platform: 'qq',
          groupId: payload.groupId,
          ...(payload.replyToMessageId ? { replyToMessageId: payload.replyToMessageId } : {}),
        },
      };
    },
    scheduleReplyTask: async (task: SendReplyTask) => {
      const result = await dispatchReplyTask({
        task,
        store: stateStore,
        send: async (payload) => {
          if (input.sendThrows) {
            throw new Error('send failed');
          }

          sentMessages.push({
            content: payload.content,
            sentenceIndex: payload.sentenceIndex,
          });
        },
      });

      return {
        mode: 'sent' as const,
        sentCount: result.sentCount,
      };
    },
    now: () => new Date('2026-04-16T12:00:00.000Z'),
  });

  return {
    process: (event: UnifiedMessageEvent) => processor(event, createTraceContext({
      messageId: event.messageId,
      groupId: event.groupId,
      userId: event.userId,
    })),
    sentMessages,
    memoryFacts,
    userProfiles,
    summaries,
    replyStatuses,
  };
}

function createEvent(overrides: Partial<UnifiedMessageEvent>): UnifiedMessageEvent {
  return {
    eventType: 'message.created',
    platform: 'qq',
    messageId: '100',
    groupId: '200',
    userId: '300',
    nickname: '阿明',
    content: '测试消息',
    timestamp: 1_713_260_800,
    mentions: [],
    rawPayload: {},
    ...overrides,
  };
}
