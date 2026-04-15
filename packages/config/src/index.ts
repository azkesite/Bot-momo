import { z } from 'zod';

export const CONFIG_PACKAGE_NAME = '@bot-momo/config';

const DEFAULT_PORT = 3000;
const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_PROVIDER = 'openai';
const DEFAULT_BOT_NAME = 'momo';
const DEFAULT_ACTIVE_REPLY_BASE_PROBABILITY = 0.15;

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);
const providerSchema = z.enum(['openai', 'claude-code', 'glm', 'deepseek', 'kimi']);

const booleanStringSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const normalized = value.toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expected "true" or "false".',
    });

    return z.NEVER;
  });

const integerStringSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expected an integer number.',
      });
      return z.NEVER;
    }

    return parsed;
  });

const probabilityStringSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    const parsed = Number.parseFloat(value);

    if (Number.isNaN(parsed)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expected a decimal number.',
      });
      return z.NEVER;
    }

    return parsed;
  })
  .pipe(z.number().min(0).max(1));

const splitAliases = (rawAliases: string): string[] =>
  rawAliases
    .split(',')
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: z.number().int().positive().default(DEFAULT_PORT),
  logLevel: logLevelSchema.default(DEFAULT_LOG_LEVEL),
  napcatBaseUrl: z.string().trim().url(),
  napcatAccessToken: z.string().trim().min(1),
  adminToken: z.string().trim().min(1),
  defaultProvider: providerSchema.default(DEFAULT_PROVIDER),
  botName: z.string().trim().min(1).default(DEFAULT_BOT_NAME),
  botAliases: z.array(z.string().min(1)).default([]),
  activeReplyEnabled: z.boolean().default(true),
  activeReplyBaseProbability: z.number().min(0).max(1).default(DEFAULT_ACTIVE_REPLY_BASE_PROBABILITY),
  sentenceSplitEnabled: z.boolean().default(true),
  keywordTriggerEnabled: z.boolean().default(true),
  databaseUrl: z.string().trim().min(1),
  redisUrl: z.string().trim().min(1),
});

export type AppConfig = z.infer<typeof configSchema>;

export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid configuration:\n${issues.join('\n')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

export type RawEnv = Record<string, string | undefined>;

export function loadConfig(rawEnv: RawEnv = process.env): AppConfig {
  const parsed = z
    .object({
      NODE_ENV: z.string().optional(),
      PORT: z.union([integerStringSchema, z.number()]).optional(),
      LOG_LEVEL: logLevelSchema.optional(),
      NAPCAT_BASE_URL: z.string().optional(),
      NAPCAT_ACCESS_TOKEN: z.string().optional(),
      ADMIN_TOKEN: z.string().optional(),
      DEFAULT_PROVIDER: providerSchema.optional(),
      BOT_NAME: z.string().optional(),
      BOT_ALIASES: z.string().optional(),
      ACTIVE_REPLY_ENABLED: z.union([booleanStringSchema, z.boolean()]).optional(),
      ACTIVE_REPLY_BASE_PROBABILITY: z.union([probabilityStringSchema, z.number()]).optional(),
      SENTENCE_SPLIT_ENABLED: z.union([booleanStringSchema, z.boolean()]).optional(),
      KEYWORD_TRIGGER_ENABLED: z.union([booleanStringSchema, z.boolean()]).optional(),
      DATABASE_URL: z.string().optional(),
      REDIS_URL: z.string().optional(),
    })
    .safeParse(rawEnv);

  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => formatIssue(issue.path.join('.'), issue.message)),
    );
  }

  const normalized = configSchema.safeParse({
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    logLevel: parsed.data.LOG_LEVEL,
    napcatBaseUrl: parsed.data.NAPCAT_BASE_URL,
    napcatAccessToken: parsed.data.NAPCAT_ACCESS_TOKEN,
    adminToken: parsed.data.ADMIN_TOKEN,
    defaultProvider: parsed.data.DEFAULT_PROVIDER,
    botName: parsed.data.BOT_NAME,
    botAliases: parsed.data.BOT_ALIASES ? splitAliases(parsed.data.BOT_ALIASES) : [],
    activeReplyEnabled: parsed.data.ACTIVE_REPLY_ENABLED,
    activeReplyBaseProbability: parsed.data.ACTIVE_REPLY_BASE_PROBABILITY,
    sentenceSplitEnabled: parsed.data.SENTENCE_SPLIT_ENABLED,
    keywordTriggerEnabled: parsed.data.KEYWORD_TRIGGER_ENABLED,
    databaseUrl: parsed.data.DATABASE_URL,
    redisUrl: parsed.data.REDIS_URL,
  });

  if (!normalized.success) {
    throw new ConfigError(
      normalized.error.issues.map((issue) => formatIssue(issue.path.join('.'), issue.message)),
    );
  }

  return normalized.data;
}

function formatIssue(path: string, message: string): string {
  const label = path.length > 0 ? path : 'config';
  return `- ${label}: ${message}`;
}
