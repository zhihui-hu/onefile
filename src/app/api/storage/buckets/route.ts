import { ok, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { storageAccounts, storageBuckets } from '@/lib/db/schema';
import { publicStorageBucket } from '@/lib/storage-config';
import { asc, eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  return withApiHandler(async () => {
    const user = await requireUser();
    const rows = await db
      .select({ bucket: storageBuckets, account: storageAccounts })
      .from(storageBuckets)
      .innerJoin(
        storageAccounts,
        eq(storageBuckets.storageAccountId, storageAccounts.id),
      )
      .where(eq(storageBuckets.userId, user.id))
      .orderBy(asc(storageAccounts.name), asc(storageBuckets.name));

    return ok({
      items: rows.map((row) => publicStorageBucket(row.bucket, row.account)),
    });
  });
}
