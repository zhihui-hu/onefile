import { HttpError } from '@/lib/api/response';
import { decryptText, encryptText } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import {
  type StorageAccount,
  type StorageBucket,
  storageAccounts,
  storageBuckets,
} from '@/lib/db/schema';
import { createStorageAdapter } from '@/lib/storage';
import { type StorageAdapterConfig } from '@/lib/storage/types';
import { and, eq } from 'drizzle-orm';

function parseExtraConfig(value: string | null | undefined) {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function secretHint(secret: string) {
  const visible = secret.slice(-4);
  return visible ? `****${visible}` : '****';
}

export function publicStorageAccount(account: StorageAccount) {
  return {
    id: account.id,
    name: account.name,
    provider: account.provider,
    provider_account_id: account.providerAccountId,
    region: account.region,
    endpoint: account.endpoint,
    namespace: account.namespace,
    compartment_id: account.compartmentId,
    access_key_id: account.accessKeyId,
    credential_hint: account.credentialHint,
    extra_config: parseExtraConfig(account.extraConfig),
    status: account.status,
    last_checked_at: account.lastCheckedAt,
    last_error: account.lastError,
    credentials_updated_at: account.credentialsUpdatedAt,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}

export function publicStorageBucket(
  bucket: StorageBucket,
  account?: StorageAccount,
) {
  return {
    id: bucket.id,
    user_id: bucket.userId,
    storage_account_id: bucket.storageAccountId,
    account_name: account?.name,
    provider: account?.provider,
    provider_account_id: account?.providerAccountId,
    name: bucket.name,
    region: bucket.region,
    endpoint: bucket.endpoint,
    namespace: account?.namespace,
    key_prefix: bucket.keyPrefix,
    public_base_url: bucket.publicBaseUrl,
    visibility: bucket.visibility,
    last_checked_at: bucket.lastCheckedAt,
    last_error: bucket.lastError,
    created_at: bucket.createdAt,
    updated_at: bucket.updatedAt,
  };
}

export async function getStorageAccountForUser(
  userId: number,
  accountId: number,
) {
  const [account] = await db
    .select()
    .from(storageAccounts)
    .where(
      and(
        eq(storageAccounts.id, accountId),
        eq(storageAccounts.userId, userId),
      ),
    )
    .limit(1);

  if (!account) {
    throw new HttpError(404, 'NOT_FOUND', 'Storage account not found');
  }

  return account;
}

export async function getStorageBucketForUser(
  userId: number,
  bucketId: number,
) {
  const [row] = await db
    .select({ bucket: storageBuckets, account: storageAccounts })
    .from(storageBuckets)
    .innerJoin(
      storageAccounts,
      eq(storageBuckets.storageAccountId, storageAccounts.id),
    )
    .where(
      and(eq(storageBuckets.id, bucketId), eq(storageBuckets.userId, userId)),
    )
    .limit(1);

  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', 'Storage bucket not found');
  }

  return row;
}

function adapterConfigFromAccount(
  account: StorageAccount,
): StorageAdapterConfig {
  const extraConfig = parseExtraConfig(account.extraConfig);

  if (account.providerAccountId) {
    extraConfig.accountId = account.providerAccountId;
  }
  if (account.namespace) {
    extraConfig.namespace = account.namespace;
  }
  if (account.compartmentId) {
    extraConfig.compartmentId = account.compartmentId;
  }

  return {
    provider: account.provider,
    accessKeyId: account.accessKeyId,
    secretAccessKey: decryptText(account.secretKeyCiphertext),
    region: account.region,
    endpoint: account.endpoint,
    extraConfig,
  };
}

export function adapterFromAccount(account: StorageAccount) {
  return createStorageAdapter(adapterConfigFromAccount(account));
}

export function adapterFromAccountForBucket(
  account: StorageAccount,
  bucket: StorageBucket,
) {
  if (account.provider !== 'aliyun_oss') {
    return adapterFromAccount(account);
  }

  const config = adapterConfigFromAccount(account);
  const region = bucket.region?.trim();
  const endpoint = bucket.endpoint?.trim();

  return createStorageAdapter({
    ...config,
    region: region || config.region,
    endpoint: endpoint || (region ? null : config.endpoint),
  });
}

export function applyBucketKeyPrefix(bucket: StorageBucket, objectKey: string) {
  const prefix = bucket.keyPrefix.replace(/^\/+|\/+$/g, '');
  const key = objectKey.replace(/^\/+/, '');
  return prefix ? `${prefix}/${key}` : key;
}

export function stripBucketKeyPrefix(bucket: StorageBucket, objectKey: string) {
  const prefix = bucket.keyPrefix.replace(/^\/+|\/+$/g, '');
  if (!prefix) {
    return objectKey;
  }
  const normalizedPrefix = `${prefix}/`;
  return objectKey.startsWith(normalizedPrefix)
    ? objectKey.slice(normalizedPrefix.length)
    : objectKey;
}

export function encryptedSecret(secret: string) {
  return {
    secretKeyCiphertext: encryptText(secret),
    credentialHint: secretHint(secret),
    credentialsUpdatedAt: new Date().toISOString(),
  };
}
