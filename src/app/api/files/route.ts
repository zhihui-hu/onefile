import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { getAuthContext } from '@/lib/auth/api-tokens';
import { db } from '@/lib/db/client';
import { fileUploads } from '@/lib/db/schema';
import { sanitizePrefix } from '@/lib/files/keys';
import {
  adapterFromAccount,
  applyBucketKeyPrefix,
  getStorageBucketForUser,
  stripBucketKeyPrefix,
} from '@/lib/storage-config';
import { and, eq, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const deleteSchema = z
  .object({
    bucket_id: z.union([z.number().int(), z.string().min(1)]),
    object_key: z.string().min(1).optional(),
    object_keys: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine((value) => value.object_key || value.object_keys?.length, {
    message: 'object_key or object_keys is required',
  });

function nameFromPath(path: string) {
  const clean = path.endsWith('/') ? path.slice(0, -1) : path;
  return clean.split('/').filter(Boolean).pop() ?? clean;
}

function parentPrefix(prefix: string) {
  const segments = sanitizePrefix(prefix).split('/').filter(Boolean);
  segments.pop();
  return segments.length > 0 ? `${segments.join('/')}/` : '';
}

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const auth = await getAuthContext(request, ['files:read']);
    const bucketId = Number(request.nextUrl.searchParams.get('bucket_id'));
    if (!Number.isInteger(bucketId)) {
      throw new HttpError(400, 'BAD_REQUEST', 'bucket_id is required');
    }

    const prefix = sanitizePrefix(request.nextUrl.searchParams.get('prefix'));
    const search = request.nextUrl.searchParams
      .get('search')
      ?.trim()
      .toLowerCase();
    const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 200);
    const { bucket, account } = await getStorageBucketForUser(
      auth.user.id,
      bucketId,
    );
    const adapter = adapterFromAccount(account);
    const providerPrefix = applyBucketKeyPrefix(bucket, prefix);

    const listed = await adapter.listObjects({
      bucket: bucket.name,
      region: bucket.region ?? undefined,
      prefix: providerPrefix,
      delimiter: '/',
      cursor,
      limit: Number.isFinite(limit) ? limit : 200,
    });

    const items = listed.items
      .map((item) => {
        const relativePath = stripBucketKeyPrefix(bucket, item.path);
        return {
          kind: item.kind === 'directory' ? 'folder' : 'file',
          name: item.name || nameFromPath(relativePath),
          path: relativePath,
          size: item.size ?? null,
          updated_at: item.updatedAt?.toISOString() ?? null,
          etag: item.etag ?? null,
          mime_type: item.contentType ?? null,
        };
      })
      .filter((item) =>
        search
          ? item.name.toLowerCase().includes(search) ||
            item.path.toLowerCase().includes(search)
          : true,
      );

    return ok({
      items,
      prefix,
      parent_prefix: parentPrefix(prefix),
      page: {
        next_cursor: listed.nextCursor ?? null,
        is_truncated: listed.isTruncated,
      },
    });
  });
}

export async function DELETE(request: NextRequest) {
  return withApiHandler(async () => {
    const auth = await getAuthContext(request, ['files:delete']);
    const payload = await parseJson(request, deleteSchema);
    const bucketId = Number(payload.bucket_id);
    if (!Number.isInteger(bucketId)) {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid bucket_id');
    }

    const objectKeys = [
      ...(payload.object_key ? [payload.object_key] : []),
      ...(payload.object_keys ?? []),
    ];

    const { bucket, account } = await getStorageBucketForUser(
      auth.user.id,
      bucketId,
    );
    const providerKeys = [...new Set(objectKeys)].map((objectKey) =>
      applyBucketKeyPrefix(bucket, objectKey),
    );
    const adapter = adapterFromAccount(account);
    for (const providerKey of providerKeys) {
      await adapter.deleteObject({
        bucket: bucket.name,
        region: bucket.region ?? undefined,
        key: providerKey,
      });
    }

    await db
      .update(fileUploads)
      .set({
        status: 'aborted',
        abortedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(fileUploads.userId, auth.user.id),
          eq(fileUploads.bucketId, bucket.id),
          inArray(fileUploads.objectKey, providerKeys),
          inArray(fileUploads.status, ['initiated', 'uploading']),
        ),
      );

    return ok({
      deleted: true,
      deleted_count: providerKeys.length,
      object_key: payload.object_key,
      object_keys: objectKeys,
    });
  });
}
