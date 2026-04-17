import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_ENV_FILE_NAME = '.env.local';
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class EnvFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvFileError';
  }
}

export type LocalEnvLoadResult = {
  path: string;
  loaded: boolean;
  appliedKeys: string[];
};

export function loadLocalEnvFile(options: {
  cwd?: string;
  filename?: string;
  env?: NodeJS.ProcessEnv;
} = {}): LocalEnvLoadResult {
  const cwd = options.cwd ?? process.cwd();
  const filename = options.filename ?? DEFAULT_ENV_FILE_NAME;
  const env = options.env ?? process.env;
  const path = resolve(cwd, filename);

  if (!existsSync(path)) {
    return {
      path,
      loaded: false,
      appliedKeys: [],
    };
  }

  const parsedEntries = parseEnvFile(readFileSync(path, 'utf8'), path);
  const appliedKeys: string[] = [];

  for (const [key, value] of parsedEntries) {
    if (env[key] !== undefined) {
      continue;
    }

    env[key] = value;
    appliedKeys.push(key);
  }

  return {
    path,
    loaded: true,
    appliedKeys,
  };
}

export function parseEnvFile(content: string, source = DEFAULT_ENV_FILE_NAME): Array<[string, string]> {
  const normalizedContent = content.replace(/^\uFEFF/, '');
  const parsedEntries: Array<[string, string]> = [];
  const lines = normalizedContent.split(/\r?\n/u);

  for (const [index, rawLine] of lines.entries()) {
    const trimmedLine = rawLine.trim();

    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = rawLine.indexOf('=');

    if (separatorIndex === -1) {
      throw new EnvFileError(
        `Invalid env file "${source}" at line ${index + 1}: expected KEY=VALUE format.`,
      );
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    const rawValue = rawLine.slice(separatorIndex + 1).trim();

    if (!ENV_KEY_PATTERN.test(key)) {
      throw new EnvFileError(
        `Invalid env file "${source}" at line ${index + 1}: "${key}" is not a valid environment variable name.`,
      );
    }

    parsedEntries.push([key, unwrapQuotedValue(rawValue)]);
  }

  return parsedEntries;
}

function unwrapQuotedValue(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
