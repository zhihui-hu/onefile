import { ok, withApiHandler } from '@/lib/api/response';
import { getAuthContext } from '@/lib/auth/api-keys';
import { db } from '@/lib/db/client';
import { storageAccounts, storageBuckets } from '@/lib/db/schema';
import { publicStorageBucket } from '@/lib/storage-config';
import { asc, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withApiHandler(
    async () => {
      const auth = await getAuthContext(request, ['files:read']);
      const rows = await db
        .select({ bucket: storageBuckets, account: storageAccounts })
        .from(storageBuckets)
        .innerJoin(
          storageAccounts,
          eq(storageBuckets.storageAccountId, storageAccounts.id),
        )
        .where(eq(storageBuckets.userId, auth.user.id))
        .orderBy(asc(storageAccounts.name), asc(storageBuckets.name));

      return ok({
        items: rows.map((row) => publicStorageBucket(row.bucket, row.account)),
      });
    },
    { label: 'api/storage/buckets:get', request },
  );
}
