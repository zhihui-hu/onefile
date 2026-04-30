-- OneFile standalone schema
-- Design target:
-- 1. Browser uploads directly to object storage through presigned URLs.
-- 2. The server stores accounts, buckets, transient upload state, and access
--    tokens only. Object storage is the source of truth for file listings.
-- 3. File bytes and chunk bytes are never stored on the application server.
-- 4. Authentication currently supports GitHub OAuth only.
-- 5. Access JWTs are stateless; refresh tokens are optional and stored as hashes
--    only when you need long-lived login, logout, and revocation.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS onefile_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL DEFAULT 'github' CHECK (provider = 'github'),
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onefile_users_email
  ON onefile_users(email)
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_onefile_users_status ON onefile_users(status);

CREATE TABLE IF NOT EXISTS onefile_oauth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'github' CHECK (provider = 'github'),
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT,
  token_type TEXT NOT NULL DEFAULT 'bearer',
  scope TEXT NOT NULL DEFAULT '',
  expires_at TEXT,
  refresh_token_expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  UNIQUE (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES onefile_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onefile_oauth_tokens_user_id ON onefile_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_onefile_oauth_tokens_provider ON onefile_oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_onefile_oauth_tokens_expires_at ON onefile_oauth_tokens(expires_at);

-- Optional for JWT auth.
-- Keep this table if you issue refresh tokens or need logout/revoke-all-devices.
-- If you only use short-lived access JWTs, this table can be removed.
CREATE TABLE IF NOT EXISTS onefile_auth_refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_family TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days')),
  revoked_at TEXT,
  replaced_by_token_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES onefile_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onefile_auth_refresh_tokens_user_id ON onefile_auth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_onefile_auth_refresh_tokens_family ON onefile_auth_refresh_tokens(token_family);
CREATE INDEX IF NOT EXISTS idx_onefile_auth_refresh_tokens_expires_at ON onefile_auth_refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS onefile_storage_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('s3', 'r2', 'b2', 'oci', 'aliyun_oss', 'tencent_cos')),
  provider_account_id TEXT,
  region TEXT,
  endpoint TEXT,
  namespace TEXT,
  compartment_id TEXT,
  access_key_id TEXT NOT NULL,
  secret_key_ciphertext TEXT NOT NULL,
  credential_hint TEXT,
  extra_config TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  last_checked_at TEXT,
  last_error TEXT,
  credentials_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES onefile_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onefile_storage_accounts_user_provider_name
  ON onefile_storage_accounts(user_id, provider, name);
CREATE INDEX IF NOT EXISTS idx_onefile_storage_accounts_user_id ON onefile_storage_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_onefile_storage_accounts_provider ON onefile_storage_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_onefile_storage_accounts_status ON onefile_storage_accounts(status);

CREATE TABLE IF NOT EXISTS onefile_storage_buckets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  storage_account_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  endpoint TEXT,
  key_prefix TEXT NOT NULL DEFAULT '',
  public_base_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  last_checked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, storage_account_id, name),
  FOREIGN KEY (user_id) REFERENCES onefile_users(id) ON DELETE CASCADE,
  FOREIGN KEY (storage_account_id) REFERENCES onefile_storage_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onefile_storage_buckets_user_id ON onefile_storage_buckets(user_id);
CREATE INDEX IF NOT EXISTS idx_onefile_storage_buckets_storage_account_id ON onefile_storage_buckets(storage_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_onefile_storage_buckets_user_default
  ON onefile_storage_buckets(user_id)
  WHERE is_default = 1;

-- Ephemeral upload intent/state for direct uploads.
-- File listings are read from object storage through provider SDKs, so completed
-- uploads do not create a long-lived row in a files table.
-- Completed rows may be kept briefly for idempotent finalize/retry handling,
-- then deleted by the cleanup job.
-- For small files, upload_mode = 'single' and provider_upload_id is NULL.
-- For large files, upload_mode = 'multipart' and provider_upload_id stores the
-- storage provider's multipart upload id.
CREATE TABLE IF NOT EXISTS onefile_file_uploads (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  bucket_id INTEGER NOT NULL,
  object_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  upload_mode TEXT NOT NULL CHECK (upload_mode IN ('single', 'multipart')),
  provider_upload_id TEXT,
  part_size INTEGER CHECK (part_size IS NULL OR part_size > 0),
  total_parts INTEGER CHECK (total_parts IS NULL OR total_parts > 0),
  content_md5 TEXT,
  content_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'uploading', 'completed', 'failed', 'aborted', 'expired')),
  expires_at TEXT NOT NULL,
  completed_at TEXT,
  aborted_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (bucket_id, object_key, provider_upload_id),
  FOREIGN KEY (user_id) REFERENCES onefile_users(id) ON DELETE CASCADE,
  FOREIGN KEY (bucket_id) REFERENCES onefile_storage_buckets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onefile_file_uploads_user_status ON onefile_file_uploads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_onefile_file_uploads_bucket_key ON onefile_file_uploads(bucket_id, object_key);
CREATE INDEX IF NOT EXISTS idx_onefile_file_uploads_expires_at ON onefile_file_uploads(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_onefile_file_uploads_active_object
  ON onefile_file_uploads(bucket_id, object_key)
  WHERE status IN ('initiated', 'uploading');

-- Multipart upload part metadata only. Presigned URLs are intentionally not
-- stored because they expire and can leak write access.
CREATE TABLE IF NOT EXISTS onefile_file_upload_parts (
  upload_id TEXT NOT NULL,
  part_number INTEGER NOT NULL CHECK (part_number > 0),
  part_size INTEGER NOT NULL CHECK (part_size > 0),
  etag TEXT,
  content_md5 TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'failed')),
  uploaded_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (upload_id, part_number),
  FOREIGN KEY (upload_id) REFERENCES onefile_file_uploads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onefile_file_upload_parts_status ON onefile_file_upload_parts(upload_id, status);

CREATE TABLE IF NOT EXISTS onefile_file_api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  description TEXT,
  scopes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_used_at TEXT,
  last_used_ip TEXT,
  last_used_user_agent TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES onefile_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onefile_file_api_tokens_user_status ON onefile_file_api_tokens(user_id, status);
CREATE INDEX IF NOT EXISTS idx_onefile_file_api_tokens_prefix ON onefile_file_api_tokens(token_prefix);
CREATE INDEX IF NOT EXISTS idx_onefile_file_api_tokens_expires_at ON onefile_file_api_tokens(expires_at);
