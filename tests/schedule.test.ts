import { describe, expect, it } from 'vitest';

import { createSendSchedule } from '../packages/sender/src/index.js';

describe('send schedule', () => {
  it('creates a zero-delay first sentence and length-based delays for later sentences', () => {
    const plan = createSendSchedule(['好', '我晚点看一下', '这个方案我再整理整理']);

    expect(plan).toEqual([
      {
        content: '好',
        sentenceIndex: 0,
        delayMs: 0,
      },
      {
        content: '我晚点看一下',
        sentenceIndex: 1,
        delayMs: 900,
      },
      {
        content: '这个方案我再整理整理',
        sentenceIndex: 2,
        delayMs: 1200,
      },
    ]);
  });
});
