import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { getAuthContext } from '@/lib/auth/api-tokens';
import { db } from '@/lib/db/client';
import { fileUploadParts, fileUploads } from '@/lib/db/schema';
import {
  adapterFromAccount,
  getStorageBucketForUser,
} from '@/lib/storage-config';
import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const partSchema = z.object({
  part_number: z.number().int().positive(),
  content_length: z.number().int().positive().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const auth = await getAuthContext(request, ['uploads:write']);
    const { id } = await context.params;
    const payload = await parseJson(request, partSchema);
    const [upload] = await db
      .select()
      .from(fileUploads)
      .where(and(eq(fileUploads.id, id), eq(fileUploads.userId, auth.user.id)))
      .limit(1);

    if (
      !upload ||
      upload.uploadMode !== 'multipart' ||
      !upload.providerUploadId
    ) {
      throw new HttpError(404, 'NOT_FOUND', 'Multipart upload not found');
    }

    const { bucket, account } = await getStorageBucketForUser(
      auth.user.id,
      upload.bucketId,
    );
    const adapter = adapterFromAccount(account);
    const presigned = await adapter.presignMultipartPart({
      bucket: bucket.name,
      key: upload.objectKey,
      uploadId: upload.providerUploadId,
      partNumber: payload.part_number,
      contentLength: payload.content_length,
      expiresInSeconds: 15 * 60,
    });

    await db
      .update(fileUploadParts)
      .set({ status: 'pending', updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(fileUploadParts.uploadId, upload.id),
          eq(fileUploadParts.partNumber, payload.part_number),
        ),
      );

    await db
      .update(fileUploads)
      .set({ status: 'uploading', updatedAt: new Date().toISOString() })
      .where(eq(fileUploads.id, upload.id));

    return ok({
      part_number: payload.part_number,
      upload_url: presigned.url,
      url: presigned.url,
      method: presigned.method,
      headers: presigned.headers,
      expires_at: presigned.expiresAt.toISOString(),
    });
  });
}
