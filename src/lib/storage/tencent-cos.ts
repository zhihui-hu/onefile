import COS from 'cos-nodejs-sdk-v5';

import type {
  AbortMultipartUploadInput,
  CheckStorageCredentialsInput,
  CheckStorageCredentialsResult,
  CompleteMultipartUploadInput,
  CompleteMultipartUploadResult,
  CreateMultipartUploadInput,
  CreateMultipartUploadResult,
  DeleteObjectInput,
  DeleteObjectResult,
  HeadObjectInput,
  HeadObjectResult,
  ListStorageBucketsResult,
  ListStorageObjectsInput,
  ListStorageObjectsResult,
  PutObjectInput,
  PutObjectResult,
  StorageAdapter,
  StorageAdapterConfig,
  UploadPartInput,
  UploadPartResult,
} from './types';
import {
  basenameFromObjectPath,
  dateFromUnknown,
  getExtraString,
  normalizeErrorInfo,
  normalizeListLimit,
  normalizeObjectKey,
  normalizeOptionalString,
  normalizePrefix,
  numberFromUnknown,
} from './utils';

function sdkDomain(endpoint?: string | null) {
  const domain = normalizeOptionalString(endpoint);
  if (!domain || /\{bucket\}/i.test(domain)) {
    return undefined;
  }

  return domain;
}

export class TencentCosStorageAdapter implements StorageAdapter {
  readonly provider = 'tencent_cos' as const;
  private readonly client: COS;
  private readonly region: string;
  private readonly accountId?: string;

  constructor(config: StorageAdapterConfig) {
    this.region = normalizeOptionalString(config.region) ?? 'ap-guangzhou';
    this.accountId = getExtraString(config, 'accountId');
    const sdkExtraConfig = { ...(config.extraConfig ?? {}) };
    delete sdkExtraConfig.accountId;

    this.client = new COS({
      SecretId: config.accessKeyId,
      SecretKey: config.secretAccessKey,
      Domain: sdkDomain(config.endpoint),
      ForcePathStyle: config.forcePathStyle ?? undefined,
      ...sdkExtraConfig,
    });
  }

  private bucketName(bucket: string) {
    if (!this.accountId || bucket.endsWith(`-${this.accountId}`)) {
      return bucket;
    }

    return `${bucket}-${this.accountId}`;
  }

  private bucketRegion(region?: string | null) {
    return normalizeOptionalString(region) ?? this.region;
  }

  async checkCredentials(
    input: CheckStorageCredentialsInput = {},
  ): Promise<CheckStorageCredentialsResult> {
    try {
      if (input.bucket) {
        await this.client.headBucket({
          Bucket: this.bucketName(input.bucket),
          Region: this.bucketRegion(input.region),
        });
      } else {
        await this.client.getService();
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: normalizeErrorInfo(error) };
    }
  }

  async listBuckets(): Promise<ListStorageBucketsResult> {
    const output = await this.client.getService();
    return {
      buckets:
        output.Buckets?.map((bucket) => ({
          name: bucket.Name,
          region: bucket.Location,
          createdAt: dateFromUnknown(bucket.CreationDate),
        })) ?? [],
      isTruncated: false,
    };
  }

  async listObjects(
    input: ListStorageObjectsInput,
  ): Promise<ListStorageObjectsResult> {
    const output = await this.client.getBucket({
      Bucket: this.bucketName(input.bucket),
      Region: this.bucketRegion(input.region),
      Prefix: normalizePrefix(input.prefix),
      Delimiter: input.delimiter ?? '/',
      Marker: input.cursor,
      MaxKeys: normalizeListLimit(input.limit),
    });
    const folders =
      output.CommonPrefixes?.map((prefix) => ({
        kind: 'directory' as const,
        name: basenameFromObjectPath(prefix.Prefix),
        path: prefix.Prefix,
      })) ?? [];
    const files =
      output.Contents?.map((object) => ({
        kind: 'file' as const,
        name: basenameFromObjectPath(object.Key),
        path: object.Key,
        size: numberFromUnknown(object.Size),
        updatedAt: dateFromUnknown(object.LastModified),
        etag: object.ETag,
        storageClass: object.StorageClass,
      })) ?? [];
    return {
      items: [...folders, ...files],
      nextCursor: output.NextMarker,
      isTruncated: output.IsTruncated === 'true',
    };
  }

  async createMultipartUpload(
    input: CreateMultipartUploadInput,
  ): Promise<CreateMultipartUploadResult> {
    const output = await this.client.multipartInit({
      Bucket: this.bucketName(input.bucket),
      Region: this.bucketRegion(input.region),
      Key: normalizeObjectKey(input.key),
      ContentType: input.contentType,
    });
    return { bucket: input.bucket, key: input.key, uploadId: output.UploadId };
  }

  async uploadPart(input: UploadPartInput): Promise<UploadPartResult> {
    const output = await this.client.multipartUpload({
      Bucket: this.bucketName(input.bucket),
      Region: this.bucketRegion(input.region),
      Key: normalizeObjectKey(input.key),
      UploadId: input.uploadId,
      PartNumber: input.partNumber,
      Body: Buffer.from(input.body),
      ContentLength: input.contentLength ?? input.body.byteLength,
    });

    return {
      bucket: input.bucket,
      key: input.key,
      partNumber: input.partNumber,
      etag: output.ETag ?? '',
    };
  }

  async completeMultipartUpload(
    input: CompleteMultipartUploadInput,
  ): Promise<CompleteMultipartUploadResult> {
    const output = await this.client.multipartComplete({
      Bucket: this.bucketName(input.bucket),
      Region: this.bucketRegion(input.region),
      Key: normalizeObjectKey(input.key),
      UploadId: input.uploadId,
      Parts: input.parts.map((part) => ({
        PartNumber: part.partNumber,
        ETag: part.etag,
      })),
    });
    return {
      bucket: input.bucket,
      key: input.key,
      etag: output.ETag,
      location: output.Location,
    };
  }

  async abortMultipartUpload(input: AbortMultipartUploadInput) {
    await this.client.multipartAbort({
      Bucket: this.bucketName(input.bucket),
      Region: this.bucketRegion(input.region),
      Key: normalizeObjectKey(input.key),
      UploadId: input.uploadId,
    });
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const metadataHeaders = Object.fromEntries(
      Object.entries(input.metadata ?? {}).map(([key, value]) => [
        `x-cos-meta-${key}`,
        value,
      ]),
    );
    const output = await this.client.putObject({
      Bucket: this.bucketName(input.bucket),
      Region: this.bucketRegion(input.region),
      Key: normalizeObjectKey(input.key),
      Body: Buffer.from(input.body),
      ContentLength: input.contentLength ?? input.body.byteLength,
      ContentType: input.contentType,
      Headers: input.preventOverwrite ? { 'If-None-Match': '*' } : undefined,
      ...metadataHeaders,
    });

    return {
      bucket: input.bucket,
      key: input.key,
      etag: output.ETag,
      location: output.Location,
    };
  }

  async deleteObject(input: DeleteObjectInput): Promise<DeleteObjectResult> {
    await this.client.deleteObject({
      Bucket: this.bucketName(input.bucket),
      Region: this.bucketRegion(input.region),
      Key: normalizeObjectKey(input.key),
    });
    return { bucket: input.bucket, key: input.key };
  }

  async headObject(input: HeadObjectInput): Promise<HeadObjectResult | null> {
    try {
      const output = await this.client.headObject({
        Bucket: this.bucketName(input.bucket),
        Region: this.bucketRegion(input.region),
        Key: normalizeObjectKey(input.key),
      });
      return {
        bucket: input.bucket,
        key: input.key,
        etag: output.ETag,
      };
    } catch (error) {
      const info = normalizeErrorInfo(error);
      if (info.statusCode === 404 || info.code === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }
}
