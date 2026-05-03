import { db } from '@/lib/db/client';
import {
  authRefreshTokens,
  fileUploads,
  oauthTokens,
  storageAccounts,
  storageBuckets,
} from '@/lib/db/schema';
import { debugError, debugLog } from '@/lib/debug';
import { adapterFromAccountForBucket } from '@/lib/storage-config';

export async function abortOrphanUpload(uploadId: string) {
  try {
    const [upload] = await db
      .select({
        upload: fileUploads,
        bucket: storageBuckets,
        account: storageAccounts,
      })
      .from(fileUploads)
      .innerJoin(storageBuckets, eq(fileUploads.bucketId, storageBuckets.id))
      .innerJoin(
        storageAccounts,
        eq(storageBuckets.storageAccountId, storageAccounts.id),
      )
      .where(eq(fileUploads.id, uploadId))
      .limit(1);

    if (!upload) {
      return; // Already deleted
    }

    if (upload.upload.status === 'completed') {
      return; // Already completed successfully
    }

    // If it's a multipart upload, we need to abort it on the provider
    if (
      upload.upload.uploadMode === 'multipart' &&
      upload.upload.providerUploadId
    ) {
      try {
        await adapterFromAccountForBucket(
          upload.account,
          upload.bucket,
        ).abortMultipartUpload({
          bucket: upload.bucket.name,
          region: upload.bucket.region ?? undefined,
          key: upload.upload.objectKey,
          uploadId: upload.upload.providerUploadId,
        });
        debugLog('cleanup:aborted-multipart', { upload_id: uploadId });
      } catch (error) {
        debugError('cleanup:abort-multipart:error', {
          upload_id: uploadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Delete the upload record from database
    await db.delete(fileUploads).where(eq(fileUploads.id, uploadId));
    debugLog('cleanup:deleted-orphan-upload', { upload_id: uploadId });
  } catch (error) {
    debugError('cleanup:orphan-upload-error', {
      upload_id: uploadId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Schedules an asynchronous background cleanup task to abort and delete
 * the upload if it doesn't complete within the specified timeout.
 */
export function scheduleUploadCleanup(uploadId: string, timeoutMs: number) {
  setTimeout(() => {
    void abortOrphanUpload(uploadId).catch(() => undefined);
  }, timeoutMs);
}
