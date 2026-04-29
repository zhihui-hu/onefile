import { parseJson, withApiHandler } from '@/lib/api/response';
import {
  createRawApiToken,
  publicApiToken,
  serializeScopes,
} from '@/lib/auth/api-tokens';
import { requireUser } from '@/lib/auth/session';
import { sha256 } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import { fileApiTokens } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

import { createFileApiTokenSchema, noStoreOk } from './schema';

export const runtime = 'nodejs';

export async function GET() {
  return withApiHandler(async () => {
    const user = await requireUser();
    const tokens = await db
      .select()
      .from(fileApiTokens)
      .where(eq(fileApiTokens.userId, user.id))
      .orderBy(desc(fileApiTokens.createdAt));

    return noStoreOk({ items: tokens.map(publicApiToken) });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const payload = await parseJson(request, createFileApiTokenSchema);
    const token = createRawApiToken();
    const now = new Date().toISOString();

    const [created] = await db
      .insert(fileApiTokens)
      .values({
        userId: user.id,
        name: payload.name,
        tokenPrefix: token.tokenPrefix,
        tokenHash: sha256(token.rawToken),
        description: payload.description ?? null,
        scopes: serializeScopes(payload.scopes),
        expiresAt: payload.expires_at ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return noStoreOk(
      { token: publicApiToken(created), raw_token: token.rawToken },
      { status: 201 },
    );
  });
}
