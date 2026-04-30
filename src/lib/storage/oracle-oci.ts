import { createHash, createSign } from 'node:crypto';

import type {
  CheckStorageCredentialsInput,
  CheckStorageCredentialsResult,
  CompleteMultipartUploadResult,
  CreateMultipartUploadResult,
  DeleteObjectInput,
  DeleteObjectResult,
  HeadObjectInput,
  HeadObjectResult,
  ListStorageBucketsResult,
  ListStorageObjectsInput,
  ListStorageObjectsResult,
  PresignedUploadUrl,
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
  normalizeErrorInfo,
  normalizeListLimit,
  normalizeObjectKey,
  normalizeOptionalString,
  normalizePrefix,
  numberFromUnknown,
  stringFromUnknown,
} from './utils';

type OracleObjectItem = {
  name?: string;
  size?: number;
  timeCreated?: string;
  timeModified?: string;
  etag?: string;
  md5?: string;
};

type OracleListObjectsResponse = {
  objects?: OracleObjectItem[];
  prefixes?: string[];
  nextStartWith?: string;
};

type OracleBucketItem = {
  name?: string;
  timeCreated?: string;
};

type OracleListBucketsResponse = {
  items?: OracleBucketItem[];
};

class OracleOciHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly responseBody: string,
  ) {
    super(
      `Oracle OCI request failed with status ${statusCode}: ${responseBody}`,
    );
    this.name = 'OracleOciHttpError';
  }
}

function extraString(config: StorageAdapterConfig, key: string) {
  const value = config.extraConfig?.[key];
  return typeof value === 'string' ? normalizeOptionalString(value) : undefined;
}

function normalizePemKey(value: string) {
  let normalized = value.replaceAll('\\\\n', '\n').replaceAll('\\n', '\n');
  normalized = normalized.trim();

  const headers = [
    ['-----BEGIN PRIVATE KEY-----', '-----END PRIVATE KEY-----'],
    ['-----BEGIN RSA PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----'],
  ] as const;
  const pair = headers.find(([begin]) => normalized.includes(begin));
  if (!pair) {
    const body = normalized.replace(/\s+/g, '');
    return `-----BEGIN RSA PRIVATE KEY-----\n${body}\n-----END RSA PRIVATE KEY-----`;
  }

  const [begin, end] = pair;
  const afterBegin = normalized.slice(normalized.indexOf(begin) + begin.length);
  const beforeEnd = afterBegin.includes(end)
    ? afterBegin.slice(0, afterBegin.indexOf(end))
    : afterBegin;
  const body = beforeEnd.replace(/\s+/g, '');
  return `${begin}\n${body}\n${end}`;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

function encodeObjectName(value: string) {
  return normalizeObjectKey(value)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function bodyHash(body: Buffer) {
  return createHash('sha256').update(body).digest('base64');
}

export class OracleOciStorageAdapter implements StorageAdapter {
  readonly provider = 'oci' as const;
  private readonly tenancyId: string;
  private readonly userId: string;
  private readonly fingerprint: string;
  private readonly privateKey: string;
  private readonly region: string;
  private readonly namespace?: string;
  private readonly compartmentId: string;
  private namespacePromise?: Promise<string>;

  constructor(config: StorageAdapterConfig) {
    const tenancyId = extraString(config, 'accountId');
    const fingerprint = extraString(config, 'fingerprint');
    const region = normalizeOptionalString(config.region);

    if (!tenancyId) {
      throw new Error('Oracle OCI tenancy OCID is required');
    }
    if (!fingerprint) {
      throw new Error('Oracle OCI key fingerprint is required');
    }
    if (!region) {
      throw new Error('Oracle OCI region is required');
    }

    this.tenancyId = tenancyId;
    this.userId = config.accessKeyId;
    this.fingerprint = fingerprint;
    this.privateKey = normalizePemKey(config.secretAccessKey);
    this.region = region;
    this.namespace = extraString(config, 'namespace');
    this.compartmentId = extraString(config, 'compartmentId') ?? tenancyId;
  }

  private baseUrl() {
    return `https://objectstorage.${this.region}.oraclecloud.com`;
  }

  private sign({
    method,
    url,
    values,
    headers,
  }: {
    method: string;
    url: URL;
    values: Record<string, string>;
    headers: string[];
  }) {
    const requestTarget = `${method.toLowerCase()} ${url.pathname}${url.search}`;
    const signingString = headers
      .map((header) =>
        header === '(request-target)'
          ? `(request-target): ${requestTarget}`
          : `${header}: ${values[header]}`,
      )
      .join('\n');
    const signature = createSign('RSA-SHA256')
      .update(signingString)
      .sign(this.privateKey, 'base64');

    return [
      'Signature version="1"',
      `keyId="${this.tenancyId}/${this.userId}/${this.fingerprint}"`,
      'algorithm="rsa-sha256"',
      `headers="${headers.join(' ')}"`,
      `signature="${signature}"`,
    ].join(',');
  }

  private async request(
    method: string,
    pathname: string,
    {
      searchParams,
      body,
      headers = {},
      allowNotFound = false,
    }: {
      searchParams?: Record<string, string | number | undefined>;
      body?: Buffer;
      headers?: Record<string, string | undefined>;
      allowNotFound?: boolean;
    } = {},
  ) {
    const url = new URL(`${this.baseUrl()}${pathname}`);
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const date = new Date().toUTCString();
    const values: Record<string, string> = {
      date,
      host: url.host,
    };
    const requestHeaders = new Headers();
    requestHeaders.set('date', date);

    for (const [key, value] of Object.entries(headers)) {
      if (!value) continue;
      const normalizedKey = key.toLowerCase();
      values[normalizedKey] = value;
      requestHeaders.set(normalizedKey, value);
    }

    if (body) {
      values['content-length'] = String(body.byteLength);
      values['x-content-sha256'] = bodyHash(body);
      requestHeaders.set('content-length', values['content-length']);
      requestHeaders.set('x-content-sha256', values['x-content-sha256']);
    }

    const headersToSign = ['date', '(request-target)', 'host'];
    if (body) {
      headersToSign.push('x-content-sha256');
      if (values['content-type']) {
        headersToSign.push('content-type');
      }
      headersToSign.push('content-length');
    }
    if (values['if-none-match']) {
      headersToSign.push('if-none-match');
    }

    requestHeaders.set(
      'authorization',
      this.sign({ method, url, values, headers: headersToSign }),
    );

    const requestBody: BodyInit | undefined = body
      ? Uint8Array.from(body).buffer
      : undefined;
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
    });
    if (!response.ok && !(allowNotFound && response.status === 404)) {
      throw new OracleOciHttpError(response.status, await response.text());
    }
    return response;
  }

  private async requestJson<T>(
    method: string,
    pathname: string,
    options?: Parameters<OracleOciStorageAdapter['request']>[2],
  ) {
    const response = await this.request(method, pathname, options);
    return (await response.json()) as T;
  }

  private async objectNamespace() {
    this.namespacePromise ??= this.namespace
      ? Promise.resolve(this.namespace)
      : this.request('GET', '/n/').then(async (response) => {
          const text = await response.text();
          let parsed: unknown = text;
          try {
            parsed = text ? (JSON.parse(text) as unknown) : text;
          } catch {
            parsed = text;
          }
          if (typeof parsed === 'string') return parsed;
          throw new Error('Oracle OCI did not return an object namespace');
        });

    return this.namespacePromise;
  }

  private async bucketPath(bucket: string) {
    const namespace = await this.objectNamespace();
    return `/n/${encodePathSegment(namespace)}/b/${encodePathSegment(bucket)}`;
  }

  private async objectPath(bucket: string, key: string) {
    return `${await this.bucketPath(bucket)}/o/${encodeObjectName(key)}`;
  }

  async checkCredentials(
    input: CheckStorageCredentialsInput = {},
  ): Promise<CheckStorageCredentialsResult> {
    try {
      if (input.bucket) {
        await this.request('GET', await this.bucketPath(input.bucket));
      } else {
        await this.listBuckets();
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: normalizeErrorInfo(error) };
    }
  }

  async listBuckets(): Promise<ListStorageBucketsResult> {
    const namespace = await this.objectNamespace();
    const output = await this.requestJson<OracleListBucketsResponse>(
      'GET',
      `/n/${encodePathSegment(namespace)}/b`,
      { searchParams: { compartmentId: this.compartmentId } },
    );
    return {
      buckets:
        output.items
          ?.map((bucket) => ({
            name: bucket.name ?? '',
            region: this.region,
            createdAt: dateFromUnknown(bucket.timeCreated),
          }))
          .filter((bucket) => bucket.name.length > 0) ?? [],
      isTruncated: false,
    };
  }

  async listObjects(
    input: ListStorageObjectsInput,
  ): Promise<ListStorageObjectsResult> {
    const output = await this.requestJson<OracleListObjectsResponse>(
      'GET',
      `${await this.bucketPath(input.bucket)}/o`,
      {
        searchParams: {
          prefix: normalizePrefix(input.prefix),
          delimiter: input.delimiter ?? '/',
          limit: normalizeListLimit(input.limit),
          start: input.cursor,
        },
      },
    );
    const folders =
      output.prefixes?.map((prefix) => ({
        kind: 'directory' as const,
        name: basenameFromObjectPath(prefix),
        path: prefix,
      })) ?? [];
    const files =
      output.objects?.map((object) => {
        const path = object.name ?? '';
        return {
          kind: 'file' as const,
          name: basenameFromObjectPath(path),
          path,
          size: numberFromUnknown(object.size),
          updatedAt: dateFromUnknown(object.timeModified ?? object.timeCreated),
          etag: object.etag ?? object.md5,
        };
      }) ?? [];

    return {
      items: [...folders, ...files].filter((item) => item.path.length > 0),
      nextCursor: output.nextStartWith,
      isTruncated: Boolean(output.nextStartWith),
    };
  }

  async createSingleUploadUrl(): Promise<PresignedUploadUrl> {
    throw new Error('Oracle OCI does not support browser presigned uploads');
  }

  async createMultipartUpload(): Promise<CreateMultipartUploadResult> {
    throw new Error('Oracle OCI multipart uploads are not supported');
  }

  async presignMultipartPart(): Promise<PresignedUploadUrl> {
    throw new Error('Oracle OCI does not support browser presigned uploads');
  }

  async uploadPart(): Promise<UploadPartResult> {
    throw new Error('Oracle OCI multipart uploads are not supported');
  }

  async completeMultipartUpload(): Promise<CompleteMultipartUploadResult> {
    throw new Error('Oracle OCI multipart uploads are not supported');
  }

  async abortMultipartUpload() {
    return;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const metadataHeaders = Object.fromEntries(
      Object.entries(input.metadata ?? {}).map(([key, value]) => [
        `opc-meta-${key}`,
        value,
      ]),
    );
    const output = await this.request(
      'PUT',
      await this.objectPath(input.bucket, input.key),
      {
        body: Buffer.from(input.body),
        headers: {
          'content-type': input.contentType ?? 'application/octet-stream',
          ...(input.preventOverwrite ? { 'if-none-match': '*' } : {}),
          ...metadataHeaders,
        },
      },
    );

    return {
      bucket: input.bucket,
      key: input.key,
      etag: output.headers.get('etag') ?? undefined,
    };
  }

  async deleteObject(input: DeleteObjectInput): Promise<DeleteObjectResult> {
    await this.request(
      'DELETE',
      await this.objectPath(input.bucket, input.key),
    );
    return { bucket: input.bucket, key: input.key };
  }

  async headObject(input: HeadObjectInput): Promise<HeadObjectResult | null> {
    const output = await this.request(
      'HEAD',
      await this.objectPath(input.bucket, input.key),
      { allowNotFound: true },
    );
    if (output.status === 404) return null;

    return {
      bucket: input.bucket,
      key: input.key,
      size: numberFromUnknown(output.headers.get('content-length')),
      updatedAt: dateFromUnknown(output.headers.get('last-modified')),
      etag: stringFromUnknown(output.headers.get('etag')),
      contentType: stringFromUnknown(output.headers.get('content-type')),
    };
  }
}
