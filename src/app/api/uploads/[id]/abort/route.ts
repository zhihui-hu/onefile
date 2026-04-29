import { HttpError, ok, withApiHandler } from '@/lib/api/response';
import { getAuthContext } from '@/lib/auth/api-tokens';
import { db } from '@/lib/db/client';
import { fileUploads } from '@/lib/db/schema';
import {
  adapterFromAccount,
  getStorageBucketForUser,
} from '@/lib/storage-config';
import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const auth = await getAuthContext(request, ['uploads:write']);
    const { id } = await context.params;
    const [upload] = await db
      .select()
      .from(fileUploads)
      .where(and(eq(fileUploads.id, id), eq(fileUploads.userId, auth.user.id)))
      .limit(1);

    if (!upload) {
      throw new HttpError(404, 'NOT_FOUND', 'Upload not found');
    }
    if (upload.status === 'completed') {
      throw new HttpError(409, 'CONFLICT', 'Upload already completed');
    }
    if (upload.status === 'aborted') {
      return ok({ aborted: true, upload_id: upload.id });
    }

    if (upload.uploadMode === 'multipart' && upload.providerUploadId) {
      const { bucket, account } = await getStorageBucketForUser(
        auth.user.id,
        upload.bucketId,
      );
      const adapter = adapterFromAccount(account);
      await adapter.abortMultipartUpload({
        bucket: bucket.name,
        region: bucket.region ?? undefined,
        key: upload.objectKey,
        uploadId: upload.providerUploadId,
      });
    }

    await db
      .update(fileUploads)
      .set({
        status: 'aborted',
        abortedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(fileUploads.id, upload.id));

    return ok({ aborted: true, upload_id: upload.id });
  });
}
