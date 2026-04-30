import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { getAuthContext } from '@/lib/auth/api-keys';
import { randomToken } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import {
  fileUploadParts,
  fileUploads,
  storageAccounts,
  storageBuckets,
} from '@/lib/db/schema';
import { avoidObjectKeyConflict, buildObjectKey } from '@/lib/files/keys';
import {
  adapterFromAccount,
  applyBucketKeyPrefix,
  getStorageBucketForUser,
  stripBucketKeyPrefix,
} from '@/lib/storage-config';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const ONE_MIB = 1024 * 1024;
const SINGLE_UPLOAD_LIMIT = 100 * ONE_MIB;
const DEFAULT_PART_SIZE = 16 * ONE_MIB;
const MIN_PART_SIZE = 5 * ONE_MIB;
const MAX_PART_SIZE = 5 * 1024 * ONE_MIB;
const MAX_PARTS = 10_000;
const MAX_SINGLE_UPLOAD_SIZE = 5 * 1024 * ONE_MIB;
const MAX_OBJECT_SIZE = 5 * 1024 * 1024 * ONE_MIB;

const createSchema = z.object({
  bucket_id: z.union([z.number().int(), z.string().min(1)]).optional(),
  object_key: z.string().min(1).optional(),
  current_prefix: z.string().optional(),
  relative_path: z.string().optional(),
  original_filename: z.string().min(1),
  file_size: z.number().int().min(0).max(MAX_OBJECT_SIZE),
  mime_type: z.string().min(1).default('application/octet-stream'),
  upload_mode: z.enum(['single', 'multipart']).optional(),
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

function uploadMode(fileSize: number, requested?: 'single' | 'multipart') {
  return requested ?? (fileSize < SINGLE_UPLOAD_LIMIT ? 'single' : 'multipart');
}

function parseBucketId(value: number | string) {
  const bucketId = Number(value);
  if (!Number.isInteger(bucketId) || bucketId <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'Invalid bucket_id');
  }
  return bucketId;
}

async function chooseUploadBucket(
  userId: number,
  bucketIdValue?: number | string,
) {
  if (bucketIdValue !== undefined) {
    return getStorageBucketForUser(userId, parseBucketId(bucketIdValue));
  }

  const candidates = await db
    .select({ bucket: storageBuckets, account: storageAccounts })
    .from(storageBuckets)
    .innerJoin(
      storageAccounts,
      eq(storageBuckets.storageAccountId, storageAccounts.id),
    )
    .where(
      and(
        eq(storageBuckets.userId, userId),
        eq(storageAccounts.userId, userId),
        eq(storageAccounts.status, 'active'),
      ),
    )
    .orderBy(asc(storageBuckets.id));

  if (candidates.length === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'No storage bucket is available');
  }

  const bucketIds = candidates.map((row) => row.bucket.id);
  const recentUploads = await db
    .select({ bucketId: fileUploads.bucketId, status: fileUploads.status })
    .from(fileUploads)
    .where(
      and(
        eq(fileUploads.userId, userId),
        inArray(fileUploads.bucketId, bucketIds),
      ),
    );
  const activeCountByBucketId = new Map<number, number>();
  const recentCountByBucketId = new Map<number, number>();
  for (const upload of recentUploads) {
    recentCountByBucketId.set(
      upload.bucketId,
      (recentCountByBucketId.get(upload.bucketId) ?? 0) + 1,
    );
    if (upload.status === 'initiated' || upload.status === 'uploading') {
      activeCountByBucketId.set(
        upload.bucketId,
        (activeCountByBucketId.get(upload.bucketId) ?? 0) + 1,
      );
    }
  }

  const [selected] = candidates
    .map((row) => ({
      ...row,
      activeUploads: activeCountByBucketId.get(row.bucket.id) ?? 0,
      recentUploads: recentCountByBucketId.get(row.bucket.id) ?? 0,
    }))
    .sort((left, right) => {
      const loadDelta = left.activeUploads - right.activeUploads;
      if (loadDelta !== 0) return loadDelta;

      const recentDelta = left.recentUploads - right.recentUploads;
      if (recentDelta !== 0) return recentDelta;

      const defaultDelta =
        Number(right.bucket.isDefault) - Number(left.bucket.isDefault);
      if (defaultDelta !== 0) return defaultDelta;

      return left.bucket.id - right.bucket.id;
    });

  if (!selected) {
    throw new HttpError(404, 'NOT_FOUND', 'No storage bucket is available');
  }

  return selected;
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const auth = await getAuthContext(request, ['uploads:write']);
    const payload = await parseJson(request, createSchema);
    const { bucket, account } = await chooseUploadBucket(
      auth.user.id,
      payload.bucket_id,
    );
    const adapter = adapterFromAccount(account);
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
    const mode = uploadMode(payload.file_size, payload.upload_mode);
    if (mode === 'single' && payload.file_size > MAX_SINGLE_UPLOAD_SIZE) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'Single upload cannot exceed 5 GiB; use multipart upload',
        {
          max_single_upload_size: MAX_SINGLE_UPLOAD_SIZE,
        },
      );
    }
    if (mode === 'multipart' && payload.file_size === 0) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'Multipart upload requires a non-empty file',
      );
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const uploadId = randomToken(18);

    if (mode === 'single') {
      const presigned = await adapter.createSingleUploadUrl({
        bucket: bucket.name,
        region: bucket.region ?? undefined,
        key: providerKey,
        expiresInSeconds: 15 * 60,
        contentType: payload.mime_type,
        contentLength: payload.file_size,
        preventOverwrite: true,
      });

      await db.insert(fileUploads).values({
        id: uploadId,
        userId: auth.user.id,
        bucketId: bucket.id,
        objectKey: providerKey,
        originalFilename: payload.original_filename,
        fileSize: payload.file_size,
        mimeType: payload.mime_type,
        uploadMode: mode,
        contentMd5: payload.content_md5 ?? null,
        contentSha256: payload.content_sha256 ?? null,
        status: 'initiated',
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      return ok({
        id: uploadId,
        upload_id: uploadId,
        bucket_id: bucket.id,
        bucket_name: bucket.name,
        object_key: stripBucketKeyPrefix(bucket, providerKey),
        upload_mode: mode,
        upload_url: presigned.url,
        url: presigned.url,
        method: presigned.method,
        headers: presigned.headers,
        expires_at: presigned.expiresAt.toISOString(),
      });
    }

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
      uploadMode: mode,
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

    return ok({
      id: uploadId,
      upload_id: uploadId,
      bucket_id: bucket.id,
      bucket_name: bucket.name,
      object_key: stripBucketKeyPrefix(bucket, providerKey),
      upload_mode: mode,
      part_size: partSize,
      total_parts: totalParts,
      expires_at: expiresAt.toISOString(),
    });
  });
}
