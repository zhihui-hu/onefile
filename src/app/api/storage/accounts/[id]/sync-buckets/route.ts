import { HttpError, ok, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { storageBuckets } from '@/lib/db/schema';
import {
  adapterFromAccount,
  getStorageAccountForUser,
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
    const accountId = Number(id);
    if (!Number.isInteger(accountId)) {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid account id');
    }

    const account = await getStorageAccountForUser(user.id, accountId);
    const adapter = adapterFromAccount(account);
    const listed = await adapter.listBuckets();
    const now = new Date().toISOString();
    const buckets = [];

    for (const bucket of listed.buckets) {
      const [synced] = await db
        .insert(storageBuckets)
        .values({
          userId: user.id,
          storageAccountId: account.id,
          name: bucket.name,
          region: bucket.region ?? account.region,
          endpoint: account.endpoint,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            storageBuckets.userId,
            storageBuckets.storageAccountId,
            storageBuckets.name,
          ],
          set: {
            region: bucket.region ?? account.region,
            endpoint: account.endpoint,
            updatedAt: now,
          },
        })
        .returning();
      buckets.push(publicStorageBucket(synced, account));
    }

    const existingDefault = await db
      .select()
      .from(storageBuckets)
      .where(
        and(
          eq(storageBuckets.userId, user.id),
          eq(storageBuckets.isDefault, true),
        ),
      )
      .limit(1);

    if (existingDefault.length === 0 && buckets[0]) {
      await db
        .update(storageBuckets)
        .set({ isDefault: true, updatedAt: now })
        .where(eq(storageBuckets.id, Number(buckets[0].id)));
    }

    return ok({ items: buckets });
  });
}
