import { HttpError } from '@/lib/api/response';
import { getCurrentUser } from '@/lib/auth/session';
import { randomToken, sha256 } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import {
  type FileApiToken,
  type User,
  fileApiTokens,
  users,
} from '@/lib/db/schema';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const API_TOKEN_PREFIX = 'ofk';

export type ApiTokenScope =
  | 'files:read'
  | 'files:write'
  | 'files:delete'
  | 'uploads:write';

export const API_TOKEN_SCOPES = [
  'files:read',
  'files:write',
  'files:delete',
  'uploads:write',
] as const satisfies readonly ApiTokenScope[];

const IMPLIED_SCOPES: Record<ApiTokenScope, ApiTokenScope[]> = {
  'files:read': [],
  'files:write': ['uploads:write'],
  'files:delete': [],
  'uploads:write': [],
};

export interface AuthContext {
  user: User;
  source: 'session' | 'api_token';
  token?: FileApiToken;
}

export function parseScopes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((scope): scope is ApiTokenScope =>
        API_TOKEN_SCOPES.includes(String(scope) as ApiTokenScope),
      );
    }
  } catch {
    return [];
  }
  return [];
}

export function serializeScopes(scopes: ApiTokenScope[]) {
  return JSON.stringify(Array.from(new Set(scopes)));
}

function expandScopes(scopes: ApiTokenScope[]) {
  const expanded = new Set(scopes);
  for (const scope of scopes) {
    for (const impliedScope of IMPLIED_SCOPES[scope]) {
      expanded.add(impliedScope);
    }
  }
  return expanded;
}

export function createRawApiToken() {
  const prefix = randomToken(6);
  const secret = randomToken(32);
  return {
    rawToken: `${API_TOKEN_PREFIX}_${prefix}_${secret}`,
    tokenPrefix: `${API_TOKEN_PREFIX}_${prefix}`,
  };
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim();
}

export async function getAuthContext(
  request: NextRequest,
  requiredScopes: ApiTokenScope[] = [],
): Promise<AuthContext> {
  const sessionUser = await getCurrentUser();
  if (sessionUser) {
    return { user: sessionUser, source: 'session' };
  }

  const token = bearerToken(request);
  if (!token) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const now = new Date().toISOString();
  const [apiToken] = await db
    .select()
    .from(fileApiTokens)
    .where(
      and(
        eq(fileApiTokens.tokenHash, sha256(token)),
        eq(fileApiTokens.status, 'active'),
        or(isNull(fileApiTokens.expiresAt), gt(fileApiTokens.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!apiToken) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid API token');
  }

  const scopes = expandScopes(parseScopes(apiToken.scopes));
  const missingScopes = requiredScopes.filter((scope) => !scopes.has(scope));
  if (missingScopes.length > 0) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      'API token does not include required scope',
      { required_scopes: missingScopes },
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, apiToken.userId), eq(users.status, 'active')))
    .limit(1);

  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'API token user is unavailable');
  }

  await db
    .update(fileApiTokens)
    .set({
      lastUsedAt: now,
      lastUsedIp:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip'),
      lastUsedUserAgent: request.headers.get('user-agent'),
    })
    .where(eq(fileApiTokens.id, apiToken.id));

  return { user, source: 'api_token', token: apiToken };
}

export function publicApiToken(token: FileApiToken) {
  return {
    id: token.id,
    name: token.name,
    token_prefix: token.tokenPrefix,
    description: token.description,
    scopes: parseScopes(token.scopes),
    status: token.status,
    last_used_at: token.lastUsedAt,
    last_used_ip: token.lastUsedIp,
    last_used_user_agent: token.lastUsedUserAgent,
    expires_at: token.expiresAt,
    created_at: token.createdAt,
    updated_at: token.updatedAt,
  };
}
