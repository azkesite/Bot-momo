export type MemoryCandidateScope = 'discard' | 'short_term' | 'mid_term' | 'long_term';

export type MemoryCandidateResult = {
  scope: MemoryCandidateScope;
  reason:
    | 'empty'
    | 'small_talk'
    | 'sensitive'
    | 'explicit_preference'
    | 'explicit_plan'
    | 'stable_fact'
    | 'recent_context_only';
  confidence: number;
};

const SMALL_TALK_PATTERNS = ['哈哈', '哦哦', '嗯嗯', '收到', '好的', '牛', '6', 'hhh'];
const PREFERENCE_PATTERNS = ['喜欢', '爱玩', '爱吃', '平时都', '最喜欢', '偏好'];
const PLAN_PATTERNS = ['明天要', '下周要', '准备', '打算', '计划', '要去', '要考'];
const FACT_PATTERNS = ['我是', '我在', '我做', '我已经', '我最近'];
const PHONE_PATTERN = /1[3-9]\d{9}/u;
const ID_CARD_PATTERN = /\d{17}[\dXx]/u;
const ADDRESS_PATTERNS = ['住在', '家庭住址', '详细地址', '小区', '门牌'];

export function classifyMemoryCandidate(content: string): MemoryCandidateResult {
  const normalized = content.trim();

  if (normalized.length === 0) {
    return {
      scope: 'discard',
      reason: 'empty',
      confidence: 1,
    };
  }

  if (containsSensitiveInfo(normalized)) {
    return {
      scope: 'discard',
      reason: 'sensitive',
      confidence: 1,
    };
  }

  if (SMALL_TALK_PATTERNS.some((pattern) => normalized === pattern || normalized.includes(pattern))) {
    return {
      scope: 'discard',
      reason: 'small_talk',
      confidence: 0.95,
    };
  }

  if (PREFERENCE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return {
      scope: 'long_term',
      reason: 'explicit_preference',
      confidence: 0.88,
    };
  }

  if (PLAN_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return {
      scope: 'mid_term',
      reason: 'explicit_plan',
      confidence: 0.84,
    };
  }

  if (FACT_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return {
      scope: 'mid_term',
      reason: 'stable_fact',
      confidence: 0.75,
    };
  }

  return {
    scope: 'short_term',
    reason: 'recent_context_only',
    confidence: 0.45,
  };
}

function containsSensitiveInfo(content: string): boolean {
  if (PHONE_PATTERN.test(content) || ID_CARD_PATTERN.test(content)) {
    return true;
  }

  return ADDRESS_PATTERNS.some((pattern) => content.includes(pattern));
}
