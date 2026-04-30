import { HttpError, ok, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { storageBuckets } from '@/lib/db/schema';
import {
  adapterFromAccount,
  getStorageAccountForUser,
  publicStorageBucket,
} from '@/lib/storage-config';
import {
  defaultBucketPublicUrl,
  defaultStorageEndpoint,
  optionalStorageString,
} from '@/lib/storage/endpoints';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

function firstString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = optionalStorageString(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

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
      const region = firstString(bucket.region, account.region);
      const endpoint =
        account.endpoint ??
        defaultStorageEndpoint({
          provider: account.provider,
          region,
          accountId: account.providerAccountId,
        });
      const publicBaseUrl = defaultBucketPublicUrl({
        provider: account.provider,
        bucketName: bucket.name,
        region,
        accountId: account.providerAccountId,
        namespace: account.namespace,
      });

      const [synced] = await db
        .insert(storageBuckets)
        .values({
          userId: user.id,
          storageAccountId: account.id,
          name: bucket.name,
          region,
          endpoint,
          publicBaseUrl,
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
            region,
            endpoint,
            publicBaseUrl: sql`coalesce(nullif(${storageBuckets.publicBaseUrl}, ''), excluded.public_base_url)`,
            updatedAt: now,
          },
        })
        .returning();
      buckets.push(publicStorageBucket(synced, account));
    }

    return ok({ items: buckets });
  });
}
