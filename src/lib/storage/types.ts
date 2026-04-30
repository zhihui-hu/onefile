export const STORAGE_PROVIDER_IDS = [
  's3',
  'r2',
  'b2',
  'oci',
  'aliyun_oss',
  'tencent_cos',
] as const;

export type StorageProviderId = (typeof STORAGE_PROVIDER_IDS)[number];

export const S3_COMPATIBLE_PROVIDER_IDS = ['s3', 'r2', 'b2', 'oci'] as const;

export type S3CompatibleProviderId =
  (typeof S3_COMPATIBLE_PROVIDER_IDS)[number];

export type StorageObjectKind = 'directory' | 'file';

export type StorageHttpMethod = 'PUT' | 'POST' | 'DELETE';

export type StorageChecksumAlgorithm =
  | 'content-md5'
  | 'crc32'
  | 'crc32c'
  | 'crc64nvme'
  | 'sha1'
  | 'sha256';

export interface StorageChecksum {
  algorithm: StorageChecksumAlgorithm;
  value: string;
}

export interface StorageAdapterConfig {
  provider: StorageProviderId;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string | null;
  endpoint?: string | null;
  sessionToken?: string | null;
  forcePathStyle?: boolean | null;
  extraConfig?: Record<string, unknown> | null;
}

export interface CheckStorageCredentialsInput {
  bucket?: string;
  region?: string;
}

export interface StorageErrorInfo {
  code?: string;
  message: string;
  statusCode?: number;
}

export interface CheckStorageCredentialsResult {
  ok: boolean;
  error?: StorageErrorInfo;
}

export interface ListStorageBucketsInput {
  limit?: number;
  cursor?: string;
}

export interface StorageBucket {
  name: string;
  region?: string;
  createdAt?: Date;
  storageClass?: string;
}

export interface ListStorageBucketsResult {
  buckets: StorageBucket[];
  nextCursor?: string;
  isTruncated: boolean;
}

export interface ListStorageObjectsInput {
  bucket: string;
  region?: string;
  prefix?: string;
  delimiter?: string;
  limit?: number;
  cursor?: string;
}

export interface StorageObjectItem {
  kind: StorageObjectKind;
  name: string;
  path: string;
  size?: number;
  updatedAt?: Date;
  etag?: string;
  storageClass?: string;
  contentType?: string;
}

export interface ListStorageObjectsResult {
  items: StorageObjectItem[];
  nextCursor?: string;
  isTruncated: boolean;
}

export interface CreateSingleUploadUrlInput {
  bucket: string;
  region?: string;
  key: string;
  expiresInSeconds?: number;
  contentType?: string;
  contentLength?: number;
  checksum?: StorageChecksum;
  metadata?: Record<string, string>;
  preventOverwrite?: boolean;
}

export interface PresignedUploadUrl {
  method: StorageHttpMethod;
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface CreateMultipartUploadInput {
  bucket: string;
  region?: string;
  key: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface CreateMultipartUploadResult {
  bucket: string;
  key: string;
  uploadId: string;
}

export interface PresignMultipartPartInput {
  bucket: string;
  region?: string;
  key: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds?: number;
  contentLength?: number;
  checksum?: StorageChecksum;
}

export interface CompletedMultipartPart {
  partNumber: number;
  etag: string;
  checksum?: StorageChecksum;
}

export interface CompleteMultipartUploadInput {
  bucket: string;
  region?: string;
  key: string;
  uploadId: string;
  parts: CompletedMultipartPart[];
  preventOverwrite?: boolean;
}

export interface CompleteMultipartUploadResult {
  bucket: string;
  key: string;
  etag?: string;
  location?: string;
}

export interface AbortMultipartUploadInput {
  bucket: string;
  region?: string;
  key: string;
  uploadId: string;
}

export interface DeleteObjectInput {
  bucket: string;
  region?: string;
  key: string;
}

export interface DeleteObjectResult {
  bucket: string;
  key: string;
}

export interface PutObjectInput {
  bucket: string;
  region?: string;
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
  preventOverwrite?: boolean;
}

export interface PutObjectResult {
  bucket: string;
  key: string;
  etag?: string;
  location?: string;
}

export interface HeadObjectInput {
  bucket: string;
  region?: string;
  key: string;
}

export interface HeadObjectResult {
  bucket: string;
  key: string;
  size?: number;
  updatedAt?: Date;
  etag?: string;
  contentType?: string;
  storageClass?: string;
  metadata?: Record<string, string>;
}

export interface StorageAdapter {
  provider: StorageProviderId;
  checkCredentials(
    input?: CheckStorageCredentialsInput,
  ): Promise<CheckStorageCredentialsResult>;
  listBuckets(
    input?: ListStorageBucketsInput,
  ): Promise<ListStorageBucketsResult>;
  listObjects(
    input: ListStorageObjectsInput,
  ): Promise<ListStorageObjectsResult>;
  createSingleUploadUrl(
    input: CreateSingleUploadUrlInput,
  ): Promise<PresignedUploadUrl>;
  createMultipartUpload(
    input: CreateMultipartUploadInput,
  ): Promise<CreateMultipartUploadResult>;
  presignMultipartPart(
    input: PresignMultipartPartInput,
  ): Promise<PresignedUploadUrl>;
  completeMultipartUpload(
    input: CompleteMultipartUploadInput,
  ): Promise<CompleteMultipartUploadResult>;
  abortMultipartUpload(input: AbortMultipartUploadInput): Promise<void>;
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  deleteObject(input: DeleteObjectInput): Promise<DeleteObjectResult>;
  headObject(input: HeadObjectInput): Promise<HeadObjectResult | null>;
}
