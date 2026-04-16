import { describe, expect, it } from 'vitest';

import {
  conversationSummaries,
  groups,
  keywordRules,
  memoryFacts,
  messages,
  replyLogs,
  userMemories,
  users,
} from '../packages/memory/src/db/schema.js';

describe('database schema', () => {
  it('exports the expected MVP tables', () => {
    expect(groups[Symbol.for('drizzle:Name')]).toBe('groups');
    expect(users[Symbol.for('drizzle:Name')]).toBe('users');
    expect(messages[Symbol.for('drizzle:Name')]).toBe('messages');
    expect(keywordRules[Symbol.for('drizzle:Name')]).toBe('keyword_rules');
    expect(userMemories[Symbol.for('drizzle:Name')]).toBe('user_memories');
    expect(memoryFacts[Symbol.for('drizzle:Name')]).toBe('memory_facts');
    expect(conversationSummaries[Symbol.for('drizzle:Name')]).toBe('conversation_summaries');
    expect(replyLogs[Symbol.for('drizzle:Name')]).toBe('reply_logs');
  });
});
