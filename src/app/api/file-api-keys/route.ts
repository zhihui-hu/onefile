import { HttpError, parseJson, withApiHandler } from '@/lib/api/response';
import {
  createPublicUploadUuid,
  createRawApiKey,
  publicApiKey,
  serializeScopes,
} from '@/lib/auth/api-keys';
import { requireUser } from '@/lib/auth/session';
import { encryptText, sha256 } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import { fileApiKeys, storageBuckets } from '@/lib/db/schema';
import { requestOrigin as resolveRequestOrigin } from '@/lib/request-origin';
import { and, desc, eq } from 'drizzle-orm';

import { createFileApiKeySchema, noStoreOk } from './schema';

export const runtime = 'nodejs';

function isSqliteConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    String(error.code) === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

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

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const keys = await db
      .select()
      .from(fileApiKeys)
      .where(eq(fileApiKeys.userId, user.id))
      .orderBy(desc(fileApiKeys.createdAt));

    return noStoreOk({
      items: keys.map((key) =>
        publicApiKey(
          key,
          resolveRequestOrigin(request.headers, new URL(request.url).origin),
        ),
      ),
    });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const payload = await parseJson(request, createFileApiKeySchema);
    if (payload.bucket_id !== undefined && payload.bucket_id !== null) {
      await assertBucketBelongsToUser(user.id, payload.bucket_id);
    }

    const apiKey = createRawApiKey();
    const publicUploadUuid = createPublicUploadUuid();
    const now = new Date().toISOString();

    let created: typeof fileApiKeys.$inferSelect;
    try {
      [created] = await db
        .insert(fileApiKeys)
        .values({
          userId: user.id,
          name: payload.name,
          tokenPrefix: apiKey.keyPrefix,
          tokenHash: sha256(apiKey.rawKey),
          tokenCiphertext: encryptText(apiKey.rawKey),
          description: payload.description ?? null,
          scopes: serializeScopes(payload.scopes),
          storageBucketId: payload.bucket_id ?? null,
          compressImages: payload.compress_images ? 1 : 0,
          publicUploadUuid,
          publicUploadCreatedAt: now,
          publicUploadRevokedAt: null,
          expiresAt: payload.expires_at ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    } catch (error) {
      if (isSqliteConstraintError(error)) {
        throw new HttpError(
          409,
          'CONFLICT',
          'API key already exists, please retry',
        );
      }
      throw error;
    }

    const publicKey = publicApiKey(
      created,
      resolveRequestOrigin(request.headers, new URL(request.url).origin),
    );
    return noStoreOk(
      {
        key: publicKey,
        raw_key: apiKey.rawKey,
      },
      { status: 201 },
    );
  });
}
