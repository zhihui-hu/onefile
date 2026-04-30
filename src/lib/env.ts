import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const optionalString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().optional(),
);

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().url().optional(),
);

const rawEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_ORIGIN: optionalUrl,
  NEXT_PUBLIC_BASE_URL: optionalString,
  APP_SECRET: optionalString,
  DATABASE_URL: optionalString,
  SQLITE_DB_PATH: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  SESSION_SECRET: optionalString,
  STORAGE_CREDENTIAL_ENCRYPTION_KEY: optionalString,
});

const BUILD_PHASE_SECRET = 'onefile-build-time-placeholder-secret';

export type AppEnv = ReturnType<typeof getEnv>;

let cachedEnv: {
  nodeEnv: 'development' | 'test' | 'production';
  appOrigin?: string;
  appSecret: string;
  databasePath: string;
  githubClientId?: string;
  githubClientSecret?: string;
  sessionSecret: string;
  storageCredentialEncryptionKey: string;
} | null = null;

function normalizeSqlitePath(value: string | undefined) {
  const raw = value?.trim() || './data/onefile.sqlite';
  if (raw === ':memory:') {
    return raw;
  }
  if (raw.startsWith('file:')) {
    return raw.slice('file:'.length);
  }
  if (raw.startsWith('sqlite://')) {
    return raw.slice('sqlite://'.length);
  }
  return raw;
}

function resolveProjectPath(filePath: string) {
  if (filePath === ':memory:' || path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), filePath);
}

function defaultSecretPath(databasePath: string) {
  const resolved =
    databasePath === ':memory:'
      ? path.join(
          /*turbopackIgnore: true*/ process.cwd(),
          'data',
          'onefile.sqlite',
        )
      : resolveProjectPath(databasePath);
  return path.join(path.dirname(resolved), '.onefile-secret');
}

function loadOrCreateAppSecret(databasePath: string) {
  const secretPath = defaultSecretPath(databasePath);

  try {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing) {
      return existing;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  const secret = crypto.randomBytes(32).toString('base64url');
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, `${secret}\n`, { mode: 0o600 });
  return secret;
}

function resolveSharedSecret(
  parsed: z.infer<typeof rawEnvSchema>,
  databasePath: string,
) {
  const configuredSecret =
    parsed.APP_SECRET ??
    parsed.SESSION_SECRET ??
    parsed.STORAGE_CREDENTIAL_ENCRYPTION_KEY;
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return BUILD_PHASE_SECRET;
  }

  return loadOrCreateAppSecret(databasePath);
}

function assertUsableAppSecret(secret: string) {
  if (!secret.trim()) {
    throw new Error('APP_SECRET 不能为空');
  }
}

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = rawEnvSchema.parse(process.env);
  const databasePath = normalizeSqlitePath(
    parsed.SQLITE_DB_PATH ?? parsed.DATABASE_URL,
  );
  const appOrigin = parsed.APP_ORIGIN;
  const sharedSecret = resolveSharedSecret(parsed, databasePath);
  const useSharedSecret = Boolean(parsed.APP_SECRET);

  cachedEnv = {
    nodeEnv: parsed.NODE_ENV,
    appOrigin,
    appSecret: sharedSecret,
    databasePath,
    githubClientId: parsed.GITHUB_CLIENT_ID,
    githubClientSecret: parsed.GITHUB_CLIENT_SECRET,
    sessionSecret: useSharedSecret
      ? sharedSecret
      : (parsed.SESSION_SECRET ?? sharedSecret),
    storageCredentialEncryptionKey: useSharedSecret
      ? sharedSecret
      : (parsed.STORAGE_CREDENTIAL_ENCRYPTION_KEY ?? sharedSecret),
  };

  return cachedEnv;
}

export function setImportedAppSecret(secret: string) {
  const normalizedSecret = secret.trim();
  assertUsableAppSecret(normalizedSecret);

  const env = getEnv();
  const secretPath = defaultSecretPath(env.databasePath);
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, `${normalizedSecret}\n`, { mode: 0o600 });

  process.env.APP_SECRET = normalizedSecret;
  cachedEnv = null;
}

export function requireGithubEnv() {
  const env = getEnv();
  if (!env.githubClientId || !env.githubClientSecret) {
    throw new Error('GitHub OAuth is not configured');
  }
  return {
    clientId: env.githubClientId,
    clientSecret: env.githubClientSecret,
  };
}
