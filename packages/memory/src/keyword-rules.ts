import { and, asc, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createRedisKey, type RedisStateStore } from '@bot-momo/core';

import { keywordRules, type DatabaseSchema } from './db/schema.js';

export type KeywordRuleRecord = {
  id: string;
  keyword: string;
  matchType: 'exact' | 'fuzzy' | 'regex';
  priority: number;
  enabled: boolean;
  responseMode: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type KeywordRuleStore = {
  saveRule: (rule: Omit<KeywordRuleRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  setEnabled: (ruleId: string, enabled: boolean) => Promise<void>;
  listActiveRules: () => Promise<KeywordRuleRecord[]>;
};

export const ACTIVE_KEYWORD_RULES_CACHE_KEY = createRedisKey('short-state', 'keyword-rules', 'active');

export function createKeywordRuleStore(db: NodePgDatabase<DatabaseSchema>): KeywordRuleStore {
  return {
    async saveRule(rule) {
      await db
        .insert(keywordRules)
        .values({
          id: rule.id,
          keyword: rule.keyword,
          matchType: rule.matchType,
          priority: rule.priority,
          enabled: rule.enabled,
          responseMode: rule.responseMode,
        })
        .onConflictDoUpdate({
          target: keywordRules.id,
          set: {
            keyword: rule.keyword,
            matchType: rule.matchType,
            priority: rule.priority,
            enabled: rule.enabled,
            responseMode: rule.responseMode,
            updatedAt: new Date(),
          },
        });
    },

    async setEnabled(ruleId, enabled) {
      await db
        .update(keywordRules)
        .set({
          enabled,
          updatedAt: new Date(),
        })
        .where(eq(keywordRules.id, ruleId));
    },

    async listActiveRules() {
      const records = await db
        .select()
        .from(keywordRules)
        .where(and(eq(keywordRules.enabled, true)))
        .orderBy(asc(keywordRules.priority), desc(keywordRules.updatedAt), asc(keywordRules.keyword));

      return records.map((record) => ({
        id: record.id,
        keyword: record.keyword,
        matchType: record.matchType,
        priority: record.priority,
        enabled: record.enabled,
        responseMode: record.responseMode,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));
    },
  };
}

export async function loadActiveKeywordRules(input: {
  store: Pick<KeywordRuleStore, 'listActiveRules'>;
  cache: Pick<RedisStateStore, 'getJson' | 'setJson'>;
}): Promise<KeywordRuleRecord[]> {
  const cached = await input.cache.getJson<KeywordRuleRecord[]>(ACTIVE_KEYWORD_RULES_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const rules = await input.store.listActiveRules();
  await input.cache.setJson(ACTIVE_KEYWORD_RULES_CACHE_KEY, rules, 'shortTermState');
  return rules;
}

export async function invalidateActiveKeywordRulesCache(
  cache: Pick<RedisStateStore, 'deleteKey'>,
): Promise<void> {
  await cache.deleteKey(ACTIVE_KEYWORD_RULES_CACHE_KEY);
}

export async function saveKeywordRule(input: {
  rule: Omit<KeywordRuleRecord, 'createdAt' | 'updatedAt'>;
  store: Pick<KeywordRuleStore, 'saveRule'>;
  cache: Pick<RedisStateStore, 'deleteKey'>;
}): Promise<void> {
  await input.store.saveRule(input.rule);
  await invalidateActiveKeywordRulesCache(input.cache);
}

export async function setKeywordRuleEnabled(input: {
  ruleId: string;
  enabled: boolean;
  store: Pick<KeywordRuleStore, 'setEnabled'>;
  cache: Pick<RedisStateStore, 'deleteKey'>;
}): Promise<void> {
  await input.store.setEnabled(input.ruleId, input.enabled);
  await invalidateActiveKeywordRulesCache(input.cache);
}
