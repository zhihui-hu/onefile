import { HttpError } from '@/lib/api/response';
import { getCurrentUser } from '@/lib/auth/session';
import { randomToken, sha256 } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import {
  type FileApiKey,
  type User,
  fileApiKeys,
  users,
} from '@/lib/db/schema';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const API_KEY_PREFIX = 'ofk';

export type ApiKeyScope =
  | 'files:read'
  | 'files:write'
  | 'files:delete'
  | 'uploads:write';

export const API_KEY_SCOPES = [
  'files:read',
  'files:write',
  'files:delete',
  'uploads:write',
] as const satisfies readonly ApiKeyScope[];

const IMPLIED_SCOPES: Record<ApiKeyScope, ApiKeyScope[]> = {
  'files:read': [],
  'files:write': ['uploads:write'],
  'files:delete': [],
  'uploads:write': [],
};

export interface AuthContext {
  user: User;
  source: 'session' | 'api_key';
  key?: FileApiKey;
}

export function parseScopes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((scope): scope is ApiKeyScope =>
        API_KEY_SCOPES.includes(String(scope) as ApiKeyScope),
      );
    }
  } catch {
    return [];
  }
  return [];
}

export function serializeScopes(scopes: ApiKeyScope[]) {
  return JSON.stringify(Array.from(new Set(scopes)));
}

function expandScopes(scopes: ApiKeyScope[]) {
  const expanded = new Set(scopes);
  for (const scope of scopes) {
    for (const impliedScope of IMPLIED_SCOPES[scope]) {
      expanded.add(impliedScope);
    }
  }
  return expanded;
}

export function createRawApiKey() {
  const prefix = randomToken(6);
  const secret = randomToken(32);
  return {
    rawKey: `${API_KEY_PREFIX}_${prefix}_${secret}`,
    keyPrefix: `${API_KEY_PREFIX}_${prefix}`,
  };
}

function bearerKey(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim();
}

async function getApiKeyContext(
  request: NextRequest,
  requiredScopes: ApiKeyScope[] = [],
): Promise<AuthContext | null> {
  const key = bearerKey(request);
  if (!key) {
    return null;
  }

  const now = new Date().toISOString();
  const [apiKey] = await db
    .select()
    .from(fileApiKeys)
    .where(
      and(
        eq(fileApiKeys.tokenHash, sha256(key)),
        eq(fileApiKeys.status, 'active'),
        or(isNull(fileApiKeys.expiresAt), gt(fileApiKeys.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!apiKey) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid API key');
  }

  const scopes = expandScopes(parseScopes(apiKey.scopes));
  const missingScopes = requiredScopes.filter((scope) => !scopes.has(scope));
  if (missingScopes.length > 0) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      'API key does not include required scope',
      { required_scopes: missingScopes },
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, apiKey.userId), eq(users.status, 'active')))
    .limit(1);

  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'API key user is unavailable');
  }

  await db
    .update(fileApiKeys)
    .set({
      lastUsedAt: now,
      lastUsedIp:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip'),
      lastUsedUserAgent: request.headers.get('user-agent'),
    })
    .where(eq(fileApiKeys.id, apiKey.id));

  return { user, source: 'api_key', key: apiKey };
}

export async function getApiKeyAuthContext(
  request: NextRequest,
  requiredScopes: ApiKeyScope[] = [],
) {
  const auth = await getApiKeyContext(request, requiredScopes);
  if (!auth) {
    throw new HttpError(401, 'UNAUTHORIZED', 'API key is required');
  }
  return auth;
}

export async function getAuthContext(
  request: NextRequest,
  requiredScopes: ApiKeyScope[] = [],
): Promise<AuthContext> {
  const sessionUser = await getCurrentUser();
  if (sessionUser) {
    return { user: sessionUser, source: 'session' };
  }

  const auth = await getApiKeyContext(request, requiredScopes);
  if (!auth) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return auth;
}

export function publicApiKey(key: FileApiKey) {
  return {
    id: key.id,
    name: key.name,
    key_prefix: key.tokenPrefix,
    description: key.description,
    scopes: parseScopes(key.scopes),
    status: key.status,
    last_used_at: key.lastUsedAt,
    last_used_ip: key.lastUsedIp,
    last_used_user_agent: key.lastUsedUserAgent,
    expires_at: key.expiresAt,
    created_at: key.createdAt,
    updated_at: key.updatedAt,
  };
}
