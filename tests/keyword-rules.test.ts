import { describe, expect, it } from 'vitest';

import type { RedisTtlPolicy } from '../packages/core/src/index.js';
import {
  ACTIVE_KEYWORD_RULES_CACHE_KEY,
  loadActiveKeywordRules,
  saveKeywordRule,
  setKeywordRuleEnabled,
  type KeywordRuleRecord,
  type KeywordRuleStore,
} from '../packages/memory/src/index.js';

class InMemoryRedisCache {
  private readonly values = new Map<string, string>();

  async getJson<T>(key: string): Promise<T | null> {
    const raw = this.values.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson<T>(key: string, value: T, _ttlPolicy?: RedisTtlPolicy): Promise<void> {
    this.values.set(key, JSON.stringify(value));
  }

  async deleteKey(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class InMemoryKeywordRuleStore implements KeywordRuleStore {
  readonly rules = new Map<string, KeywordRuleRecord>();
  listCallCount = 0;

  async saveRule(rule: Omit<KeywordRuleRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date('2026-04-16T00:00:00.000Z');
    const existing = this.rules.get(rule.id);

    this.rules.set(rule.id, {
      ...rule,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async setEnabled(ruleId: string, enabled: boolean): Promise<void> {
    const current = this.rules.get(ruleId);

    if (!current) {
      return;
    }

    this.rules.set(ruleId, {
      ...current,
      enabled,
      updatedAt: new Date('2026-04-16T00:00:01.000Z'),
    });
  }

  async listActiveRules(): Promise<KeywordRuleRecord[]> {
    this.listCallCount += 1;

    return [...this.rules.values()]
      .filter((rule) => rule.enabled)
      .sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority - right.priority;
        }

        return left.keyword.localeCompare(right.keyword);
      });
  }
}

describe('keyword rule storage and cache', () => {
  it('stores active rules in priority order and loads them through the cache boundary', async () => {
    const store = new InMemoryKeywordRuleStore();
    const cache = new InMemoryRedisCache();

    await saveKeywordRule({
      rule: {
        id: 'rule-1',
        keyword: '开黑',
        matchType: 'exact',
        priority: 20,
        enabled: true,
        responseMode: 'must_reply',
      },
      store,
      cache,
    });
    await saveKeywordRule({
      rule: {
        id: 'rule-2',
        keyword: 'momo',
        matchType: 'fuzzy',
        priority: 10,
        enabled: true,
        responseMode: 'must_reply',
      },
      store,
      cache,
    });

    const firstLoad = await loadActiveKeywordRules({
      store,
      cache,
    });
    const secondLoad = await loadActiveKeywordRules({
      store,
      cache,
    });

    expect(firstLoad.map((rule) => rule.id)).toEqual(['rule-2', 'rule-1']);
    expect(secondLoad.map((rule) => rule.id)).toEqual(['rule-2', 'rule-1']);
    expect(store.listCallCount).toBe(1);
    expect(await cache.getJson(ACTIVE_KEYWORD_RULES_CACHE_KEY)).toMatchObject([
      {
        id: 'rule-2',
        keyword: 'momo',
        matchType: 'fuzzy',
        priority: 10,
        enabled: true,
        responseMode: 'must_reply',
      },
      {
        id: 'rule-1',
        keyword: '开黑',
        matchType: 'exact',
        priority: 20,
        enabled: true,
        responseMode: 'must_reply',
      },
    ]);
  });

  it('does not return disabled rules after toggling enable state', async () => {
    const store = new InMemoryKeywordRuleStore();
    const cache = new InMemoryRedisCache();

    await saveKeywordRule({
      rule: {
        id: 'rule-1',
        keyword: '开黑',
        matchType: 'exact',
        priority: 20,
        enabled: true,
        responseMode: 'must_reply',
      },
      store,
      cache,
    });
    await saveKeywordRule({
      rule: {
        id: 'rule-2',
        keyword: '夜宵',
        matchType: 'regex',
        priority: 5,
        enabled: true,
        responseMode: 'must_reply',
      },
      store,
      cache,
    });

    await loadActiveKeywordRules({ store, cache });
    await setKeywordRuleEnabled({
      ruleId: 'rule-2',
      enabled: false,
      store,
      cache,
    });

    const rules = await loadActiveKeywordRules({
      store,
      cache,
    });

    expect(rules.map((rule) => rule.id)).toEqual(['rule-1']);
  });

  it('keeps rule metadata for different match types without changing it during reads', async () => {
    const store = new InMemoryKeywordRuleStore();
    const cache = new InMemoryRedisCache();

    await saveKeywordRule({
      rule: {
        id: 'rule-1',
        keyword: '^今天.*吃什么$',
        matchType: 'regex',
        priority: 1,
        enabled: true,
        responseMode: 'must_reply',
      },
      store,
      cache,
    });

    const [rule] = await loadActiveKeywordRules({
      store,
      cache,
    });

    expect(rule).toMatchObject({
      id: 'rule-1',
      keyword: '^今天.*吃什么$',
      matchType: 'regex',
      priority: 1,
      enabled: true,
      responseMode: 'must_reply',
    });
  });
});
