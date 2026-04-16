import { describe, expect, it } from 'vitest';

import { splitReplyText } from '../packages/sender/src/index.js';

describe('sentence split strategy', () => {
  it('keeps short replies as a single sentence', () => {
    const result = splitReplyText('行，我在。');

    expect(result).toEqual({
      sentences: ['行，我在。'],
      split: false,
    });
  });

  it('splits longer conversational replies into multiple sentences', () => {
    const result = splitReplyText('这个可以做，不过我建议先把记忆模块拆开，然后再接回复决策，不然后面会容易耦合。');

    expect(result.split).toBe(true);
    expect(result.sentences.length).toBeGreaterThan(1);
    expect(result.sentences.length).toBeLessThanOrEqual(4);
  });

  it('keeps serious refusal or reminder messages unsplit', () => {
    const result = splitReplyText('抱歉，这个我现在不能直接给你。');

    expect(result).toEqual({
      sentences: ['抱歉，这个我现在不能直接给你。'],
      split: false,
    });
  });
});
