import { z } from 'zod';

export const unifiedMentionSchema = z
  .object({
    type: z.enum(['platform_mention', 'name', 'alias']),
    targetId: z.string().trim().min(1).optional(),
    targetName: z.string().trim().min(1).optional(),
    text: z.string().trim().min(1),
    isBot: z.boolean().optional(),
  })
  .strict();

export const unifiedMessageReferenceSchema = z
  .object({
    messageId: z.string().trim().min(1),
    userId: z.string().trim().min(1).optional(),
    quotedText: z.string().trim().min(1).optional(),
    isBot: z.boolean().optional(),
  })
  .strict();

export const unifiedMessageEventSchema = z
  .object({
    eventType: z.literal('message.created').default('message.created'),
    platform: z.string().trim().min(1),
    messageId: z.string().trim().min(1),
    groupId: z.string().trim().min(1),
    userId: z.string().trim().min(1),
    nickname: z.string().trim().min(1),
    content: z.string().trim().min(1),
    timestamp: z.number().int().nonnegative(),
    mentions: z.array(unifiedMentionSchema).default([]),
    replyTo: unifiedMessageReferenceSchema.optional(),
    rawPayload: z.unknown(),
  })
  .strict();

export const unifiedSendTargetSchema = z
  .object({
    platform: z.string().trim().min(1),
    groupId: z.string().trim().min(1),
    userId: z.string().trim().min(1).optional(),
    replyToMessageId: z.string().trim().min(1).optional(),
  })
  .strict();

export const unifiedSendResultSchema = z
  .object({
    status: z.enum(['queued', 'sent', 'skipped', 'failed']),
    platform: z.string().trim().min(1),
    target: unifiedSendTargetSchema,
    requestId: z.string().trim().min(1),
    providerMessageId: z.string().trim().min(1).optional(),
    traceId: z.string().trim().min(1).optional(),
    sentenceIndex: z.number().int().nonnegative().optional(),
    sentenceCount: z.number().int().positive().optional(),
    sentAt: z.number().int().nonnegative().optional(),
    skippedReason: z.string().trim().min(1).optional(),
    errorCode: z.string().trim().min(1).optional(),
    errorMessage: z.string().trim().min(1).optional(),
    rawResponse: z.unknown().optional(),
  })
  .strict();

export type UnifiedMention = z.infer<typeof unifiedMentionSchema>;
export type UnifiedMessageReference = z.infer<typeof unifiedMessageReferenceSchema>;
export type UnifiedMessageEvent = z.infer<typeof unifiedMessageEventSchema>;
export type UnifiedSendTarget = z.infer<typeof unifiedSendTargetSchema>;
export type UnifiedSendResult = z.infer<typeof unifiedSendResultSchema>;

export type InvalidUnifiedEvent = {
  reason: 'schema_invalid';
  issues: string[];
};

export type ParseUnifiedMessageEventResult =
  | {
      success: true;
      data: UnifiedMessageEvent;
    }
  | {
      success: false;
      error: InvalidUnifiedEvent;
    };

export type ParseUnifiedSendResultResult =
  | {
      success: true;
      data: UnifiedSendResult;
    }
  | {
      success: false;
      error: InvalidUnifiedEvent;
    };

export function parseUnifiedMessageEvent(input: unknown): ParseUnifiedMessageEventResult {
  const result = unifiedMessageEventSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      error: {
        reason: 'schema_invalid',
        issues: result.error.issues.map((issue) => issue.path.join('.') || issue.message),
      },
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

export function parseUnifiedSendResult(input: unknown): ParseUnifiedSendResultResult {
  const result = unifiedSendResultSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      error: {
        reason: 'schema_invalid',
        issues: result.error.issues.map((issue) => issue.path.join('.') || issue.message),
      },
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
