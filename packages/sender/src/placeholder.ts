export function shouldSendPlaceholder(input: {
  isMention: boolean;
  expectedWaitMs: number;
}): boolean {
  return input.isMention && input.expectedWaitMs >= 10_000;
}

export function shouldAbandonDeferredReply(input: {
  placeholderSent: boolean;
  elapsedMs: number;
}): boolean {
  return input.placeholderSent && input.elapsedMs > 30_000;
}

export function buildPlaceholderReply(): string {
  return '看到了，我想一下。';
}
