import { HttpError, parseJson, withApiHandler } from '@/lib/api/response';
import { publicApiToken, serializeScopes } from '@/lib/auth/api-tokens';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { fileApiTokens } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

import {
  assertHasTokenUpdate,
  noStoreOk,
  parseFileApiTokenId,
  updateFileApiTokenSchema,
} from '../schema';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const tokenId = parseFileApiTokenId(id);
    const payload = await parseJson(request, updateFileApiTokenSchema);
    assertHasTokenUpdate(payload);

    const [updated] = await db
      .update(fileApiTokens)
      .set({
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description }
          : {}),
        ...(payload.scopes !== undefined
          ? { scopes: serializeScopes(payload.scopes) }
          : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.expires_at !== undefined
          ? { expiresAt: payload.expires_at }
          : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(eq(fileApiTokens.id, tokenId), eq(fileApiTokens.userId, user.id)),
      )
      .returning();

    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'API token not found');
    }

    return noStoreOk({ token: publicApiToken(updated) });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const tokenId = parseFileApiTokenId(id);

    const [deleted] = await db
      .delete(fileApiTokens)
      .where(
        and(eq(fileApiTokens.id, tokenId), eq(fileApiTokens.userId, user.id)),
      )
      .returning({ id: fileApiTokens.id });

    if (!deleted) {
      throw new HttpError(404, 'NOT_FOUND', 'API token not found');
    }

    return noStoreOk({ deleted: true, id: deleted.id });
  });
}
