export type KeywordMatchType = 'exact' | 'fuzzy' | 'regex';

export type KeywordRuleInput = {
  id: string;
  keyword: string;
  matchType: KeywordMatchType;
  priority: number;
  enabled: boolean;
  responseMode: string;
};

export type KeywordMatchResult =
  | {
      matched: true;
      reason: 'keyword_hit';
      ruleId: string;
      keyword: string;
      matchType: KeywordMatchType;
      priority: number;
      responseMode: string;
    }
  | {
      matched: false;
      reason: 'no_keyword_match';
    };

export function detectKeywordMatch(input: {
  content: string;
  rules: KeywordRuleInput[];
}): KeywordMatchResult {
  const normalizedContent = normalizeText(input.content);

  const matchedRule = input.rules
    .filter((rule) => rule.enabled)
    .sort((left, right) => left.priority - right.priority)
    .find((rule) => isRuleMatched(normalizedContent, rule));

  if (!matchedRule) {
    return {
      matched: false,
      reason: 'no_keyword_match',
    };
  }

  return {
    matched: true,
    reason: 'keyword_hit',
    ruleId: matchedRule.id,
    keyword: matchedRule.keyword,
    matchType: matchedRule.matchType,
    priority: matchedRule.priority,
    responseMode: matchedRule.responseMode,
  };
}

function isRuleMatched(content: string, rule: KeywordRuleInput): boolean {
  const keyword = rule.matchType === 'regex' ? rule.keyword : normalizeText(rule.keyword);

  if (keyword.length === 0) {
    return false;
  }

  if (rule.matchType === 'exact') {
    return content.includes(keyword);
  }

  if (rule.matchType === 'fuzzy') {
    return content.includes(keyword);
  }

  try {
    return new RegExp(rule.keyword, 'iu').test(content);
  } catch {
    return false;
  }
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}
