import { HttpError, parseJson, withApiHandler } from '@/lib/api/response';
import { publicApiKey, serializeScopes } from '@/lib/auth/api-keys';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { fileApiKeys } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

import {
  assertHasKeyUpdate,
  noStoreOk,
  parseFileApiKeyId,
  updateFileApiKeySchema,
} from '../schema';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const keyId = parseFileApiKeyId(id);
    const payload = await parseJson(request, updateFileApiKeySchema);
    assertHasKeyUpdate(payload);

    const [updated] = await db
      .update(fileApiKeys)
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
      .where(and(eq(fileApiKeys.id, keyId), eq(fileApiKeys.userId, user.id)))
      .returning();

    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'API key not found');
    }

    return noStoreOk({ key: publicApiKey(updated) });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const keyId = parseFileApiKeyId(id);

    const [deleted] = await db
      .delete(fileApiKeys)
      .where(and(eq(fileApiKeys.id, keyId), eq(fileApiKeys.userId, user.id)))
      .returning({ id: fileApiKeys.id });

    if (!deleted) {
      throw new HttpError(404, 'NOT_FOUND', 'API key not found');
    }

    return noStoreOk({ deleted: true, id: deleted.id });
  });
}
