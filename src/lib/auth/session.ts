import { HttpError } from '@/lib/api/response';
import {
  decodeSignedValue,
  encodeSignedValue,
  randomToken,
  sha256,
} from '@/lib/crypto';
import { db } from '@/lib/db/client';
import { type User, authRefreshTokens, users } from '@/lib/db/schema';
import { getEnv } from '@/lib/env';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';

export const SESSION_COOKIE = 'onefile_session';
export const OAUTH_STATE_COOKIE = 'onefile_oauth_state';

const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function expiresAtFromNow(seconds: number) {
  return new Date(Date.now() + seconds * 1000);
}

export function toSqlDate(date = new Date()) {
  return date.toISOString();
}

export async function setOAuthStateCookie(state: string) {
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, encodeSignedValue(state), {
    httpOnly: true,
    sameSite: 'lax',
    secure: getEnv().secureCookies,
    path: '/',
    maxAge: 10 * 60,
  });
}

export async function consumeOAuthStateCookie(expectedState: string) {
  const cookieStore = await cookies();
  const signedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);
  if (!signedState) {
    throw new HttpError(400, 'BAD_REQUEST', 'OAuth state cookie is missing');
  }
  const state = decodeSignedValue(signedState);
  if (!state || state !== expectedState) {
    throw new HttpError(400, 'BAD_REQUEST', 'OAuth state verification failed');
  }
}

function requestUserAgent(headerStore: Headers) {
  return headerStore.get('user-agent') ?? null;
}

function requestIp(headerStore: Headers) {
  return (
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    null
  );
}

export async function createSession(userId: number) {
  const token = randomToken(48);
  const now = new Date();
  const expiresAt = expiresAtFromNow(REFRESH_TOKEN_MAX_AGE_SECONDS);
  const headerStore = await headers();

  await db.insert(authRefreshTokens).values({
    userId,
    tokenHash: sha256(token),
    tokenFamily: randomToken(16),
    userAgent: requestUserAgent(headerStore),
    ipAddress: requestIp(headerStore),
    expiresAt: toSqlDate(expiresAt),
    createdAt: toSqlDate(now),
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSignedValue(token), {
    httpOnly: true,
    sameSite: 'lax',
    secure: getEnv().secureCookies,
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const signedToken = cookieStore.get(SESSION_COOKIE)?.value;
  cookieStore.delete(SESSION_COOKIE);
  const token = signedToken ? decodeSignedValue(signedToken) : null;
  if (!token) {
    return;
  }

  await db
    .update(authRefreshTokens)
    .set({ revokedAt: toSqlDate(new Date()) })
    .where(eq(authRefreshTokens.tokenHash, sha256(token)));
}

async function getSessionUserFromCookie() {
  const cookieStore = await cookies();
  const signedToken = cookieStore.get(SESSION_COOKIE)?.value;
  const token = signedToken ? decodeSignedValue(signedToken) : null;
  if (!token) {
    return null;
  }

  const now = toSqlDate(new Date());
  const [session] = await db
    .select()
    .from(authRefreshTokens)
    .where(
      and(
        eq(authRefreshTokens.tokenHash, sha256(token)),
        isNull(authRefreshTokens.revokedAt),
        gt(authRefreshTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!session) {
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.status, 'active')))
    .limit(1);

  if (!user) {
    return null;
  }

  await db
    .update(authRefreshTokens)
    .set({ lastUsedAt: now })
    .where(eq(authRefreshTokens.id, session.id));

  return user;
}

export async function getCurrentUser(): Promise<User | null> {
  return getSessionUserFromCookie();
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return user;
}

export function publicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    display_name: user.displayName,
    avatar_url: user.avatarUrl,
    role: user.role,
    status: user.status,
  };
}
