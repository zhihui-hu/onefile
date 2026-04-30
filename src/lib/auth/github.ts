import { HttpError } from '@/lib/api/response';
import { encryptText } from '@/lib/crypto';
import { randomToken } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import { oauthTokens, users } from '@/lib/db/schema';
import { requireGithubEnv } from '@/lib/env';
import { asc, eq, sql } from 'drizzle-orm';

import { setOAuthStateCookie, toSqlDate } from './session';

interface GitHubTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface GitHubEmailResponse {
  email: string;
  primary: boolean;
  verified: boolean;
}

export async function createGitHubAuthorizationUrl(origin: string) {
  const env = requireGithubEnv();
  const state = randomToken(24);
  await setOAuthStateCookie(state);

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', `${origin}/callback/auth`);
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', state);
  return url;
}

export async function exchangeGitHubCode(code: string, origin: string) {
  const env = requireGithubEnv();
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      redirect_uri: `${origin}/callback/auth`,
    }),
  });

  const token = (await response.json()) as GitHubTokenResponse;
  if (!response.ok || token.error || !token.access_token) {
    throw new HttpError(
      400,
      'BAD_REQUEST',
      token.error_description ?? 'Failed to exchange GitHub OAuth code',
      token.error,
    );
  }

  return token;
}

async function fetchGitHubProfile(accessToken: string) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new HttpError(400, 'BAD_REQUEST', 'Failed to read GitHub profile');
  }
  return (await response.json()) as GitHubUserResponse;
}

async function fetchPrimaryEmail(accessToken: string) {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    return null;
  }
  const emails = (await response.json()) as GitHubEmailResponse[];
  return (
    emails.find((email) => email.primary && email.verified)?.email ??
    emails.find((email) => email.verified)?.email ??
    null
  );
}

function futureIso(seconds: number | undefined) {
  if (!seconds) {
    return null;
  }
  return toSqlDate(new Date(Date.now() + seconds * 1000));
}

async function shouldAssignAdminToUser(existingUserId?: number) {
  const [firstUser] = await db
    .select({ id: users.id })
    .from(users)
    .orderBy(asc(users.id))
    .limit(1);

  if (!firstUser) {
    return true;
  }

  if (existingUserId !== firstUser.id) {
    return false;
  }

  const [adminStats] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, 'admin'));

  return Number(adminStats?.count ?? 0) === 0;
}

export async function upsertGitHubUserAndToken(token: GitHubTokenResponse) {
  if (!token.access_token) {
    throw new HttpError(400, 'BAD_REQUEST', 'Missing GitHub access token');
  }

  const profile = await fetchGitHubProfile(token.access_token);
  const email = profile.email ?? (await fetchPrimaryEmail(token.access_token));
  const now = toSqlDate(new Date());

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, profile.login))
    .limit(1);

  const userValues = {
    provider: 'github',
    username: profile.login,
    email,
    displayName: profile.name ?? profile.login,
    avatarUrl: profile.avatar_url,
    lastLoginAt: now,
    updatedAt: now,
  };

  const assignAdmin = await shouldAssignAdminToUser(existingUser?.id);

  const [user] = existingUser
    ? await db
        .update(users)
        .set({
          ...userValues,
          ...(assignAdmin ? { role: 'admin' as const } : {}),
        })
        .where(eq(users.id, existingUser.id))
        .returning()
    : await db
        .insert(users)
        .values({
          ...userValues,
          role: assignAdmin ? 'admin' : 'user',
          createdAt: now,
        })
        .returning();

  await db
    .insert(oauthTokens)
    .values({
      userId: user.id,
      provider: 'github',
      accessTokenCiphertext: encryptText(token.access_token),
      refreshTokenCiphertext: token.refresh_token
        ? encryptText(token.refresh_token)
        : null,
      tokenType: token.token_type ?? 'bearer',
      scope: token.scope ?? '',
      expiresAt: futureIso(token.expires_in),
      refreshTokenExpiresAt: futureIso(token.refresh_token_expires_in),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [oauthTokens.userId, oauthTokens.provider],
      set: {
        accessTokenCiphertext: encryptText(token.access_token),
        refreshTokenCiphertext: token.refresh_token
          ? encryptText(token.refresh_token)
          : null,
        tokenType: token.token_type ?? 'bearer',
        scope: token.scope ?? '',
        expiresAt: futureIso(token.expires_in),
        refreshTokenExpiresAt: futureIso(token.refresh_token_expires_in),
        revokedAt: null,
        updatedAt: now,
      },
    });

  return user;
}
