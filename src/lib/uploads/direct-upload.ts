import { HttpError, ok } from '@/lib/api/response';
import { randomToken } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import { storageAccounts, storageBuckets } from '@/lib/db/schema';
import { avoidObjectKeyConflict, buildObjectKey } from '@/lib/files/keys';
import {
  WEBP_MIME_TYPE,
  compressImageToWebp,
  isCompressibleImage,
  webpFilename,
} from '@/lib/image-compression';
import {
  adapterFromAccountForBucket,
  applyBucketKeyPrefix,
  getStorageBucketForUser,
  stripBucketKeyPrefix,
} from '@/lib/storage-config';
import { defaultBucketPublicUrl } from '@/lib/storage/endpoints';
import { and, asc, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

const ONE_MIB = 1024 * 1024;
const MAX_DIRECT_UPLOAD_SIZE = 100 * ONE_MIB;

export type DirectUploadStrategy = {
  bucketId?: number | string | null;
  compressImages: boolean;
  publicUploadUuid?: string | null;
};

export function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function formBoolean(formData: FormData, name: string) {
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

function publicObjectUrl({
  account,
  bucket,
  providerKey,
}: {
  account: typeof storageAccounts.$inferSelect;
  bucket: typeof storageBuckets.$inferSelect;
  providerKey: string;
}) {
  const base =
    bucket.publicBaseUrl?.trim().replace(/\/+$/, '') ||
    defaultBucketPublicUrl({
      provider: account.provider,
      bucketName: bucket.name,
      region: bucket.region || account.region,
      accountId: account.providerAccountId,
      namespace: account.namespace,
    })?.replace(/\/+$/, '');

  if (!base) return null;

  const encodedKey = providerKey
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return encodedKey ? `${base}/${encodedKey}` : base;
}

async function chooseUploadBucket(
  userId: number,
  bucketIdValue?: number | string | null,
) {
  if (bucketIdValue !== undefined && bucketIdValue !== null) {
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

  return candidates[Math.floor(Math.random() * candidates.length)];
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
      'Direct upload cannot exceed 100 MiB; use multipart upload instead',
      { max_direct_upload_size: MAX_DIRECT_UPLOAD_SIZE },
    );
  }

  return { formData, file };
}

export async function handleDirectUpload(
  request: NextRequest,
  options: {
    userId: number;
    strategy:
      | DirectUploadStrategy
      | ((formData: FormData) => DirectUploadStrategy);
  },
) {
  const { formData, file } = await parseUploadFile(request);
  const strategy =
    typeof options.strategy === 'function'
      ? options.strategy(formData)
      : options.strategy;
  const originalFilename = formText(formData, 'original_filename') ?? file.name;
  const originalMimeType = file.type || 'application/octet-stream';
  const shouldCompress =
    strategy.compressImages &&
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
    options.userId,
    strategy.bucketId,
  );
  const adapter = adapterFromAccountForBucket(account, bucket);
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
  const uploadId = randomToken(18);
  const objectKey = stripBucketKeyPrefix(bucket, providerKey);
  const url =
    uploaded.location ??
    publicObjectUrl({
      account,
      bucket,
      providerKey,
    });

  // Direct uploads complete synchronously, no need to persist in fileUploads

  return ok(
    {
      id: uploadId,
      upload_id: uploadId,
      bucket_id: bucket.id,
      bucket_name: bucket.name,
      object_key: objectKey,
      original_filename: originalFilename,
      original_mime_type: originalMimeType,
      file_size: body.byteLength,
      original_file_size: file.size,
      mime_type: mimeType,
      compressed: shouldCompress,
      etag: uploaded.etag ?? null,
      location: uploaded.location ?? null,
      url,
      ...(strategy.publicUploadUuid
        ? { public_upload_uuid: strategy.publicUploadUuid }
        : {}),
    },
    { status: 201 },
  );
}
