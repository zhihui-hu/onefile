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
  DATABASE_URL: optionalString,
  SQLITE_DB_PATH: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  SESSION_SECRET: optionalString,
  STORAGE_CREDENTIAL_ENCRYPTION_KEY: optionalString,
});

export type AppEnv = ReturnType<typeof getEnv>;

let cachedEnv: {
  nodeEnv: 'development' | 'test' | 'production';
  appOrigin: string;
  databasePath: string;
  githubClientId?: string;
  githubClientSecret?: string;
  sessionSecret: string;
  storageCredentialEncryptionKey: string;
  secureCookies: boolean;
} | null = null;

function fallbackSecret(name: string) {
  return `onefile-local-${name}-replace-before-production`;
}

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

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = rawEnvSchema.parse(process.env);
  const appOrigin =
    parsed.APP_ORIGIN ??
    (parsed.NEXT_PUBLIC_BASE_URL?.startsWith('http')
      ? parsed.NEXT_PUBLIC_BASE_URL
      : undefined) ??
    'http://localhost:27507';

  if (parsed.NODE_ENV === 'production') {
    const missing = [
      ['GITHUB_CLIENT_ID', parsed.GITHUB_CLIENT_ID],
      ['GITHUB_CLIENT_SECRET', parsed.GITHUB_CLIENT_SECRET],
      ['SESSION_SECRET', parsed.SESSION_SECRET],
      [
        'STORAGE_CREDENTIAL_ENCRYPTION_KEY',
        parsed.STORAGE_CREDENTIAL_ENCRYPTION_KEY,
      ],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`,
      );
    }
  }

  cachedEnv = {
    nodeEnv: parsed.NODE_ENV,
    appOrigin,
    databasePath: normalizeSqlitePath(
      parsed.SQLITE_DB_PATH ?? parsed.DATABASE_URL,
    ),
    githubClientId: parsed.GITHUB_CLIENT_ID,
    githubClientSecret: parsed.GITHUB_CLIENT_SECRET,
    sessionSecret: parsed.SESSION_SECRET ?? fallbackSecret('session'),
    storageCredentialEncryptionKey:
      parsed.STORAGE_CREDENTIAL_ENCRYPTION_KEY ??
      fallbackSecret('credential-encryption'),
    secureCookies: appOrigin.startsWith('https://'),
  };

  return cachedEnv;
}

export function requireGithubEnv() {
  const env = getEnv();
  if (!env.githubClientId || !env.githubClientSecret) {
    throw new Error('GitHub OAuth is not configured');
  }
  return {
    clientId: env.githubClientId,
    clientSecret: env.githubClientSecret,
    appOrigin: env.appOrigin,
  };
}
