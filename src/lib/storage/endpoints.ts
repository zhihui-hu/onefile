import type { StorageProviderId } from './types';

export function optionalStorageString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function tencentBucketName(bucketName: string, accountId?: string | null) {
  const normalizedAccountId = optionalStorageString(accountId);
  if (!normalizedAccountId || bucketName.endsWith(`-${normalizedAccountId}`)) {
    return bucketName;
  }

  return `${bucketName}-${normalizedAccountId}`;
}

function defaultStorageRegion(provider: StorageProviderId) {
  switch (provider) {
    case 's3':
      return 'us-east-1';
    case 'aliyun_oss':
      return 'cn-hangzhou';
    case 'tencent_cos':
      return 'ap-guangzhou';
    default:
      return null;
  }
}

function normalizeAliyunRegion(region?: string | null) {
  return optionalStorageString(region)?.replace(/^oss-/, '') ?? null;
}

export function storageRegionOrDefault(
  provider: StorageProviderId,
  region?: string | null,
) {
  if (provider === 'aliyun_oss') {
    return normalizeAliyunRegion(region) ?? defaultStorageRegion(provider);
  }

  return optionalStorageString(region) ?? defaultStorageRegion(provider);
}

function aliyunEndpointFromRegion(region?: string | null) {
  const regionValue =
    normalizeAliyunRegion(region) ?? defaultStorageRegion('aliyun_oss');
  return `https://oss-${regionValue}.aliyuncs.com`;
}

export function defaultStorageEndpoint({
  provider,
  region,
  accountId,
}: {
  provider: StorageProviderId;
  region?: string | null;
  accountId?: string | null;
}) {
  switch (provider) {
    case 'r2': {
      const normalizedAccountId = optionalStorageString(accountId);
      return normalizedAccountId
        ? `https://${normalizedAccountId}.r2.cloudflarestorage.com`
        : null;
    }
    case 'aliyun_oss':
      return aliyunEndpointFromRegion(region);
    case 'tencent_cos':
      return null;
    default:
      return null;
  }
}

export function defaultBucketPublicUrl({
  provider,
  bucketName,
  region,
  accountId,
  namespace,
}: {
  provider: StorageProviderId;
  bucketName: string;
  region?: string | null;
  accountId?: string | null;
  namespace?: string | null;
}) {
  const normalizedBucket = optionalStorageString(bucketName);
  if (!normalizedBucket) {
    return null;
  }

  switch (provider) {
    case 'r2': {
      const normalizedAccountId = optionalStorageString(accountId);
      return normalizedAccountId
        ? `https://${normalizedBucket}.${normalizedAccountId}.r2.cloudflarestorage.com`
        : null;
    }
    case 's3': {
      const regionValue =
        optionalStorageString(region) ?? defaultStorageRegion(provider);
      return `https://${normalizedBucket}.s3.${regionValue}.amazonaws.com`;
    }
    case 'aliyun_oss': {
      const regionValue =
        normalizeAliyunRegion(region) ?? defaultStorageRegion(provider);
      return `https://${normalizedBucket}.oss-${regionValue}.aliyuncs.com`;
    }
    case 'tencent_cos': {
      const regionValue =
        optionalStorageString(region) ?? defaultStorageRegion(provider);
      const host = tencentBucketName(normalizedBucket, accountId);
      return `https://${host}.cos.${regionValue}.myqcloud.com`;
    }
    case 'oci': {
      const regionValue = optionalStorageString(region);
      const namespaceValue = optionalStorageString(namespace);
      return regionValue && namespaceValue
        ? `https://objectstorage.${regionValue}.oraclecloud.com/n/${namespaceValue}/b/${normalizedBucket}/o`
        : null;
    }
    default:
      return null;
  }
}
