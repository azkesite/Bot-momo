import { describe, expect, it } from 'vitest';

import { buildMemoryWritebackPlan, createDefaultUserMemoryProfile } from '@bot-momo/memory';

describe('memory writeback plan', () => {
  it('persists long-term preference facts', () => {
    const plan = buildMemoryWritebackPlan({
      messageText: '我最喜欢抹茶拿铁',
      replyText: '记住了，下次聊奶茶我会想起这个。',
      nickname: '阿明',
      currentProfile: createDefaultUserMemoryProfile({
        id: 'memory-1',
        userId: 'qq:user:1',
        nickname: '阿明',
      }),
      now: new Date('2026-04-16T12:00:00.000Z'),
    });

    expect(plan.profileUpdate.preferences).toContain('我最喜欢抹茶拿铁');
    expect(plan.factToPersist).toEqual({
      scope: 'long_term',
      fact: '我最喜欢抹茶拿铁',
      confidence: 88,
    });
  });

  it('avoids polluting long-term memory for small talk', () => {
    const plan = buildMemoryWritebackPlan({
      messageText: '哈哈哈哈',
      replyText: '笑死',
      nickname: '阿明',
      currentProfile: createDefaultUserMemoryProfile({
        id: 'memory-1',
        userId: 'qq:user:1',
        nickname: '阿明',
      }),
      now: new Date('2026-04-16T12:00:00.000Z'),
    });

    expect(plan.factToPersist).toBeUndefined();
    expect(plan.profileUpdate.preferences).toBeUndefined();
  });
});
