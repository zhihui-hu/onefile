import type { StorageBucket } from '@/app/(main)/components/types';
import { defaultBucketPublicUrl } from '@/lib/storage/endpoints';
import {
  STORAGE_PROVIDER_IDS,
  type StorageProviderId,
} from '@/lib/storage/types';

const storageProviderIds = new Set<string>(STORAGE_PROVIDER_IDS);

function storageProviderId(value?: string | null): StorageProviderId | null {
  return value && storageProviderIds.has(value)
    ? (value as StorageProviderId)
    : null;
}

export function bucketPublicBaseUrl(bucket: StorageBucket | null) {
  if (!bucket) return null;

  const explicitBaseUrl = bucket.public_base_url?.trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, '');
  }

  const provider = storageProviderId(bucket.provider);
  if (!provider) return null;

  return (
    defaultBucketPublicUrl({
      provider,
      bucketName: bucket.name,
      region: bucket.region,
      accountId: bucket.provider_account_id,
      namespace: bucket.namespace,
    })?.replace(/\/+$/, '') ?? null
  );
}
