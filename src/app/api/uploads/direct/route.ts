import { HttpError, ok, withApiHandler } from '@/lib/api/response';
import { getApiKeyAuthContext } from '@/lib/auth/api-keys';
import { randomToken } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import { fileUploads, storageAccounts, storageBuckets } from '@/lib/db/schema';
import { avoidObjectKeyConflict, buildObjectKey } from '@/lib/files/keys';
import {
  WEBP_MIME_TYPE,
  compressImageToWebp,
  isCompressibleImage,
  webpFilename,
} from '@/lib/image-compression';
import {
  adapterFromAccount,
  applyBucketKeyPrefix,
  getStorageBucketForUser,
  stripBucketKeyPrefix,
} from '@/lib/storage-config';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const ONE_MIB = 1024 * 1024;
const MAX_DIRECT_UPLOAD_SIZE = 100 * ONE_MIB;

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function formBoolean(formData: FormData, name: string) {
  const value = formText(formData, name);
  if (!value) {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
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

async function parseUploadFile(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new HttpError(
      400,
      'BAD_REQUEST',
      'Request body must be multipart/form-data',
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new HttpError(400, 'BAD_REQUEST', 'file is required');
  }
  if (file.size > MAX_DIRECT_UPLOAD_SIZE) {
    throw new HttpError(
      400,
      'BAD_REQUEST',
      'Direct upload cannot exceed 100 MiB; use presigned upload instead',
      { max_direct_upload_size: MAX_DIRECT_UPLOAD_SIZE },
    );
  }

  return { formData, file };
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const auth = await getApiKeyAuthContext(request, ['uploads:write']);
    const { formData, file } = await parseUploadFile(request);
    const originalFilename =
      formText(formData, 'original_filename') ?? file.name;
    const originalMimeType = file.type || 'application/octet-stream';
    const shouldCompress =
      formBoolean(formData, 'compress') &&
      isCompressibleImage(originalMimeType, originalFilename);
    const arrayBuffer = await file.arrayBuffer();
    const originalBody: Buffer<ArrayBufferLike> = Buffer.from(arrayBuffer);
    let body: Buffer<ArrayBufferLike> = originalBody;
    if (shouldCompress) {
      try {
        body = await compressImageToWebp(originalBody);
      } catch {
        throw new HttpError(400, 'BAD_REQUEST', 'Image compression failed');
      }
    }
    const storedFilename = shouldCompress
      ? webpFilename(originalFilename)
      : originalFilename;
    const mimeType = shouldCompress ? WEBP_MIME_TYPE : originalMimeType;
    const explicitObjectKey = formText(formData, 'object_key');
    const relativeKey = buildObjectKey({
      filename: storedFilename,
      currentPrefix: formText(formData, 'current_prefix'),
      relativePath: formText(formData, 'relative_path'),
      explicitObjectKey: explicitObjectKey
        ? shouldCompress
          ? webpFilename(explicitObjectKey)
          : explicitObjectKey
        : undefined,
      defaultDatePrefix: !explicitObjectKey,
    });

    const { bucket, account } = await chooseUploadBucket(
      auth.user.id,
      formText(formData, 'bucket_id'),
    );
    const adapter = adapterFromAccount(account);
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
    const uploaded = await adapter.putObject({
      bucket: bucket.name,
      region: bucket.region ?? undefined,
      key: providerKey,
      body,
      contentType: mimeType,
      contentLength: body.byteLength,
      preventOverwrite: true,
      metadata: shouldCompress
        ? {
            'onefile-original-mime-type': originalMimeType,
            'onefile-original-filename': originalFilename,
          }
        : undefined,
    });
    const now = new Date();
    const uploadId = randomToken(18);

    await db.insert(fileUploads).values({
      id: uploadId,
      userId: auth.user.id,
      bucketId: bucket.id,
      objectKey: providerKey,
      originalFilename,
      fileSize: body.byteLength,
      mimeType,
      uploadMode: 'single',
      status: 'completed',
      expiresAt: now.toISOString(),
      completedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return ok(
      {
        id: uploadId,
        upload_id: uploadId,
        bucket_id: bucket.id,
        bucket_name: bucket.name,
        object_key: stripBucketKeyPrefix(bucket, providerKey),
        original_filename: originalFilename,
        original_mime_type: originalMimeType,
        file_size: body.byteLength,
        original_file_size: file.size,
        mime_type: mimeType,
        compressed: shouldCompress,
        etag: uploaded.etag ?? null,
        location: uploaded.location ?? null,
      },
      { status: 201 },
    );
  });
}
