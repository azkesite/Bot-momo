import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from '../packages/config/src/index.js';

describe('config module', () => {
  it('loads config with defaults', () => {
    const config = loadConfig({
      NAPCAT_BASE_URL: 'http://127.0.0.1:3001',
      NAPCAT_ACCESS_TOKEN: 'token',
      ADMIN_TOKEN: 'admin-token',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
      REDIS_URL: 'redis://127.0.0.1:6379',
    });

    expect(config).toEqual({
      nodeEnv: 'development',
      port: 8787,
      logLevel: 'info',
      napcatBaseUrl: 'http://127.0.0.1:3001',
      napcatAccessToken: 'token',
      adminToken: 'admin-token',
      defaultProvider: 'openai',
      llmTransportMode: 'heuristic',
      botName: 'momo',
      botAliases: [],
      activeReplyEnabled: true,
      activeReplyBaseProbability: 0.15,
      sentenceSplitEnabled: true,
      keywordTriggerEnabled: true,
      databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
      redisUrl: 'redis://127.0.0.1:6379',
      llmProviders: {
        openai: {
          apiKey: undefined,
          baseUrl: 'https://api.openai.com/v1',
          model: undefined,
        },
        'claude-code': {
          apiKey: undefined,
          baseUrl: 'https://api.anthropic.com',
          model: undefined,
          apiVersion: '2023-06-01',
        },
        glm: {
          apiKey: undefined,
          baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
          model: undefined,
        },
        deepseek: {
          apiKey: undefined,
          baseUrl: 'https://api.deepseek.com/v1',
          model: undefined,
        },
        kimi: {
          apiKey: undefined,
          baseUrl: 'https://api.moonshot.cn/v1',
          model: undefined,
        },
      },
    });
  });

  it('parses booleans, numbers, aliases, and provider values', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '4321',
      LOG_LEVEL: 'debug',
      NAPCAT_BASE_URL: 'https://napcat.example.com',
      NAPCAT_ACCESS_TOKEN: 'token',
      ADMIN_TOKEN: 'admin-token',
      DEFAULT_PROVIDER: 'kimi',
      LLM_TRANSPORT_MODE: 'remote',
      BOT_NAME: 'momo-chan',
      BOT_ALIASES: 'momo, bot, 默默 ',
      ACTIVE_REPLY_ENABLED: 'false',
      ACTIVE_REPLY_BASE_PROBABILITY: '0.42',
      SENTENCE_SPLIT_ENABLED: 'false',
      KEYWORD_TRIGGER_ENABLED: 'false',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
      REDIS_URL: 'redis://127.0.0.1:6379',
      KIMI_API_KEY: 'kimi-key',
      KIMI_MODEL: 'kimi-latest',
    });

    expect(config).toEqual({
      nodeEnv: 'production',
      port: 4321,
      logLevel: 'debug',
      napcatBaseUrl: 'https://napcat.example.com',
      napcatAccessToken: 'token',
      adminToken: 'admin-token',
      defaultProvider: 'kimi',
      llmTransportMode: 'remote',
      botName: 'momo-chan',
      botAliases: ['momo', 'bot', '默默'],
      activeReplyEnabled: false,
      activeReplyBaseProbability: 0.42,
      sentenceSplitEnabled: false,
      keywordTriggerEnabled: false,
      databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
      redisUrl: 'redis://127.0.0.1:6379',
      llmProviders: {
        openai: {
          apiKey: undefined,
          baseUrl: 'https://api.openai.com/v1',
          model: undefined,
        },
        'claude-code': {
          apiKey: undefined,
          baseUrl: 'https://api.anthropic.com',
          model: undefined,
          apiVersion: '2023-06-01',
        },
        glm: {
          apiKey: undefined,
          baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
          model: undefined,
        },
        deepseek: {
          apiKey: undefined,
          baseUrl: 'https://api.deepseek.com/v1',
          model: undefined,
        },
        kimi: {
          apiKey: 'kimi-key',
          baseUrl: 'https://api.moonshot.cn/v1',
          model: 'kimi-latest',
        },
      },
    });
  });

  it('fails fast when a required field is missing', () => {
    expect(() =>
      loadConfig({
        NAPCAT_ACCESS_TOKEN: 'token',
        ADMIN_TOKEN: 'admin-token',
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
        REDIS_URL: 'redis://127.0.0.1:6379',
      }),
    ).toThrowError(ConfigError);
  });

  it('fails when boolean values are invalid', () => {
    expect(() =>
      loadConfig({
        NAPCAT_BASE_URL: 'http://127.0.0.1:3001',
        NAPCAT_ACCESS_TOKEN: 'token',
        ADMIN_TOKEN: 'admin-token',
        ACTIVE_REPLY_ENABLED: 'sometimes',
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
        REDIS_URL: 'redis://127.0.0.1:6379',
      }),
    ).toThrowError(ConfigError);
  });

  it('fails when probability values are outside the valid range', () => {
    expect(() =>
      loadConfig({
        NAPCAT_BASE_URL: 'http://127.0.0.1:3001',
        NAPCAT_ACCESS_TOKEN: 'token',
        ADMIN_TOKEN: 'admin-token',
        ACTIVE_REPLY_BASE_PROBABILITY: '1.2',
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
        REDIS_URL: 'redis://127.0.0.1:6379',
      }),
    ).toThrowError(ConfigError);
  });

  it('fails in remote mode when the selected provider credentials are missing', () => {
    expect(() =>
      loadConfig({
        NAPCAT_BASE_URL: 'http://127.0.0.1:3001',
        NAPCAT_ACCESS_TOKEN: 'token',
        ADMIN_TOKEN: 'admin-token',
        LLM_TRANSPORT_MODE: 'remote',
        DEFAULT_PROVIDER: 'openai',
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bot_momo',
        REDIS_URL: 'redis://127.0.0.1:6379',
      }),
    ).toThrowError(ConfigError);
  });
});
