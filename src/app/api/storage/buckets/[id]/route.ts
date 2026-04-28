import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { storageBuckets } from '@/lib/db/schema';
import {
  getStorageBucketForUser,
  publicStorageBucket,
} from '@/lib/storage-config';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

const updateSchema = z.object({
  key_prefix: z.string().max(400).optional(),
  public_base_url: z.string().url().nullable().optional(),
  visibility: z.enum(['private', 'public']).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const bucketId = Number(id);
    if (!Number.isInteger(bucketId)) {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid bucket id');
    }

    const payload = await parseJson(request, updateSchema);
    const [updated] = await db
      .update(storageBuckets)
      .set({
        ...(payload.key_prefix !== undefined
          ? { keyPrefix: payload.key_prefix.replace(/^\/+/, '') }
          : {}),
        ...(payload.public_base_url !== undefined
          ? { publicBaseUrl: payload.public_base_url }
          : {}),
        ...(payload.visibility !== undefined
          ? { visibility: payload.visibility }
          : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(storageBuckets.id, bucketId),
          eq(storageBuckets.userId, user.id),
        ),
      )
      .returning();

    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'Storage bucket not found');
    }

    const { account } = await getStorageBucketForUser(user.id, bucketId);
    return ok({ bucket: publicStorageBucket(updated, account) });
  });
}
