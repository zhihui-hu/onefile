import type {
  ApiFailure,
  CurrentUser,
  FileApiToken,
  FileItem,
  FileListResult,
  StorageAccount,
  StorageBucket,
  UploadCompletePart,
  UploadInitPayload,
  UploadInitResult,
  UploadPartResult,
} from './types';

type JsonObject = Record<string, unknown>;
type MaybeItems<T> = T[] | { items?: T[] };
type MaybeUser = CurrentUser | { user?: CurrentUser | null } | null;

export class OneFileApiError extends Error {
  code: string;
  details?: unknown;
  status: number;

  constructor(
    message: string,
    status: number,
    code = 'REQUEST_FAILED',
    details?: unknown,
  ) {
    super(message);
    this.name = 'OneFileApiError';
    this.code = code;
    this.details = details;
    this.status = status;
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
      );
    }
    return envelope.data;
  }

  return payload as T;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });

  return parseResponse<T>(response);
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
  return jsonRequest<StorageAccount>('/api/storage/accounts', 'POST', payload);
}

export async function updateStorageAccount(
  id: number | string,
  payload: JsonObject,
) {
  return jsonRequest<StorageAccount>(
    `/api/storage/accounts/${id}`,
    'PATCH',
    payload,
  );
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
  return jsonRequest<StorageBucket>(
    `/api/storage/buckets/${id}`,
    'PATCH',
    payload,
  );
}

export async function setDefaultBucket(id: number | string) {
  return jsonRequest<StorageBucket>(
    `/api/storage/buckets/${id}/default`,
    'POST',
  );
}

export async function listFiles(params: {
  bucketId: number | string;
  prefix?: string;
  search?: string;
}) {
  const data = await request<FileListResult | FileItem[]>(
    `/api/files${queryString({
      bucket_id: params.bucketId,
      prefix: params.prefix,
      search: params.search,
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

export async function createUpload(payload: UploadInitPayload) {
  return jsonRequest<UploadInitResult>('/api/uploads', 'POST', payload);
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

export async function listFileApiTokens() {
  const data = await request<MaybeItems<FileApiToken>>('/api/file-api-tokens');
  return asItems(data);
}

export async function createFileApiToken(payload: JsonObject) {
  return jsonRequest<FileApiToken & { token?: string; plain_token?: string }>(
    '/api/file-api-tokens',
    'POST',
    payload,
  );
}

export async function updateFileApiToken(
  id: number | string,
  payload: JsonObject,
) {
  return jsonRequest<FileApiToken>(
    `/api/file-api-tokens/${id}`,
    'PATCH',
    payload,
  );
}

export async function deleteFileApiToken(id: number | string) {
  return jsonRequest<unknown>(`/api/file-api-tokens/${id}`, 'DELETE');
}

export function getSignedUrl(result: {
  upload_url?: string;
  presigned_url?: string;
  url?: string;
}) {
  return result.upload_url || result.presigned_url || result.url || '';
}
