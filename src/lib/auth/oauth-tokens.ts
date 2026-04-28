import { decryptText } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import { oauthTokens } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export async function getGitHubAccessToken(userId: number) {
  const [token] = await db
    .select()
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.userId, userId),
        eq(oauthTokens.provider, 'github'),
        isNull(oauthTokens.revokedAt),
      ),
    )
    .limit(1);

  if (!token) {
    return null;
  }

  await db
    .update(oauthTokens)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(oauthTokens.id, token.id));

  return decryptText(token.accessTokenCiphertext);
}
