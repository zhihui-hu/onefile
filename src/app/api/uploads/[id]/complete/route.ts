import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { getAuthContext } from '@/lib/auth/api-tokens';
import { db } from '@/lib/db/client';
import { fileUploadParts, fileUploads } from '@/lib/db/schema';
import {
  adapterFromAccount,
  getStorageBucketForUser,
  stripBucketKeyPrefix,
} from '@/lib/storage-config';
import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const completeSchema = z.object({
  parts: z
    .array(
      z.object({
        part_number: z.number().int().positive(),
        etag: z.string().min(1),
      }),
    )
    .optional(),
  etag: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const auth = await getAuthContext(request, ['uploads:write']);
    const { id } = await context.params;
    const payload = await parseJson(request, completeSchema);
    const [upload] = await db
      .select()
      .from(fileUploads)
      .where(and(eq(fileUploads.id, id), eq(fileUploads.userId, auth.user.id)))
      .limit(1);

    if (!upload) {
      throw new HttpError(404, 'NOT_FOUND', 'Upload not found');
    }

    const { bucket, account } = await getStorageBucketForUser(
      auth.user.id,
      upload.bucketId,
    );
    const adapter = adapterFromAccount(account);
    const now = new Date().toISOString();

    if (upload.uploadMode === 'multipart') {
      if (!upload.providerUploadId || !payload.parts?.length) {
        throw new HttpError(400, 'BAD_REQUEST', 'Multipart parts are required');
      }

      for (const part of payload.parts) {
        await db
          .update(fileUploadParts)
          .set({
            etag: part.etag,
            status: 'uploaded',
            uploadedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(fileUploadParts.uploadId, upload.id),
              eq(fileUploadParts.partNumber, part.part_number),
            ),
          );
      }

      await adapter.completeMultipartUpload({
        bucket: bucket.name,
        key: upload.objectKey,
        uploadId: upload.providerUploadId,
        preventOverwrite: true,
        parts: payload.parts
          .map((part) => ({ partNumber: part.part_number, etag: part.etag }))
          .sort((left, right) => left.partNumber - right.partNumber),
      });
    } else {
      await adapter.headObject({ bucket: bucket.name, key: upload.objectKey });
    }

    await db
      .update(fileUploads)
      .set({
        status: 'completed',
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(fileUploads.id, upload.id));

    return ok({
      completed: true,
      upload_id: upload.id,
      object_key: stripBucketKeyPrefix(bucket, upload.objectKey),
      etag: payload.etag ?? null,
    });
  });
}
