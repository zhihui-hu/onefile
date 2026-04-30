import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
  PutObjectInput,
  PutObjectResult,
  S3CompatibleProviderId,
  StorageAdapter,
  StorageAdapterConfig,
  StorageObjectItem,
} from './types';
import {
  basenameFromObjectPath,
  checksumHeaders,
  createPresignedUploadUrl,
  normalizeDelimiter,
  normalizeErrorInfo,
  normalizeExpiresInSeconds,
  normalizeListLimit,
  normalizeObjectKey,
  normalizeOptionalString,
  normalizePrefix,
} from './utils';

export class S3CompatibleStorageAdapter implements StorageAdapter {
  readonly provider: S3CompatibleProviderId;
  private readonly client: S3Client;

  constructor(provider: S3CompatibleProviderId, config: StorageAdapterConfig) {
    this.provider = provider;
    this.client = new S3Client({
      region: normalizeOptionalString(config.region) ?? 'auto',
      endpoint: normalizeOptionalString(config.endpoint),
      forcePathStyle:
        config.forcePathStyle ?? (provider === 'b2' || provider === 'oci'),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: normalizeOptionalString(config.sessionToken),
      },
    });
  }

  async checkCredentials(
    input: CheckStorageCredentialsInput = {},
  ): Promise<CheckStorageCredentialsResult> {
    try {
      if (input.bucket) {
        await this.client.send(new HeadBucketCommand({ Bucket: input.bucket }));
      } else {
        await this.client.send(new ListBucketsCommand({}));
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: normalizeErrorInfo(error) };
    }
  }

  async listBuckets(): Promise<ListStorageBucketsResult> {
    const output = await this.client.send(new ListBucketsCommand({}));
    return {
      buckets:
        output.Buckets?.map((bucket) => ({
          name: bucket.Name ?? '',
          createdAt: bucket.CreationDate,
        })).filter((bucket) => bucket.name.length > 0) ?? [],
      isTruncated: false,
    };
  }

  async listObjects(
    input: ListStorageObjectsInput,
  ): Promise<ListStorageObjectsResult> {
    const output = await this.client.send(
      new ListObjectsV2Command({
        Bucket: input.bucket,
        Prefix: normalizePrefix(input.prefix),
        Delimiter: normalizeDelimiter(input.delimiter),
        MaxKeys: normalizeListLimit(input.limit),
        ContinuationToken: input.cursor,
      }),
    );

    const folders: StorageObjectItem[] =
      output.CommonPrefixes?.map((prefix) => {
        const path = prefix.Prefix ?? '';
        return {
          kind: 'directory',
          name: basenameFromObjectPath(path),
          path,
        };
      }) ?? [];

    const files =
      output.Contents?.filter(
        (item) => item.Key && item.Key !== input.prefix,
      ).map((item) => objectToItem(item)) ?? [];

    return {
      items: [...folders, ...files],
      nextCursor: output.NextContinuationToken,
      isTruncated: Boolean(output.IsTruncated),
    };
  }

  async createSingleUploadUrl(
    input: CreateSingleUploadUrlInput,
  ): Promise<PresignedUploadUrl> {
    const expiresInSeconds = normalizeExpiresInSeconds(input.expiresInSeconds);
    const headers = checksumHeaders(input.checksum);
    const command = new PutObjectCommand({
      Bucket: input.bucket,
      Key: normalizeObjectKey(input.key),
      ContentType: input.contentType,
      ContentLength: input.contentLength,
      Metadata: input.metadata,
      IfNoneMatch: input.preventOverwrite ? '*' : undefined,
      ...checksumCommandInput(input.checksum),
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
    return createPresignedUploadUrl('PUT', url, expiresInSeconds, headers);
  }

  async createMultipartUpload(
    input: CreateMultipartUploadInput,
  ): Promise<CreateMultipartUploadResult> {
    const output = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: input.bucket,
        Key: normalizeObjectKey(input.key),
        ContentType: input.contentType,
        Metadata: input.metadata,
      }),
    );
    if (!output.UploadId) {
      throw new Error('Storage provider did not return multipart upload id');
    }
    return { bucket: input.bucket, key: input.key, uploadId: output.UploadId };
  }

  async presignMultipartPart(
    input: PresignMultipartPartInput,
  ): Promise<PresignedUploadUrl> {
    const expiresInSeconds = normalizeExpiresInSeconds(input.expiresInSeconds);
    const headers = checksumHeaders(input.checksum);
    const command = new UploadPartCommand({
      Bucket: input.bucket,
      Key: normalizeObjectKey(input.key),
      UploadId: input.uploadId,
      PartNumber: input.partNumber,
      ContentLength: input.contentLength,
      ...checksumCommandInput(input.checksum),
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
    return createPresignedUploadUrl('PUT', url, expiresInSeconds, headers);
  }

  async completeMultipartUpload(
    input: CompleteMultipartUploadInput,
  ): Promise<CompleteMultipartUploadResult> {
    const output = await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: input.bucket,
        Key: normalizeObjectKey(input.key),
        UploadId: input.uploadId,
        MultipartUpload: {
          Parts: input.parts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        },
        IfNoneMatch: input.preventOverwrite ? '*' : undefined,
      }),
    );
    return {
      bucket: input.bucket,
      key: input.key,
      etag: output.ETag,
      location: output.Location,
    };
  }

  async abortMultipartUpload(input: AbortMultipartUploadInput) {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: input.bucket,
        Key: normalizeObjectKey(input.key),
        UploadId: input.uploadId,
      }),
    );
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const output = await this.client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: normalizeObjectKey(input.key),
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength ?? input.body.byteLength,
        Metadata: input.metadata,
        IfNoneMatch: input.preventOverwrite ? '*' : undefined,
      }),
    );

    return {
      bucket: input.bucket,
      key: input.key,
      etag: output.ETag,
    };
  }

  async deleteObject(input: DeleteObjectInput): Promise<DeleteObjectResult> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: input.bucket,
        Key: normalizeObjectKey(input.key),
      }),
    );
    return { bucket: input.bucket, key: input.key };
  }

  async headObject(input: HeadObjectInput): Promise<HeadObjectResult | null> {
    try {
      const output = await this.client.send(
        new HeadObjectCommand({
          Bucket: input.bucket,
          Key: normalizeObjectKey(input.key),
        }),
      );
      return {
        bucket: input.bucket,
        key: input.key,
        size: output.ContentLength,
        updatedAt: output.LastModified,
        etag: output.ETag,
        contentType: output.ContentType,
        storageClass: output.StorageClass,
        metadata: output.Metadata,
      };
    } catch (error) {
      const info = normalizeErrorInfo(error);
      if (info.statusCode === 404 || info.code === 'NotFound') {
        return null;
      }
      throw error;
    }
  }
}

function objectToItem(object: _Object): StorageObjectItem {
  const key = object.Key ?? '';
  return {
    kind: 'file',
    name: basenameFromObjectPath(key),
    path: key,
    size: object.Size,
    updatedAt: object.LastModified,
    etag: object.ETag,
    storageClass: object.StorageClass,
  };
}

function checksumCommandInput(
  checksum: CreateSingleUploadUrlInput['checksum'],
) {
  if (!checksum) {
    return {};
  }
  switch (checksum.algorithm) {
    case 'content-md5':
      return { ContentMD5: checksum.value };
    case 'crc32':
      return { ChecksumCRC32: checksum.value };
    case 'crc32c':
      return { ChecksumCRC32C: checksum.value };
    case 'crc64nvme':
      return { ChecksumCRC64NVME: checksum.value };
    case 'sha1':
      return { ChecksumSHA1: checksum.value };
    case 'sha256':
      return { ChecksumSHA256: checksum.value };
  }
}
