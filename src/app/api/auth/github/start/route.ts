import { fail } from '@/lib/api/response';
import { createGitHubAuthorizationUrl } from '@/lib/auth/github';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const url = await createGitHubAuthorizationUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'GitHub OAuth is unavailable';
    return fail(500, 'INTERNAL_ERROR', message);
  }
}
