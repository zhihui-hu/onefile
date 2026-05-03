import { HttpError, parseJson, withApiHandler } from '@/lib/api/response';
import {
  createPublicUploadUuid,
  publicApiKey,
  serializeScopes,
} from '@/lib/auth/api-keys';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { fileApiKeys, storageBuckets } from '@/lib/db/schema';
import { requestOrigin as resolveRequestOrigin } from '@/lib/request-origin';
import { and, eq } from 'drizzle-orm';

import {
  assertHasKeyUpdate,
  noStoreOk,
  parseFileApiKeyId,
  updateFileApiKeySchema,
} from '../schema';

export const runtime = 'nodejs';

async function assertBucketBelongsToUser(userId: number, bucketId: number) {
  const [bucket] = await db
    .select({ id: storageBuckets.id })
    .from(storageBuckets)
    .where(
      and(eq(storageBuckets.id, bucketId), eq(storageBuckets.userId, userId)),
    )
    .limit(1);

  if (!bucket) {
    throw new HttpError(404, 'NOT_FOUND', 'Storage bucket not found');
  }
}

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
    if (payload.bucket_id !== undefined && payload.bucket_id !== null) {
      await assertBucketBelongsToUser(user.id, payload.bucket_id);
    }

    const now = new Date().toISOString();

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
        ...(payload.bucket_id !== undefined
          ? { storageBucketId: payload.bucket_id }
          : {}),
        ...(payload.compress_images !== undefined
          ? { compressImages: payload.compress_images ? 1 : 0 }
          : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.expires_at !== undefined
          ? { expiresAt: payload.expires_at }
          : {}),
        ...(payload.public_upload === 'revoke'
          ? { publicUploadUuid: null, publicUploadRevokedAt: now }
          : {}),
        ...(payload.public_upload === 'regenerate'
          ? {
              publicUploadUuid: createPublicUploadUuid(),
              publicUploadCreatedAt: now,
              publicUploadRevokedAt: null,
            }
          : {}),
        updatedAt: now,
      })
      .where(and(eq(fileApiKeys.id, keyId), eq(fileApiKeys.userId, user.id)))
      .returning();

    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'API key not found');
    }

    return noStoreOk({
      key: publicApiKey(
        updated,
        resolveRequestOrigin(request.headers, new URL(request.url).origin),
      ),
    });
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
