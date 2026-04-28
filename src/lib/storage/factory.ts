import { AliyunOssStorageAdapter } from './aliyun-oss';
import { S3CompatibleStorageAdapter } from './s3-compatible';
import { TencentCosStorageAdapter } from './tencent-cos';
import type { StorageAdapter, StorageAdapterConfig } from './types';

export function createStorageAdapter(
  config: StorageAdapterConfig,
): StorageAdapter {
  switch (config.provider) {
    case 's3':
    case 'r2':
    case 'b2':
    case 'oci':
      return new S3CompatibleStorageAdapter(config.provider, config);
    case 'aliyun_oss':
      return new AliyunOssStorageAdapter(config);
    case 'tencent_cos':
      return new TencentCosStorageAdapter(config);
  }
}
