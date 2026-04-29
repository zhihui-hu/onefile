import { db } from '@/lib/db/client';
import {
  authRefreshTokens,
  fileUploads,
  oauthTokens,
  storageAccounts,
  storageBuckets,
} from '@/lib/db/schema';
import { adapterFromAccount } from '@/lib/storage-config';
import { and, eq, inArray, isNotNull, lt, or } from 'drizzle-orm';

const COMPLETED_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const TERMINAL_UPLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

let cleanupTimer: NodeJS.Timeout | null = null;
let cleanupInFlight = false;

function iso(date = new Date()) {
  return date.toISOString();
}

function ago(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

export async function runCleanup() {
  if (cleanupInFlight) {
    return { skipped: true };
  }

  cleanupInFlight = true;
  try {
    const now = iso();
    const completedBefore = ago(COMPLETED_UPLOAD_TTL_MS);
    const terminalBefore = ago(TERMINAL_UPLOAD_TTL_MS);

    const expiredUploads = await db
      .update(fileUploads)
      .set({ status: 'expired', updatedAt: now })
      .where(
        and(
          inArray(fileUploads.status, ['initiated', 'uploading']),
          lt(fileUploads.expiresAt, now),
        ),
      )
      .returning();

    const abortTargets = await db
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
      .where(
        and(
          eq(fileUploads.uploadMode, 'multipart'),
          isNotNull(fileUploads.providerUploadId),
          inArray(fileUploads.status, ['failed', 'aborted', 'expired']),
        ),
      );

    let abortedMultipartUploads = 0;
    for (const row of abortTargets) {
      try {
        await adapterFromAccount(row.account).abortMultipartUpload({
          bucket: row.bucket.name,
          region: row.bucket.region ?? undefined,
          key: row.upload.objectKey,
          uploadId: row.upload.providerUploadId ?? '',
        });
        abortedMultipartUploads += 1;
      } catch {
        // Provider abort is idempotent enough for cleanup: retry next interval.
      }
    }

    const completedDeleted = await db
      .delete(fileUploads)
      .where(
        and(
          eq(fileUploads.status, 'completed'),
          isNotNull(fileUploads.completedAt),
          lt(fileUploads.completedAt, completedBefore),
        ),
      )
      .returning();

    const terminalDeleted = await db
      .delete(fileUploads)
      .where(
        and(
          inArray(fileUploads.status, ['failed', 'aborted', 'expired']),
          lt(fileUploads.updatedAt, terminalBefore),
        ),
      )
      .returning();

    const refreshDeleted = await db
      .delete(authRefreshTokens)
      .where(
        or(
          lt(authRefreshTokens.expiresAt, now),
          and(
            isNotNull(authRefreshTokens.revokedAt),
            lt(authRefreshTokens.revokedAt, terminalBefore),
          ),
        ),
      )
      .returning();

    const oauthDeleted = await db
      .delete(oauthTokens)
      .where(
        or(
          and(isNotNull(oauthTokens.expiresAt), lt(oauthTokens.expiresAt, now)),
          and(
            isNotNull(oauthTokens.revokedAt),
            lt(oauthTokens.revokedAt, terminalBefore),
          ),
        ),
      )
      .returning();

    return {
      skipped: false,
      expired_uploads: expiredUploads.length,
      aborted_multipart_uploads: abortedMultipartUploads,
      deleted_completed_uploads: completedDeleted.length,
      deleted_terminal_uploads: terminalDeleted.length,
      deleted_refresh_tokens: refreshDeleted.length,
      deleted_oauth_tokens: oauthDeleted.length,
    };
  } finally {
    cleanupInFlight = false;
  }
}

export function startCleanupScheduler() {
  if (cleanupTimer || process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  cleanupTimer = setInterval(() => {
    void runCleanup();
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
  void runCleanup();
}
