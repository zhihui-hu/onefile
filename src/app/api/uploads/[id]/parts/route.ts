import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { getAuthContext } from '@/lib/auth/api-keys';
import { db } from '@/lib/db/client';
import { fileUploadParts, fileUploads } from '@/lib/db/schema';
import {
  adapterFromAccountForBucket,
  getStorageBucketForUser,
} from '@/lib/storage-config';
import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const MAX_PARTS = 10_000;

const partSchema = z.object({
  part_number: z.number().int().positive().max(MAX_PARTS),
  content_length: z.number().int().positive().optional(),
});

function assertUploadCanReceiveParts(upload: typeof fileUploads.$inferSelect) {
  if (upload.status === 'completed') {
    throw new HttpError(409, 'CONFLICT', 'Upload already completed');
  }
  if (upload.status === 'aborted') {
    throw new HttpError(409, 'CONFLICT', 'Upload already aborted');
  }
  if (upload.status === 'failed') {
    throw new HttpError(409, 'CONFLICT', 'Upload already failed');
  }
  if (
    upload.status === 'expired' ||
    Date.parse(upload.expiresAt) <= Date.now()
  ) {
    throw new HttpError(410, 'UPLOAD_EXPIRED', 'Upload session expired');
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const auth = await getAuthContext(request, ['uploads:write']);
    const { id } = await context.params;
    const payload = await parseJson(request, partSchema);
    const [upload] = await db
      .select()
      .from(fileUploads)
      .where(and(eq(fileUploads.id, id), eq(fileUploads.userId, auth.user.id)))
      .limit(1);

    if (
      !upload ||
      upload.uploadMode !== 'multipart' ||
      !upload.providerUploadId
    ) {
      throw new HttpError(404, 'NOT_FOUND', 'Multipart upload not found');
    }
    assertUploadCanReceiveParts(upload);

    const [part] = await db
      .select()
      .from(fileUploadParts)
      .where(
        and(
          eq(fileUploadParts.uploadId, upload.id),
          eq(fileUploadParts.partNumber, payload.part_number),
        ),
      )
      .limit(1);

    if (!part) {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid part_number');
    }
    if (
      payload.content_length !== undefined &&
      payload.content_length !== part.partSize
    ) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'content_length does not match the expected part size',
        {
          expected_content_length: part.partSize,
          part_number: part.partNumber,
        },
      );
    }

    const { bucket, account } = await getStorageBucketForUser(
      auth.user.id,
      upload.bucketId,
    );
    const adapter = adapterFromAccountForBucket(account, bucket);
    const presigned = await adapter.presignMultipartPart({
      bucket: bucket.name,
      region: bucket.region ?? undefined,
      key: upload.objectKey,
      uploadId: upload.providerUploadId,
      partNumber: payload.part_number,
      contentLength: payload.content_length,
      expiresInSeconds: 15 * 60,
    });

    await db
      .update(fileUploadParts)
      .set({ status: 'pending', updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(fileUploadParts.uploadId, upload.id),
          eq(fileUploadParts.partNumber, payload.part_number),
        ),
      );

    await db
      .update(fileUploads)
      .set({ status: 'uploading', updatedAt: new Date().toISOString() })
      .where(eq(fileUploads.id, upload.id));

    return ok({
      part_number: payload.part_number,
      upload_url: presigned.url,
      url: presigned.url,
      method: presigned.method,
      headers: presigned.headers,
      expires_at: presigned.expiresAt.toISOString(),
    });
  });
}
