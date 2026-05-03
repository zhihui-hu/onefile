import { debugError, debugLog, errorDebugData } from '@/lib/debug';
import { cleanDisplayText } from '@/lib/utils';

import type {
  ApiFailure,
  CurrentUser,
  FileApiKey,
  FileApiKeyLinkPayload,
  FileApiKeyPayload,
  FileItem,
  FileListResult,
  PublicUploadResult,
  StorageAccount,
  StorageBucket,
  UploadCompletePart,
  UploadDirectResult,
  UploadInitPayload,
  UploadInitResult,
  UploadPartResult,
} from './types';

type JsonObject = Record<string, unknown>;
type MaybeItems<T> = T[] | { items?: T[] };
type MaybeStorageAccount = StorageAccount | { account?: StorageAccount };
type MaybeStorageBucket = StorageBucket | { bucket?: StorageBucket };
type CreatedFileApiKey = FileApiKey & {
  key?: string;
  plain_key?: string;
  raw_key?: string;
};
type MaybeCreatedFileApiKey =
  | CreatedFileApiKey
  | {
      key?: FileApiKey;
      raw_key?: string;
      plain_key?: string;
    };
type MaybeFileApiKey = FileApiKey | { key?: FileApiKey };
type MaybeUser = CurrentUser | { user?: CurrentUser | null } | null;
type SqlBackupDownload = {
  blob: Blob;
  filename: string;
};

export class OneFileApiError extends Error {
  code: number | string;
  details?: unknown;
  status: number;
  type?: string;

  constructor(
    message: string,
    status: number,
    code: number | string = 'REQUEST_FAILED',
    details?: unknown,
    type?: string,
  ) {
    super(cleanDisplayText(message));
    this.name = 'OneFileApiError';
    this.code = code;
    this.details = details;
    this.status = status;
    this.type = type;
  }
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asItems<T>(value: MaybeItems<T> | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value?.items && Array.isArray(value.items)) return value.items;
  return [];
}

function asStorageAccount(value: MaybeStorageAccount) {
  if (isRecord(value) && 'account' in value && isRecord(value.account)) {
    return value.account as StorageAccount;
  }
  return value as StorageAccount;
}

function asStorageBucket(value: MaybeStorageBucket) {
  if (isRecord(value) && 'bucket' in value && isRecord(value.bucket)) {
    return value.bucket as StorageBucket;
  }
  return value as StorageBucket;
}

function asFileApiKey(value: MaybeFileApiKey) {
  if (isRecord(value) && 'key' in value && isRecord(value.key)) {
    return value.key as FileApiKey;
  }
  return value as FileApiKey;
}

function asCreatedFileApiKey(value: MaybeCreatedFileApiKey) {
  if (isRecord(value) && 'key' in value && isRecord(value.key)) {
    const rawKey =
      typeof value.raw_key === 'string'
        ? value.raw_key
        : typeof value.plain_key === 'string'
          ? value.plain_key
          : typeof value.key === 'string'
            ? value.key
            : undefined;

    return {
      ...(value.key as FileApiKey),
      key: rawKey,
      raw_key: rawKey,
      plain_key: rawKey,
    } satisfies CreatedFileApiKey;
  }

  if (isRecord(value)) {
    const rawKey =
      typeof value.raw_key === 'string'
        ? value.raw_key
        : typeof value.plain_key === 'string'
          ? value.plain_key
          : undefined;

    return {
      ...(value as FileApiKey),
      key: rawKey,
      raw_key: rawKey,
      plain_key: rawKey,
    } satisfies CreatedFileApiKey;
  }

  return value as CreatedFileApiKey;
}

function queryString(
  params: Record<string, string | number | null | undefined>,
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }

  const text = search.toString();
  return text ? `?${text}` : '';
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const payload =
    text && contentType.includes('application/json') ? JSON.parse(text) : text;

  if (!response.ok) {
    if (isRecord(payload) && 'error' in payload) {
      const failure = payload as ApiFailure;
      throw new OneFileApiError(
        failure.error?.message || response.statusText,
        response.status,
        failure.error?.code,
        failure.error?.details,
        failure.error?.type,
      );
    }

    throw new OneFileApiError(
      typeof payload === 'string' && payload ? payload : response.statusText,
      response.status,
    );
  }

  if (isRecord(payload) && 'data' in payload && 'error' in payload) {
    const envelope = payload as { data: T; error: ApiFailure['error'] | null };
    if (envelope.error) {
      throw new OneFileApiError(
        envelope.error.message,
        response.status,
        envelope.error.code,
        envelope.error.details,
        envelope.error.type,
      );
    }
    return envelope.data;
  }

  return payload as T;
}

async function parseDownloadResponse(
  response: Response,
): Promise<SqlBackupDownload> {
  if (!response.ok) {
    await parseResponse<never>(response);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const filenameMatch = disposition.match(/filename="([^"]+)"/i);
  const filename =
    filenameMatch?.[1] ?? `onefile-backup-${new Date().toISOString()}.sql`;

  return { blob, filename };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const startedAt = performance.now();
  const method = init.method ?? 'GET';
  debugLog('client:request:start', { method, path });

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  const hasBody = init.body !== undefined && init.body !== null;
  if (
    hasBody &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers,
    });
    const data = await parseResponse<T>(response);
    debugLog('client:request:end', {
      method,
      path,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    return data;
  } catch (error) {
    debugError('client:request:error', {
      method,
      path,
      duration_ms: Math.round(performance.now() - startedAt),
      error: errorDebugData(error),
    });
    throw error;
  }
}

async function jsonRequest<T>(path: string, method: string, body?: JsonObject) {
  return request<T>(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function getCurrentUser() {
  try {
    const data = await request<MaybeUser>('/api/me');
    if (!data) return null;
    if (isRecord(data) && 'user' in data) {
      return (data.user as CurrentUser | null | undefined) ?? null;
    }
    return data as CurrentUser;
  } catch (error) {
    if (
      error instanceof OneFileApiError &&
      [401, 403, 404].includes(error.status)
    ) {
      return null;
    }
    throw error;
  }
}

export async function logout() {
  return jsonRequest<unknown>('/api/auth/logout', 'POST');
}

export async function downloadSqlBackup() {
  const response = await fetch('/api/admin/sql-backup', {
    credentials: 'include',
    headers: {
      Accept: 'application/sql,text/plain,*/*',
    },
  });

  return parseDownloadResponse(response);
}

export async function importSqlBackup(file: File) {
  const formData = new FormData();
  formData.set('file', file);

  return request<{ imported: boolean; app_secret_set: boolean }>(
    '/api/admin/sql-backup',
    {
      method: 'POST',
      body: formData,
    },
  );
}

export async function completeGithubCallback(code: string, state: string) {
  return request<unknown>(
    `/api/auth/github/callback${queryString({ code, state })}`,
  );
}

export async function listStorageAccounts() {
  const data = await request<MaybeItems<StorageAccount>>(
    '/api/storage/accounts',
  );
  return asItems(data);
}

export async function createStorageAccount(payload: JsonObject) {
  const data = await jsonRequest<MaybeStorageAccount>(
    '/api/storage/accounts',
    'POST',
    payload,
  );
  return asStorageAccount(data);
}

export async function updateStorageAccount(
  id: number | string,
  payload: JsonObject,
) {
  const data = await jsonRequest<MaybeStorageAccount>(
    `/api/storage/accounts/${id}`,
    'PATCH',
    payload,
  );
  return asStorageAccount(data);
}

export async function deleteStorageAccount(id: number | string) {
  return jsonRequest<unknown>(`/api/storage/accounts/${id}`, 'DELETE');
}

export async function syncBuckets(accountId: number | string) {
  return jsonRequest<unknown>(
    `/api/storage/accounts/${accountId}/sync-buckets`,
    'POST',
  );
}

export async function listBuckets() {
  const data = await request<MaybeItems<StorageBucket>>('/api/storage/buckets');
  return asItems(data);
}

export async function updateBucket(id: number | string, payload: JsonObject) {
  const data = await jsonRequest<MaybeStorageBucket>(
    `/api/storage/buckets/${id}`,
    'PATCH',
    payload,
  );
  return asStorageBucket(data);
}

export async function listFiles(params: {
  bucketId: number | string;
  prefix?: string;
  search?: string;
  cursor?: string | null;
  limit?: number;
}) {
  const data = await request<FileListResult | FileItem[]>(
    `/api/files${queryString({
      bucket_id: params.bucketId,
      prefix: params.prefix,
      search: params.search,
      cursor: params.cursor,
      limit: params.limit,
    })}`,
  );

  if (Array.isArray(data)) {
    return { items: data } satisfies FileListResult;
  }

  return {
    items: Array.isArray(data.items) ? data.items : [],
    prefix: data.prefix,
    parent_prefix: data.parent_prefix,
    page: data.page,
  } satisfies FileListResult;
}

export async function deleteFile(payload: {
  bucket_id: number | string;
  object_key: string;
}) {
  return jsonRequest<unknown>('/api/files', 'DELETE', payload);
}

export async function deleteFiles(payload: {
  bucket_id: number | string;
  object_keys: string[];
}) {
  return jsonRequest<unknown>('/api/files', 'DELETE', payload);
}

export async function createFolder(payload: {
  bucket_id: number | string;
  prefix?: string;
  name: string;
}) {
  return jsonRequest<{ created: boolean; object_key: string }>(
    '/api/files/folders',
    'POST',
    payload,
  );
}

export async function createUpload(payload: UploadInitPayload) {
  return jsonRequest<UploadInitResult>('/api/uploads', 'POST', payload);
}

export function directUpload(
  payload: {
    bucket_id: number | string;
    file: File;
    object_key?: string;
    original_filename?: string;
  },
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
) {
  const startedAt = performance.now();
  debugLog('client:direct-upload:start', {
    bucket_id: payload.bucket_id,
    filename: payload.file.name,
    size: payload.file.size,
    type: payload.file.type,
  });

  const formData = new FormData();
  formData.set('file', payload.file);
  formData.set('bucket_id', String(payload.bucket_id));
  if (payload.object_key) formData.set('object_key', payload.object_key);
  if (payload.original_filename) {
    formData.set('original_filename', payload.original_filename);
  }

  return new Promise<UploadDirectResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    const abort = () => {
      xhr.abort();
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    if (signal.aborted) {
      abort();
      return;
    }

    signal.addEventListener('abort', abort, { once: true });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onerror = () => {
      debugError('client:direct-upload:error', {
        duration_ms: Math.round(performance.now() - startedAt),
        status: xhr.status,
        status_text: xhr.statusText,
      });
      reject(new Error('服务端上传失败'));
    };
    xhr.onabort = () =>
      reject(new DOMException('Upload aborted', 'AbortError'));
    xhr.onload = async () => {
      signal.removeEventListener('abort', abort);
      try {
        const data = await parseResponse<UploadDirectResult>(xhrResponse(xhr));
        debugLog('client:direct-upload:end', {
          duration_ms: Math.round(performance.now() - startedAt),
          status: xhr.status,
          object_key: data.object_key,
          compressed: data.compressed,
        });
        resolve(data);
      } catch (error) {
        debugError('client:direct-upload:error', {
          duration_ms: Math.round(performance.now() - startedAt),
          status: xhr.status,
          error: errorDebugData(error),
        });
        reject(error);
      }
    };

    xhr.open('POST', '/api/uploads/direct');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

export function proxyUploadPart(
  uploadId: string,
  partNumber: number,
  chunk: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
) {
  const formData = new FormData();
  formData.set('part_number', String(partNumber));
  formData.set('chunk', chunk, 'chunk');

  return new Promise<{ part_number: number; etag: string }>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();

      const abort = () => {
        xhr.abort();
        reject(new DOMException('Upload aborted', 'AbortError'));
      };

      if (signal.aborted) {
        abort();
        return;
      }

      signal.addEventListener('abort', abort, { once: true });
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded);
      };
      xhr.onerror = () => reject(new Error('分片上传失败'));
      xhr.onabort = () =>
        reject(new DOMException('Upload aborted', 'AbortError'));
      xhr.onload = async () => {
        signal.removeEventListener('abort', abort);
        try {
          resolve(
            await parseResponse<{ part_number: number; etag: string }>(
              xhrResponse(xhr),
            ),
          );
        } catch (error) {
          reject(error);
        }
      };

      xhr.open('POST', `/api/uploads/${uploadId}/parts/upload`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.withCredentials = true;
      xhr.send(formData);
    },
  );
}

export async function createUploadPart(
  uploadId: string,
  payload: { part_number: number; content_length: number },
) {
  return jsonRequest<UploadPartResult>(
    `/api/uploads/${uploadId}/parts`,
    'POST',
    payload,
  );
}

export async function completeUpload(
  uploadId: string,
  payload: {
    etag?: string | null;
    parts?: UploadCompletePart[];
    object_key?: string;
  },
) {
  return jsonRequest<unknown>(
    `/api/uploads/${uploadId}/complete`,
    'POST',
    payload,
  );
}

export async function abortUpload(uploadId: string) {
  return jsonRequest<unknown>(`/api/uploads/${uploadId}/abort`, 'POST');
}

export async function listFileApiKeys() {
  const data = await request<MaybeItems<FileApiKey>>('/api/file-api-keys');
  return asItems(data);
}

export async function createFileApiKey(payload: FileApiKeyPayload) {
  const data = await jsonRequest<MaybeCreatedFileApiKey>(
    '/api/file-api-keys',
    'POST',
    payload,
  );
  return asCreatedFileApiKey(data);
}

export async function updateFileApiKey(
  id: number | string,
  payload: FileApiKeyPayload,
) {
  const data = await jsonRequest<MaybeFileApiKey>(
    `/api/file-api-keys/${id}`,
    'PATCH',
    payload,
  );
  return asFileApiKey(data);
}

export async function deleteFileApiKey(id: number | string) {
  return jsonRequest<unknown>(`/api/file-api-keys/${id}`, 'DELETE');
}

export async function updateFileApiKeyLink(
  id: number | string,
  payload: FileApiKeyLinkPayload,
) {
  const data = await jsonRequest<MaybeFileApiKey>(
    `/api/file-api-keys/${id}`,
    'PATCH',
    { public_upload: payload.action },
  );
  return asFileApiKey(data);
}

export function publicUpload(
  uuid: string,
  file: File,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
) {
  const startedAt = performance.now();
  debugLog('client:public-upload:start', {
    uuid,
    filename: file.name,
    size: file.size,
    type: file.type,
  });

  const formData = new FormData();
  formData.set('file', file);

  return new Promise<PublicUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    const abort = () => {
      xhr.abort();
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    if (signal.aborted) {
      abort();
      return;
    }

    signal.addEventListener('abort', abort, { once: true });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onerror = () => {
      debugError('client:public-upload:error', {
        uuid,
        duration_ms: Math.round(performance.now() - startedAt),
        status: xhr.status,
        status_text: xhr.statusText,
      });
      reject(new Error('公开上传失败'));
    };
    xhr.onabort = () =>
      reject(new DOMException('Upload aborted', 'AbortError'));
    xhr.onload = async () => {
      signal.removeEventListener('abort', abort);
      try {
        const data = await parseResponse<PublicUploadResult>(xhrResponse(xhr));
        debugLog('client:public-upload:end', {
          uuid,
          duration_ms: Math.round(performance.now() - startedAt),
          status: xhr.status,
          object_key: data.object_key,
          compressed: data.compressed,
        });
        resolve(data);
      } catch (error) {
        debugError('client:public-upload:error', {
          uuid,
          duration_ms: Math.round(performance.now() - startedAt),
          status: xhr.status,
          error: errorDebugData(error),
        });
        reject(error);
      }
    };

    xhr.open('POST', `/api/public-uploads/${encodeURIComponent(uuid)}`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(formData);
  });
}

export function getSignedUrl(result: {
  upload_url?: string;
  presigned_url?: string;
  url?: string;
}) {
  return result.upload_url || result.presigned_url || result.url || '';
}

function xhrResponse(xhr: XMLHttpRequest) {
  return new Response(xhr.responseText, {
    status: xhr.status,
    statusText: xhr.statusText,
    headers: {
      'Content-Type': xhr.getResponseHeader('Content-Type') ?? '',
    },
  });
}
