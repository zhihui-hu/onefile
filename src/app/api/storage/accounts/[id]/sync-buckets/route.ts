import { HttpError, ok, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { storageBuckets } from '@/lib/db/schema';
import {
  adapterFromAccount,
  getStorageAccountForUser,
  publicStorageBucket,
} from '@/lib/storage-config';
import { and, eq, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

function optionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function firstString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = optionalString(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function tencentBucketName(bucketName: string, accountId: string | null) {
  if (!accountId || bucketName.endsWith(`-${accountId}`)) {
    return bucketName;
  }

  return `${bucketName}-${accountId}`;
}

function buildDefaultBucketPublicUrl({
  provider,
  bucketName,
  region,
  accountId,
  namespace,
}: {
  provider: string;
  bucketName: string;
  region?: string | null;
  accountId?: string | null;
  namespace?: string | null;
}) {
  const normalizedBucket = optionalString(bucketName);
  if (!normalizedBucket) {
    return null;
  }

  switch (provider) {
    case 'r2': {
      const normalizedAccountId = optionalString(accountId);
      return normalizedAccountId
        ? `https://${normalizedBucket}.${normalizedAccountId}.r2.cloudflarestorage.com`
        : null;
    }
    case 's3': {
      const regionValue = optionalString(region) ?? 'us-east-1';
      return `https://${normalizedBucket}.s3.${regionValue}.amazonaws.com`;
    }
    case 'aliyun_oss': {
      const regionValue = optionalString(region) ?? 'cn-hangzhou';
      return `https://${normalizedBucket}.oss-${regionValue}.aliyuncs.com`;
    }
    case 'tencent_cos': {
      const regionValue = optionalString(region) ?? 'ap-guangzhou';
      const host = tencentBucketName(
        normalizedBucket,
        optionalString(accountId),
      );
      return `https://${host}.cos.${regionValue}.myqcloud.com`;
    }
    case 'oci': {
      const regionValue = optionalString(region);
      const namespaceValue = optionalString(namespace);
      return regionValue && namespaceValue
        ? `https://objectstorage.${regionValue}.oraclecloud.com/n/${namespaceValue}/b/${normalizedBucket}/o`
        : null;
    }
    default:
      return null;
  }
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
      const publicBaseUrl = buildDefaultBucketPublicUrl({
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
          endpoint: account.endpoint,
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
            endpoint: account.endpoint,
            publicBaseUrl: sql`coalesce(nullif(${storageBuckets.publicBaseUrl}, ''), excluded.public_base_url)`,
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
