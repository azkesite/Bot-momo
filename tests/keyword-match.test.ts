import { describe, expect, it } from 'vitest';

import { detectKeywordMatch } from '../packages/decision-engine/src/index.js';

describe('keyword matching', () => {
  it('matches the first active rule by priority order', () => {
    const result = detectKeywordMatch({
      content: '今晚要不要开黑 momo',
      rules: [
        {
          id: 'rule-1',
          keyword: '开黑',
          matchType: 'exact',
          priority: 20,
          enabled: true,
          responseMode: 'must_reply',
        },
        {
          id: 'rule-2',
          keyword: 'momo',
          matchType: 'fuzzy',
          priority: 10,
          enabled: true,
          responseMode: 'must_reply',
        },
      ],
    });

    expect(result).toEqual({
      matched: true,
      reason: 'keyword_hit',
      ruleId: 'rule-2',
      keyword: 'momo',
      matchType: 'fuzzy',
      priority: 10,
      responseMode: 'must_reply',
    });
  });

  it('supports fuzzy and regex matching', () => {
    const fuzzy = detectKeywordMatch({
      content: 'momo你晚上来吗',
      rules: [
        {
          id: 'rule-1',
          keyword: 'momo',
          matchType: 'fuzzy',
          priority: 10,
          enabled: true,
          responseMode: 'must_reply',
        },
      ],
    });
    const regex = detectKeywordMatch({
      content: '今天到底吃什么',
      rules: [
        {
          id: 'rule-2',
          keyword: '^今天.*吃什么$',
          matchType: 'regex',
          priority: 5,
          enabled: true,
          responseMode: 'must_reply',
        },
      ],
    });

    expect(fuzzy).toMatchObject({
      matched: true,
      ruleId: 'rule-1',
      matchType: 'fuzzy',
    });
    expect(regex).toMatchObject({
      matched: true,
      ruleId: 'rule-2',
      matchType: 'regex',
    });
  });

  it('ignores disabled or invalid rules and does not false-positive', () => {
    const disabled = detectKeywordMatch({
      content: '今晚开黑',
      rules: [
        {
          id: 'rule-1',
          keyword: '开黑',
          matchType: 'exact',
          priority: 10,
          enabled: false,
          responseMode: 'must_reply',
        },
      ],
    });
    const invalidRegex = detectKeywordMatch({
      content: '今天吃什么',
      rules: [
        {
          id: 'rule-2',
          keyword: '[',
          matchType: 'regex',
          priority: 10,
          enabled: true,
          responseMode: 'must_reply',
        },
      ],
    });

    expect(disabled).toEqual({
      matched: false,
      reason: 'no_keyword_match',
    });
    expect(invalidRegex).toEqual({
      matched: false,
      reason: 'no_keyword_match',
    });
  });
});
