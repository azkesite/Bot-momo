import { describe, expect, it } from 'vitest';

import {
  buildPlaceholderReply,
  shouldAbandonDeferredReply,
  shouldSendPlaceholder,
} from '../packages/sender/src/index.js';

describe('placeholder reply rules', () => {
  it('sends a placeholder only for mention scenarios that are expected to wait at least 10 seconds', () => {
    expect(shouldSendPlaceholder({ isMention: true, expectedWaitMs: 10_000 })).toBe(true);
    expect(shouldSendPlaceholder({ isMention: false, expectedWaitMs: 15_000 })).toBe(false);
    expect(shouldSendPlaceholder({ isMention: true, expectedWaitMs: 5_000 })).toBe(false);
  });

  it('abandons deferred replies after 30 seconds once a placeholder has been sent', () => {
    expect(shouldAbandonDeferredReply({ placeholderSent: true, elapsedMs: 30_001 })).toBe(true);
    expect(shouldAbandonDeferredReply({ placeholderSent: true, elapsedMs: 20_000 })).toBe(false);
    expect(shouldAbandonDeferredReply({ placeholderSent: false, elapsedMs: 40_000 })).toBe(false);
  });

  it('uses a short placeholder text', () => {
    expect(buildPlaceholderReply()).toBe('看到了，我想一下。');
  });
});
