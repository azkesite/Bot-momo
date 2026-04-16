import { describe, expect, it } from 'vitest';

import { createLogger, createTraceContext, type RedisStateStore, type UnifiedMessageEvent } from '@bot-momo/core';
import { createMessageProcessor } from '../apps/bot-server/src/message-processor.js';
import type { ConversationSummaryStore, MessageAuditPersistence, ShortContextStore, UserMemoryStore } from '@bot-momo/memory';

describe('message processor degradation', () => {
  it('falls back to a short reply when llm generation fails', async () => {
    const { process, sentMessages } = createMinimalHarness({
      providerThrows: true,
    });

    const result = await process(
      createEvent({
        content: '@momo 在吗',
        mentions: [{ type: 'platform_mention', targetId: 'bot', text: '@momo', isBot: true }],
      }),
    );

    expect(result.status).toBe('sent');
    expect(sentMessages[0]?.content).toContain('我在');
  });

  it('marks reply audit as failed when sending throws', async () => {
    const { process, replyStatuses } = createMinimalHarness({
      sendThrows: true,
    });

    await expect(
      process(
        createEvent({
          content: '@momo 在吗',
          mentions: [{ type: 'platform_mention', targetId: 'bot', text: '@momo', isBot: true }],
        }),
      ),
    ).rejects.toThrow('send failed');

    expect(replyStatuses.at(-1)?.status).toBe('failed');
  });
});

function createMinimalHarness(input: { providerThrows?: boolean; sendThrows?: boolean }) {
  const textStore = new Map<string, string>();
  const jsonStore = new Map<string, unknown>();
  const replyStatuses: Array<{ status: 'queued' | 'sent' | 'failed' }> = [];
  const sentMessages: Array<{ content: string }> = [];
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
  const shortContextStore: ShortContextStore = {
    async appendGroupMessage(_groupId, message) {
      return [message];
    },
    async appendUserMessage(_groupId, _userId, message) {
      return [message];
    },
    async getGroupMessages() {
      return [];
    },
    async getUserMessages() {
      return [];
    },
  };
  const userMemoryStore: UserMemoryStore = {
    async getByUserId() {
      return null;
    },
    async getOrCreate(inputProfile) {
      return {
        id: inputProfile.id,
        userId: inputProfile.userId,
        nicknameHistory: inputProfile.nickname ? [inputProfile.nickname] : [],
        aliases: [],
        traits: [],
        preferences: [],
        relationshipSummary: '',
      };
    },
    async update(inputProfile) {
      return {
        id: inputProfile.id,
        userId: inputProfile.userId,
        nicknameHistory: inputProfile.nicknameHistory ?? [],
        aliases: [],
        traits: [],
        preferences: inputProfile.preferences ?? [],
        relationshipSummary: inputProfile.relationshipSummary ?? '',
        lastInteractionAt: inputProfile.lastInteractionAt,
      };
    },
  };
  const conversationSummaryStore: ConversationSummaryStore = {
    async upsertSummary() {},
    async getSummary() {
      return null;
    },
  };
  const auditPersistence: MessageAuditPersistence = {
    async upsertGroup() {},
    async upsertUser() {},
    async insertMessage() {
      return 'inserted';
    },
    async getMessageAuditRecord() {
      return null;
    },
  };

  const processor = createMessageProcessor({
    config: {
      botName: 'momo',
      botAliases: [],
      defaultProvider: 'openai',
      activeReplyEnabled: false,
      activeReplyBaseProbability: 0.15,
    },
    logger: createLogger({
      level: 'error',
      service: 'bot-server',
    }),
    stateStore,
    auditPersistence,
    replyAuditStore: {
      async create() {
        replyStatuses.push({ status: 'queued' });
      },
      async updateStatus(payload) {
        replyStatuses.push({ status: payload.status });
      },
    },
    keywordRuleStore: {
      async listActiveRules() {
        return [];
      },
    },
    userMemoryStore,
    memoryFactStore: {
      async appendFact() {},
      async listFactsByUser() {
        return [];
      },
    },
    shortContextStore,
    conversationSummaryStore,
    llmProvider: {
      async generate() {
        if (input.providerThrows) {
          throw new Error('provider failed');
        }

        return {
          provider: 'openai',
          model: 'reply-model',
          outputText: '我在，刚看到。',
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
        },
      };
    },
  });

  return {
    process: (event: UnifiedMessageEvent) =>
      processor(
        event,
        createTraceContext({
          messageId: event.messageId,
          groupId: event.groupId,
          userId: event.userId,
        }),
      ),
    sentMessages,
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
