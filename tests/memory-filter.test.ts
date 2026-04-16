import { describe, expect, it } from 'vitest';

import { classifyMemoryCandidate } from '../packages/memory/src/index.js';

describe('memory candidate filter', () => {
  it('classifies explicit preferences as long-term memory candidates', () => {
    expect(classifyMemoryCandidate('我最喜欢开黑和吃火锅')).toEqual({
      scope: 'long_term',
      reason: 'explicit_preference',
      confidence: 0.88,
    });
  });

  it('classifies explicit plans as mid-term memory candidates', () => {
    expect(classifyMemoryCandidate('我下周要考证，最近在复习')).toEqual({
      scope: 'mid_term',
      reason: 'explicit_plan',
      confidence: 0.84,
    });
  });

  it('rejects sensitive information from long-term memory', () => {
    expect(classifyMemoryCandidate('我手机号是13812345678')).toEqual({
      scope: 'discard',
      reason: 'sensitive',
      confidence: 1,
    });
  });

  it('drops trivial small talk and keeps ordinary chat as short-term only', () => {
    expect(classifyMemoryCandidate('哈哈哈哈')).toEqual({
      scope: 'discard',
      reason: 'small_talk',
      confidence: 0.95,
    });
    expect(classifyMemoryCandidate('今晚可能会晚一点上线')).toEqual({
      scope: 'short_term',
      reason: 'recent_context_only',
      confidence: 0.45,
    });
  });
});
