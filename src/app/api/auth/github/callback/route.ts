import { fail, ok, withApiHandler } from '@/lib/api/response';
import {
  exchangeGitHubCode,
  upsertGitHubUserAndToken,
} from '@/lib/auth/github';
import { consumeOAuthStateCookie, createSession } from '@/lib/auth/session';
import { requestOrigin } from '@/lib/request-origin';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      return fail(400, 'BAD_REQUEST', error);
    }
    if (!code || !state) {
      return fail(400, 'BAD_REQUEST', 'Missing OAuth callback parameters');
    }

    await consumeOAuthStateCookie(state);
    const token = await exchangeGitHubCode(
      code,
      requestOrigin(request.headers, request.nextUrl.origin),
    );
    const user = await upsertGitHubUserAndToken(token);
    await createSession(user.id);
    return ok({ authenticated: true });
  });
}
