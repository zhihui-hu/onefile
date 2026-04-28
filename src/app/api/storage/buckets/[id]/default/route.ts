import { HttpError, ok, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { storageBuckets } from '@/lib/db/schema';
import {
  getStorageBucketForUser,
  publicStorageBucket,
} from '@/lib/storage-config';
import { and, eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const bucketId = Number(id);
    if (!Number.isInteger(bucketId)) {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid bucket id');
    }

    const { bucket, account } = await getStorageBucketForUser(
      user.id,
      bucketId,
    );
    await db
      .update(storageBuckets)
      .set({ isDefault: false, updatedAt: new Date().toISOString() })
      .where(eq(storageBuckets.userId, user.id));

    const [updated] = await db
      .update(storageBuckets)
      .set({ isDefault: true, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(storageBuckets.id, bucket.id),
          eq(storageBuckets.userId, user.id),
        ),
      )
      .returning();

    return ok({ bucket: publicStorageBucket(updated, account) });
  });
}
