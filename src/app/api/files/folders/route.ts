import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { getAuthContext } from '@/lib/auth/api-keys';
import { sanitizePrefix } from '@/lib/files/keys';
import {
  adapterFromAccountForBucket,
  applyBucketKeyPrefix,
  getStorageBucketForUser,
  stripBucketKeyPrefix,
} from '@/lib/storage-config';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const createFolderSchema = z.object({
  bucket_id: z.union([z.number().int(), z.string().min(1)]),
  prefix: z.string().optional(),
  name: z.string().min(1).max(255),
});

function sanitizeFolderName(name: string) {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\\/g, '/')
    .trim();

  if (
    !cleaned ||
    cleaned.startsWith('/') ||
    cleaned.endsWith('/') ||
    cleaned.includes('/') ||
    cleaned === '.' ||
    cleaned === '..'
  ) {
    throw new HttpError(400, 'BAD_REQUEST', 'Invalid folder name');
  }

  return cleaned;
}

export async function POST(request: NextRequest) {
  return withApiHandler(
    async () => {
      const auth = await getAuthContext(request, ['files:write']);
      const payload = await parseJson(request, createFolderSchema);
      const bucketId = Number(payload.bucket_id);
      if (!Number.isInteger(bucketId)) {
        throw new HttpError(400, 'BAD_REQUEST', 'Invalid bucket_id');
      }

      const prefix = sanitizePrefix(payload.prefix);
      const folderName = sanitizeFolderName(payload.name);
      const objectKey = `${prefix}${folderName}/`;
      const { bucket, account } = await getStorageBucketForUser(
        auth.user.id,
        bucketId,
      );
      const adapter = adapterFromAccountForBucket(account, bucket);
      const providerKey = applyBucketKeyPrefix(bucket, objectKey);

      await adapter.putObject({
        bucket: bucket.name,
        region: bucket.region ?? undefined,
        key: providerKey,
        body: Buffer.alloc(0),
        contentType: 'application/x-directory',
        contentLength: 0,
        preventOverwrite: true,
        metadata: {
          'onefile-kind': 'folder',
        },
      });

      return ok({
        created: true,
        object_key: stripBucketKeyPrefix(bucket, providerKey),
      });
    },
    {
      label: 'api/files/folders:post',
      request,
    },
  );
}
