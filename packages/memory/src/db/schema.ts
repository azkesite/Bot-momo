import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const keywordMatchTypeEnum = pgEnum('keyword_match_type', ['exact', 'fuzzy', 'regex']);
export const memoryScopeEnum = pgEnum('memory_scope', ['short_term', 'mid_term', 'long_term']);
export const summaryScopeEnum = pgEnum('summary_scope', ['group', 'user']);
export const replyStatusEnum = pgEnum('reply_status', ['queued', 'sent', 'failed']);

export const groups = pgTable(
  'groups',
  {
    id: text('id').primaryKey(),
    platform: text('platform').notNull(),
    externalGroupId: text('external_group_id').notNull(),
    name: text('name'),
    ...timestamps,
  },
  (table) => [uniqueIndex('groups_platform_external_group_idx').on(table.platform, table.externalGroupId)],
);

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    platform: text('platform').notNull(),
    externalUserId: text('external_user_id').notNull(),
    nickname: text('nickname'),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_platform_external_user_idx').on(table.platform, table.externalUserId)],
);

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    platform: text('platform').notNull(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    replyToMessageId: text('reply_to_message_id'),
    content: text('content').notNull(),
    rawPayload: jsonb('raw_payload').notNull(),
    mentionedBot: boolean('mentioned_bot').default(false).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('messages_group_sent_at_idx').on(table.groupId, table.sentAt),
    index('messages_user_sent_at_idx').on(table.userId, table.sentAt),
    index('messages_reply_to_idx').on(table.replyToMessageId),
  ],
);

export const keywordRules = pgTable(
  'keyword_rules',
  {
    id: text('id').primaryKey(),
    keyword: text('keyword').notNull(),
    matchType: keywordMatchTypeEnum('match_type').notNull(),
    priority: integer('priority').notNull().default(100),
    enabled: boolean('enabled').notNull().default(true),
    responseMode: text('response_mode').notNull().default('must_reply'),
    ...timestamps,
  },
  (table) => [
    index('keyword_rules_enabled_priority_idx').on(table.enabled, table.priority),
    uniqueIndex('keyword_rules_keyword_match_type_idx').on(table.keyword, table.matchType),
  ],
);

export const userMemories = pgTable('user_memories', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  nicknameHistory: jsonb('nickname_history').notNull().default([]),
  aliases: jsonb('aliases').notNull().default([]),
  traits: jsonb('traits').notNull().default([]),
  preferences: jsonb('preferences').notNull().default([]),
  relationshipSummary: text('relationship_summary').notNull().default(''),
  lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }),
  ...timestamps,
});

export const memoryFacts = pgTable(
  'memory_facts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: memoryScopeEnum('scope').notNull(),
    fact: text('fact').notNull(),
    sourceMessageId: text('source_message_id').references(() => messages.id, { onDelete: 'set null' }),
    confidence: integer('confidence').notNull().default(100),
    ...timestamps,
  },
  (table) => [
    index('memory_facts_user_scope_idx').on(table.userId, table.scope),
    index('memory_facts_source_message_idx').on(table.sourceMessageId),
  ],
);

export const conversationSummaries = pgTable(
  'conversation_summaries',
  {
    id: text('id').primaryKey(),
    scope: summaryScopeEnum('scope').notNull(),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    summary: text('summary').notNull(),
    sourceMessageCount: integer('source_message_count').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index('conversation_summaries_scope_group_idx').on(table.scope, table.groupId),
    index('conversation_summaries_scope_user_idx').on(table.scope, table.userId),
  ],
);

export const replyLogs = pgTable(
  'reply_logs',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    traceId: text('trace_id').notNull(),
    decisionAction: text('decision_action').notNull(),
    decisionReason: text('decision_reason').notNull(),
    contentPreview: text('content_preview').notNull(),
    status: replyStatusEnum('status').notNull().default('queued'),
    attemptCount: integer('attempt_count').notNull().default(0),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('reply_logs_message_idx').on(table.messageId),
    index('reply_logs_trace_idx').on(table.traceId),
  ],
);

export const schemaTables = {
  groups,
  users,
  messages,
  keywordRules,
  userMemories,
  memoryFacts,
  conversationSummaries,
  replyLogs,
};

export type DatabaseSchema = typeof schemaTables;
