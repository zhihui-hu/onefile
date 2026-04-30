import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'onefile_users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull().default('github'),
    username: text('username').notNull().unique(),
    email: text('email'),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    role: text('role', { enum: ['user', 'admin'] })
      .notNull()
      .default('user'),
    status: text('status', { enum: ['active', 'disabled'] })
      .notNull()
      .default('active'),
    lastLoginAt: text('last_login_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_onefile_users_email')
      .on(table.email)
      .where(sql`${table.email} IS NOT NULL`),
    index('idx_onefile_users_status').on(table.status),
  ],
);

export const oauthTokens = sqliteTable(
  'onefile_oauth_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('github'),
    accessTokenCiphertext: text('access_token_ciphertext').notNull(),
    refreshTokenCiphertext: text('refresh_token_ciphertext'),
    tokenType: text('token_type').notNull().default('bearer'),
    scope: text('scope').notNull().default(''),
    expiresAt: text('expires_at'),
    refreshTokenExpiresAt: text('refresh_token_expires_at'),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: text('last_used_at'),
  },
  (table) => [
    uniqueIndex('idx_onefile_oauth_tokens_user_provider').on(
      table.userId,
      table.provider,
    ),
    index('idx_onefile_oauth_tokens_user_id').on(table.userId),
    index('idx_onefile_oauth_tokens_provider').on(table.provider),
    index('idx_onefile_oauth_tokens_expires_at').on(table.expiresAt),
  ],
);

export const authRefreshTokens = sqliteTable(
  'onefile_auth_refresh_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    tokenFamily: text('token_family').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    expiresAt: text('expires_at')
      .notNull()
      .default(sql`(datetime('now', '+30 days'))`),
    revokedAt: text('revoked_at'),
    replacedByTokenHash: text('replaced_by_token_hash'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: text('last_used_at'),
  },
  (table) => [
    index('idx_onefile_auth_refresh_tokens_user_id').on(table.userId),
    index('idx_onefile_auth_refresh_tokens_family').on(table.tokenFamily),
    index('idx_onefile_auth_refresh_tokens_expires_at').on(table.expiresAt),
  ],
);

export const storageAccounts = sqliteTable(
  'onefile_storage_accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    provider: text('provider', {
      enum: ['s3', 'r2', 'b2', 'oci', 'aliyun_oss', 'tencent_cos'],
    }).notNull(),
    providerAccountId: text('provider_account_id'),
    region: text('region'),
    endpoint: text('endpoint'),
    namespace: text('namespace'),
    compartmentId: text('compartment_id'),
    accessKeyId: text('access_key_id').notNull(),
    secretKeyCiphertext: text('secret_key_ciphertext').notNull(),
    credentialHint: text('credential_hint'),
    extraConfig: text('extra_config').notNull().default('{}'),
    status: text('status', { enum: ['active', 'inactive', 'error'] })
      .notNull()
      .default('active'),
    lastCheckedAt: text('last_checked_at'),
    lastError: text('last_error'),
    credentialsUpdatedAt: text('credentials_updated_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_onefile_storage_accounts_user_provider_name').on(
      table.userId,
      table.provider,
      table.name,
    ),
    index('idx_onefile_storage_accounts_user_id').on(table.userId),
    index('idx_onefile_storage_accounts_provider').on(table.provider),
    index('idx_onefile_storage_accounts_status').on(table.status),
  ],
);

export const storageBuckets = sqliteTable(
  'onefile_storage_buckets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    storageAccountId: integer('storage_account_id')
      .notNull()
      .references(() => storageAccounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    region: text('region'),
    endpoint: text('endpoint'),
    keyPrefix: text('key_prefix').notNull().default(''),
    publicBaseUrl: text('public_base_url'),
    visibility: text('visibility', { enum: ['private', 'public'] })
      .notNull()
      .default('private'),
    lastCheckedAt: text('last_checked_at'),
    lastError: text('last_error'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_onefile_storage_buckets_account_name').on(
      table.userId,
      table.storageAccountId,
      table.name,
    ),
    index('idx_onefile_storage_buckets_user_id').on(table.userId),
    index('idx_onefile_storage_buckets_storage_account_id').on(
      table.storageAccountId,
    ),
  ],
);

export const fileUploads = sqliteTable(
  'onefile_file_uploads',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bucketId: integer('bucket_id')
      .notNull()
      .references(() => storageBuckets.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: text('mime_type').notNull().default('application/octet-stream'),
    uploadMode: text('upload_mode', {
      enum: ['single', 'multipart'],
    }).notNull(),
    providerUploadId: text('provider_upload_id'),
    partSize: integer('part_size'),
    totalParts: integer('total_parts'),
    contentMd5: text('content_md5'),
    contentSha256: text('content_sha256'),
    status: text('status', {
      enum: [
        'initiated',
        'uploading',
        'completed',
        'failed',
        'aborted',
        'expired',
      ],
    })
      .notNull()
      .default('initiated'),
    expiresAt: text('expires_at').notNull(),
    completedAt: text('completed_at'),
    abortedAt: text('aborted_at'),
    errorMessage: text('error_message'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_onefile_file_uploads_object_provider').on(
      table.bucketId,
      table.objectKey,
      table.providerUploadId,
    ),
    index('idx_onefile_file_uploads_user_status').on(
      table.userId,
      table.status,
    ),
    index('idx_onefile_file_uploads_bucket_key').on(
      table.bucketId,
      table.objectKey,
    ),
    index('idx_onefile_file_uploads_expires_at').on(table.expiresAt),
    uniqueIndex('idx_onefile_file_uploads_active_object')
      .on(table.bucketId, table.objectKey)
      .where(sql`${table.status} IN ('initiated', 'uploading')`),
  ],
);

export const fileUploadParts = sqliteTable(
  'onefile_file_upload_parts',
  {
    uploadId: text('upload_id')
      .notNull()
      .references(() => fileUploads.id, { onDelete: 'cascade' }),
    partNumber: integer('part_number').notNull(),
    partSize: integer('part_size').notNull(),
    etag: text('etag'),
    contentMd5: text('content_md5'),
    status: text('status', { enum: ['pending', 'uploaded', 'failed'] })
      .notNull()
      .default('pending'),
    uploadedAt: text('uploaded_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.uploadId, table.partNumber] }),
    index('idx_onefile_file_upload_parts_status').on(
      table.uploadId,
      table.status,
    ),
  ],
);

export const fileApiKeys = sqliteTable(
  'onefile_file_api_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenPrefix: text('token_prefix').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    description: text('description'),
    scopes: text('scopes').notNull(),
    status: text('status', { enum: ['active', 'inactive'] })
      .notNull()
      .default('active'),
    lastUsedAt: text('last_used_at'),
    lastUsedIp: text('last_used_ip'),
    lastUsedUserAgent: text('last_used_user_agent'),
    expiresAt: text('expires_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_onefile_file_api_tokens_user_status').on(
      table.userId,
      table.status,
    ),
    index('idx_onefile_file_api_tokens_prefix').on(table.tokenPrefix),
    index('idx_onefile_file_api_tokens_expires_at').on(table.expiresAt),
  ],
);

export const schema = {
  users,
  oauthTokens,
  authRefreshTokens,
  storageAccounts,
  storageBuckets,
  fileUploads,
  fileUploadParts,
  fileApiKeys,
};

export type User = typeof users.$inferSelect;
export type StorageAccount = typeof storageAccounts.$inferSelect;
export type StorageBucket = typeof storageBuckets.$inferSelect;
export type FileUpload = typeof fileUploads.$inferSelect;
export type FileApiKey = typeof fileApiKeys.$inferSelect;
