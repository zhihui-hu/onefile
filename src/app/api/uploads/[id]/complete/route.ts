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

function assertUploadCanComplete(upload: typeof fileUploads.$inferSelect) {
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

function assertUniqueParts(parts: Array<{ part_number: number }>) {
  const seen = new Set<number>();
  for (const part of parts) {
    if (seen.has(part.part_number)) {
      throw new HttpError(400, 'BAD_REQUEST', 'Duplicate multipart part', {
        part_number: part.part_number,
      });
    }
    seen.add(part.part_number);
  }
}

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
    assertUploadCanComplete(upload);

    const { bucket, account } = await getStorageBucketForUser(
      auth.user.id,
      upload.bucketId,
    );
    const adapter = adapterFromAccount(account);
    const now = new Date().toISOString();
    let completedEtag = payload.etag ?? null;

    if (upload.uploadMode === 'multipart') {
      if (!upload.providerUploadId || !payload.parts?.length) {
        throw new HttpError(400, 'BAD_REQUEST', 'Multipart parts are required');
      }
      assertUniqueParts(payload.parts);

      const storedParts = await db
        .select()
        .from(fileUploadParts)
        .where(eq(fileUploadParts.uploadId, upload.id));
      const storedPartNumbers = new Set(
        storedParts.map((part) => part.partNumber),
      );

      if (payload.parts.length !== storedParts.length) {
        throw new HttpError(
          400,
          'BAD_REQUEST',
          'All multipart parts are required',
          {
            expected_parts: storedParts.length,
            received_parts: payload.parts.length,
          },
        );
      }
      for (const part of payload.parts) {
        if (!storedPartNumbers.has(part.part_number)) {
          throw new HttpError(400, 'BAD_REQUEST', 'Invalid multipart part', {
            part_number: part.part_number,
          });
        }
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

      const completed = await adapter.completeMultipartUpload({
        bucket: bucket.name,
        region: bucket.region ?? undefined,
        key: upload.objectKey,
        uploadId: upload.providerUploadId,
        preventOverwrite: true,
        parts: payload.parts
          .map((part) => ({ partNumber: part.part_number, etag: part.etag }))
          .sort((left, right) => left.partNumber - right.partNumber),
      });
      completedEtag = completed.etag ?? completedEtag;
    } else {
      const head = await adapter.headObject({
        bucket: bucket.name,
        region: bucket.region ?? undefined,
        key: upload.objectKey,
      });
      if (!head) {
        throw new HttpError(400, 'BAD_REQUEST', 'Uploaded object not found');
      }
      completedEtag = head.etag ?? completedEtag;
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
      etag: completedEtag,
    });
  });
}
