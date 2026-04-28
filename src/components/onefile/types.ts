export type ProviderId =
  | 's3'
  | 'r2'
  | 'b2'
  | 'oci'
  | 'aliyun_oss'
  | 'tencent_cos';

export type CurrentUser = {
  id: number | string;
  username: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: 'user' | 'admin' | string;
  status?: 'active' | 'disabled' | string;
};

export type StorageAccount = {
  id: number | string;
  name: string;
  provider: ProviderId;
  provider_account_id?: string | null;
  region?: string | null;
  endpoint?: string | null;
  namespace?: string | null;
  compartment_id?: string | null;
  access_key_id?: string | null;
  credential_hint?: string | null;
  status?: 'active' | 'inactive' | 'error' | string;
  last_checked_at?: string | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StorageBucket = {
  id: number | string;
  storage_account_id?: number | string;
  storageAccountId?: number | string;
  name: string;
  provider?: ProviderId | string | null;
  account_name?: string | null;
  provider_name?: string | null;
  region?: string | null;
  endpoint?: string | null;
  key_prefix?: string | null;
  public_base_url?: string | null;
  visibility?: 'private' | 'public' | string;
  is_default?: boolean | number;
  cors_status?: 'unknown' | 'ok' | 'error' | string;
  last_checked_at?: string | null;
  last_error?: string | null;
};

export type FileItem = {
  kind: 'file' | 'folder';
  name: string;
  path: string;
  size?: number | null;
  updated_at?: string | null;
  etag?: string | null;
  mime_type?: string | null;
};

export type FileListResult = {
  items: FileItem[];
  prefix?: string;
  parent_prefix?: string;
  page?: {
    next_cursor?: string | null;
    total?: number | null;
  };
};

export type FileApiToken = {
  id: number | string;
  name: string;
  token_prefix?: string | null;
  description?: string | null;
  scopes?: string;
  status?: 'active' | 'inactive' | string;
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
};

export type UploadMode = 'single' | 'multipart';

export type UploadInitPayload = {
  bucket_id: number | string;
  object_key: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  upload_mode: UploadMode;
  part_size?: number;
  total_parts?: number;
};

export type UploadInitResult = {
  id?: string;
  upload_id?: string;
  object_key?: string;
  upload_url?: string;
  presigned_url?: string;
  url?: string;
  headers?: Record<string, string>;
  method?: string;
  part_size?: number;
  total_parts?: number;
  expires_at?: string;
};

export type UploadPartResult = {
  part_number?: number;
  upload_url?: string;
  presigned_url?: string;
  url?: string;
  headers?: Record<string, string>;
  method?: string;
};

export type UploadCompletePart = {
  part_number: number;
  etag?: string | null;
};

export type ApiEnvelope<T> = {
  data: T;
  error: null;
};

export type ApiFailure = {
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
