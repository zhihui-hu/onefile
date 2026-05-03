import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { getAuthContext } from '@/lib/auth/api-keys';
import { randomToken } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import { fileUploadParts, fileUploads } from '@/lib/db/schema';
import { avoidObjectKeyConflict, buildObjectKey } from '@/lib/files/keys';
import { scheduleUploadCleanup } from '@/lib/maintenance/cleanup';
import {
  adapterFromAccountForBucket,
  applyBucketKeyPrefix,
  getStorageBucketForUser,
  stripBucketKeyPrefix,
} from '@/lib/storage-config';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const ONE_MIB = 1024 * 1024;
const DEFAULT_PART_SIZE = 16 * ONE_MIB;
const MIN_PART_SIZE = 5 * ONE_MIB;
const MAX_PART_SIZE = 5 * 1024 * ONE_MIB;
const MAX_PARTS = 10_000;
const MAX_OBJECT_SIZE = 5 * 1024 * 1024 * ONE_MIB;

const createSchema = z.object({
  bucket_id: z.union([z.number().int(), z.string().min(1)]),
  object_key: z.string().min(1).optional(),
  current_prefix: z.string().optional(),
  relative_path: z.string().optional(),
  original_filename: z.string().min(1),
  file_size: z.number().int().min(0).max(MAX_OBJECT_SIZE),
  mime_type: z.string().min(1).default('application/octet-stream'),
  upload_mode: z.literal('multipart').optional(),
  part_size: z.number().int().positive().optional(),
  content_md5: z.string().optional(),
  content_sha256: z.string().optional(),
});

function choosePartSize(fileSize: number, requested?: number) {
  if (requested !== undefined) {
    if (requested < MIN_PART_SIZE || requested > MAX_PART_SIZE) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'part_size must be between 5 MiB and 5 GiB',
        {
          min_part_size: MIN_PART_SIZE,
          max_part_size: MAX_PART_SIZE,
        },
      );
    }
  }

  let partSize = Math.max(requested ?? DEFAULT_PART_SIZE, MIN_PART_SIZE);
  while (Math.ceil(fileSize / partSize) > MAX_PARTS) {
    partSize *= 2;
  }
  if (partSize > MAX_PART_SIZE) {
    throw new HttpError(400, 'BAD_REQUEST', 'File is too large for multipart', {
      max_part_size: MAX_PART_SIZE,
      max_parts: MAX_PARTS,
    });
  }
  return partSize;
}

function parseBucketId(value: number | string) {
  const bucketId = Number(value);
  if (!Number.isInteger(bucketId) || bucketId <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'Invalid bucket_id');
  }
  return bucketId;
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const auth = await getAuthContext(request, ['uploads:write']);
    const payload = await parseJson(request, createSchema);
    const { bucket, account } = await getStorageBucketForUser(
      auth.user.id,
      parseBucketId(payload.bucket_id),
    );
    const adapter = adapterFromAccountForBucket(account, bucket);
    const relativeKey = buildObjectKey({
      filename: payload.original_filename,
      currentPrefix: payload.current_prefix,
      relativePath: payload.relative_path,
      explicitObjectKey: payload.object_key,
      defaultDatePrefix: auth.source === 'api_key' && !payload.object_key,
    });

    const conflictedRelativeKey = await avoidObjectKeyConflict(
      relativeKey,
      async (key) => {
        const head = await adapter.headObject({
          bucket: bucket.name,
          region: bucket.region ?? undefined,
          key: applyBucketKeyPrefix(bucket, key),
        });
        return Boolean(head);
      },
    );
    const providerKey = applyBucketKeyPrefix(bucket, conflictedRelativeKey);
    if (payload.file_size === 0) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'Multipart upload requires a non-empty file',
      );
    }
    const now = new Date();
    // Calculate a reasonable timeout: 15 minutes base + 1 minute per 100MB
    const timeoutMinutes = 15 + Math.ceil(payload.file_size / (100 * ONE_MIB));
    const expiresAt = new Date(now.getTime() + timeoutMinutes * 60 * 1000);
    const uploadId = randomToken(18);
    const partSize = choosePartSize(payload.file_size, payload.part_size);
    const totalParts = Math.max(1, Math.ceil(payload.file_size / partSize));
    const multipart = await adapter.createMultipartUpload({
      bucket: bucket.name,
      region: bucket.region ?? undefined,
      key: providerKey,
      contentType: payload.mime_type,
    });

    await db.insert(fileUploads).values({
      id: uploadId,
      userId: auth.user.id,
      bucketId: bucket.id,
      objectKey: providerKey,
      originalFilename: payload.original_filename,
      fileSize: payload.file_size,
      mimeType: payload.mime_type,
      uploadMode: 'multipart',
      providerUploadId: multipart.uploadId,
      partSize,
      totalParts,
      contentMd5: payload.content_md5 ?? null,
      contentSha256: payload.content_sha256 ?? null,
      status: 'initiated',
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    await db.insert(fileUploadParts).values(
      Array.from({ length: totalParts }, (_, index) => {
        const partNumber = index + 1;
        const remaining = payload.file_size - index * partSize;
        return {
          uploadId,
          partNumber,
          partSize: Math.min(partSize, remaining),
          status: 'pending' as const,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
      }),
    );

    scheduleUploadCleanup(uploadId, timeoutMinutes * 60 * 1000);

    return ok({
      id: uploadId,
      upload_id: uploadId,
      bucket_id: bucket.id,
      bucket_name: bucket.name,
      object_key: stripBucketKeyPrefix(bucket, providerKey),
      upload_mode: 'multipart',
      part_size: partSize,
      total_parts: totalParts,
      expires_at: expiresAt.toISOString(),
    });
  });
}
