import OSS from 'ali-oss';

import type {
  AbortMultipartUploadInput,
  CheckStorageCredentialsInput,
  CheckStorageCredentialsResult,
  CompleteMultipartUploadInput,
  CompleteMultipartUploadResult,
  CreateMultipartUploadInput,
  CreateMultipartUploadResult,
  CreateSingleUploadUrlInput,
  DeleteObjectInput,
  DeleteObjectResult,
  HeadObjectInput,
  HeadObjectResult,
  ListStorageBucketsResult,
  ListStorageObjectsInput,
  ListStorageObjectsResult,
  PresignMultipartPartInput,
  PresignedUploadUrl,
  StorageAdapter,
  StorageAdapterConfig,
} from './types';
import {
  basenameFromObjectPath,
  createPresignedUploadUrl,
  dateFromUnknown,
  metadataFromHeaders,
  normalizeErrorInfo,
  normalizeExpiresInSeconds,
  normalizeListLimit,
  normalizeObjectKey,
  normalizeOptionalString,
  normalizePrefix,
  numberFromUnknown,
  stringFromUnknown,
} from './utils';

const DEFAULT_ALIYUN_REGION = 'cn-hangzhou';

function aliyunRegionForSdk(region?: string | null) {
  const value = normalizeOptionalString(region) ?? DEFAULT_ALIYUN_REGION;
  return value.startsWith('oss-') ? value : `oss-${value}`;
}

function aliyunEndpointFromRegion(region: string) {
  return `https://${aliyunRegionForSdk(region)}.aliyuncs.com`;
}

function aliyunRegionForApp(region?: string) {
  return region?.replace(/^oss-/, '');
}

export class AliyunOssStorageAdapter implements StorageAdapter {
  readonly provider = 'aliyun_oss' as const;
  private readonly client: OSS;

  constructor(config: StorageAdapterConfig) {
    const region = aliyunRegionForSdk(config.region);
    const endpoint =
      normalizeOptionalString(config.endpoint) ??
      aliyunEndpointFromRegion(region);

    this.client = new OSS({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.secretAccessKey,
      region,
      endpoint,
      stsToken: normalizeOptionalString(config.sessionToken),
      authorizationV4: true,
      ...(config.extraConfig ?? {}),
    });
  }

  async checkCredentials(
    input: CheckStorageCredentialsInput = {},
  ): Promise<CheckStorageCredentialsResult> {
    try {
      if (input.bucket) {
        await this.client.getBucketInfo(input.bucket);
      } else {
        await this.client.listBuckets();
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: normalizeErrorInfo(error) };
    }
  }

  async listBuckets(): Promise<ListStorageBucketsResult> {
    const output = await this.client.listBuckets();
    return {
      buckets:
        output.buckets?.map((bucket) => ({
          name: bucket.name,
          region: aliyunRegionForApp(bucket.region),
          createdAt: dateFromUnknown(bucket.creationDate),
          storageClass: bucket.storageClass,
        })) ?? [],
      nextCursor: output.nextMarker ?? undefined,
      isTruncated: Boolean(output.isTruncated),
    };
  }

  async listObjects(
    input: ListStorageObjectsInput,
  ): Promise<ListStorageObjectsResult> {
    this.client.useBucket(input.bucket);
    const query: Record<string, string | number | boolean> = {
      'max-keys': normalizeListLimit(input.limit),
    };
    const prefix = normalizePrefix(input.prefix);
    if (prefix) {
      query.prefix = prefix;
    }
    if (input.delimiter !== '') {
      query.delimiter = input.delimiter ?? '/';
    }
    if (input.cursor) {
      query['continuation-token'] = input.cursor;
    }
    const output = await this.client.listV2(query);
    const folders =
      output.prefixes?.map((prefix) => ({
        kind: 'directory' as const,
        name: basenameFromObjectPath(prefix),
        path: prefix,
      })) ?? [];
    const files =
      output.objects?.map((object) => ({
        kind: 'file' as const,
        name: basenameFromObjectPath(object.name),
        path: object.name,
        size: object.size,
        updatedAt: dateFromUnknown(object.lastModified),
        etag: object.etag,
        storageClass: object.storageClass,
        contentType: object.type,
      })) ?? [];
    return {
      items: [...folders, ...files],
      nextCursor:
        output.nextContinuationToken ?? output.nextMarker ?? undefined,
      isTruncated: Boolean(output.isTruncated),
    };
  }

  async createSingleUploadUrl(
    input: CreateSingleUploadUrlInput,
  ): Promise<PresignedUploadUrl> {
    this.client.useBucket(input.bucket);
    const expiresInSeconds = normalizeExpiresInSeconds(input.expiresInSeconds);
    const headers: Record<string, string> = {
      ...(input.contentType ? { 'content-type': input.contentType } : {}),
      ...(input.metadata
        ? Object.fromEntries(
            Object.entries(input.metadata).map(([key, value]) => [
              `x-oss-meta-${key}`,
              value,
            ]),
          )
        : {}),
    };
    const url = await this.client.asyncSignatureUrl(
      normalizeObjectKey(input.key),
      { method: 'PUT', expires: expiresInSeconds, headers },
      false,
    );
    return createPresignedUploadUrl('PUT', url, expiresInSeconds, headers);
  }

  async createMultipartUpload(
    input: CreateMultipartUploadInput,
  ): Promise<CreateMultipartUploadResult> {
    this.client.useBucket(input.bucket);
    const output = await this.client.initMultipartUpload(
      normalizeObjectKey(input.key),
      {
        mime: input.contentType,
        meta: input.metadata,
      },
    );
    return {
      bucket: output.bucket ?? input.bucket,
      key: output.name ?? input.key,
      uploadId: output.uploadId,
    };
  }

  async presignMultipartPart(
    input: PresignMultipartPartInput,
  ): Promise<PresignedUploadUrl> {
    this.client.useBucket(input.bucket);
    const expiresInSeconds = normalizeExpiresInSeconds(input.expiresInSeconds);
    const url = await this.client.asyncSignatureUrl(
      normalizeObjectKey(input.key),
      {
        method: 'PUT',
        expires: expiresInSeconds,
        queries: {
          partNumber: input.partNumber,
          uploadId: input.uploadId,
        },
      },
      false,
    );
    return createPresignedUploadUrl('PUT', url, expiresInSeconds);
  }

  async completeMultipartUpload(
    input: CompleteMultipartUploadInput,
  ): Promise<CompleteMultipartUploadResult> {
    this.client.useBucket(input.bucket);
    const output = await this.client.completeMultipartUpload(
      normalizeObjectKey(input.key),
      input.uploadId,
      input.parts.map((part) => ({ number: part.partNumber, etag: part.etag })),
    );
    return {
      bucket: output.bucket ?? input.bucket,
      key: output.name ?? input.key,
      etag: output.etag,
    };
  }

  async abortMultipartUpload(input: AbortMultipartUploadInput) {
    this.client.useBucket(input.bucket);
    await this.client.abortMultipartUpload(
      normalizeObjectKey(input.key),
      input.uploadId,
    );
  }

  async deleteObject(input: DeleteObjectInput): Promise<DeleteObjectResult> {
    this.client.useBucket(input.bucket);
    await this.client.delete(normalizeObjectKey(input.key));
    return { bucket: input.bucket, key: input.key };
  }

  async headObject(input: HeadObjectInput): Promise<HeadObjectResult | null> {
    try {
      this.client.useBucket(input.bucket);
      const output = await this.client.head(normalizeObjectKey(input.key));
      const headers = output.res?.headers ?? {};
      return {
        bucket: input.bucket,
        key: input.key,
        size: numberFromUnknown(headers['content-length']),
        updatedAt: dateFromUnknown(headers['last-modified']),
        etag: stringFromUnknown(headers.etag),
        contentType: stringFromUnknown(headers['content-type']),
        storageClass: stringFromUnknown(headers['x-oss-storage-class']),
        metadata: metadataFromHeaders(headers, 'x-oss-meta-'),
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
