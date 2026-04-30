import { AliyunOssStorageAdapter } from './aliyun-oss';
import { OracleOciStorageAdapter } from './oracle-oci';
import { S3CompatibleStorageAdapter } from './s3-compatible';
import { TencentCosStorageAdapter } from './tencent-cos';
import type { StorageAdapter, StorageAdapterConfig } from './types';

function hasOracleFingerprint(config: StorageAdapterConfig) {
  const value = config.extraConfig?.fingerprint;
  return typeof value === 'string' && value.trim().length > 0;
}

export function createStorageAdapter(
  config: StorageAdapterConfig,
): StorageAdapter {
  switch (config.provider) {
    case 's3':
    case 'r2':
    case 'b2':
      return new S3CompatibleStorageAdapter(config.provider, config);
    case 'oci':
      return hasOracleFingerprint(config)
        ? new OracleOciStorageAdapter(config)
        : new S3CompatibleStorageAdapter(config.provider, config);
    case 'aliyun_oss':
      return new AliyunOssStorageAdapter(config);
    case 'tencent_cos':
      return new TencentCosStorageAdapter(config);
  }
}
