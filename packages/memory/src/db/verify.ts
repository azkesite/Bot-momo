import { eq } from 'drizzle-orm';

import { createDatabaseClient } from './client.js';
import {
  conversationSummaries,
  groups,
  keywordRules,
  messages,
  replyLogs,
  users,
  userMemories,
} from './schema.js';

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo';

  const { client, db } = await createDatabaseClient(connectionString);

  try {
    await db.insert(groups).values({
      id: 'group-1',
      platform: 'qq',
      externalGroupId: '10001',
      name: 'Test Group',
    });

    await db.insert(users).values({
      id: 'user-1',
      platform: 'qq',
      externalUserId: '20001',
      nickname: 'tester',
    });

    await db.insert(messages).values({
      id: 'message-1',
      platform: 'qq',
      groupId: 'group-1',
      userId: 'user-1',
      content: '@momo 今晚有空吗',
      rawPayload: {
        text: '@momo 今晚有空吗',
      },
      mentionedBot: true,
      sentAt: new Date(),
    });

    await db.insert(keywordRules).values({
      id: 'keyword-1',
      keyword: '开黑',
      matchType: 'exact',
      priority: 10,
      enabled: true,
      responseMode: 'must_reply',
    });

    await db.insert(userMemories).values({
      id: 'memory-1',
      userId: 'user-1',
      nicknameHistory: ['tester'],
      aliases: ['老哥'],
      traits: ['爱聊天'],
      preferences: ['开黑'],
      relationshipSummary: '初始测试数据',
      lastInteractionAt: new Date(),
    });

    await db.insert(conversationSummaries).values({
      id: 'summary-1',
      scope: 'group',
      groupId: 'group-1',
      summary: '群里在讨论今晚要不要开黑。',
      sourceMessageCount: 1,
    });

    await db.insert(replyLogs).values({
      id: 'reply-1',
      messageId: 'message-1',
      traceId: 'trace-1',
      decisionAction: 'must_reply',
      decisionReason: 'mentioned',
      contentPreview: '在的，晚上有空。',
      status: 'queued',
      attemptCount: 1,
    });

    const insertedMessage = await db.query.messages.findFirst({
      where: eq(messages.id, 'message-1'),
    });

    if (!insertedMessage) {
      throw new Error('Migration verification failed: message row was not inserted.');
    }

    console.log(
      JSON.stringify({
        ok: true,
        verifiedTables: [
          'groups',
          'users',
          'messages',
          'keyword_rules',
          'user_memories',
          'conversation_summaries',
          'reply_logs',
        ],
        insertedMessageId: insertedMessage.id,
      }),
    );
  } finally {
    await client.end();
  }
}

void main();
