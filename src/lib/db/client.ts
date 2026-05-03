import { getEnv } from '@/lib/env';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

import { schema } from './schema';

declare global {
  var __onefileSqlite: Database.Database | undefined;
  var __onefileSqliteSchemaVersion: number | undefined;
}

const DEV_SCHEMA_VERSION = 2;
const FILE_API_TOKEN_RUNTIME_COLUMNS = [
  'token_ciphertext',
  'storage_bucket_id',
  'compress_images',
  'public_upload_uuid',
  'public_upload_created_at',
  'public_upload_revoked_at',
] as const;

const STORAGE_ACCOUNT_COLUMNS = [
  'id',
  'user_id',
  'name',
  'provider',
  'provider_account_id',
  'region',
  'endpoint',
  'namespace',
  'compartment_id',
  'access_key_id',
  'secret_key_ciphertext',
  'credential_hint',
  'extra_config',
  'status',
  'last_checked_at',
  'last_error',
  'credentials_updated_at',
  'created_at',
  'updated_at',
] as const;

type PragmaIndexListRow = {
  name: string;
  unique: number;
};

type PragmaIndexInfoRow = {
  seqno: number;
  name: string;
};

type PragmaTableInfoRow = {
  name: string;
};

function resolveProjectPath(filePath: string) {
  if (filePath === ':memory:' || path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), filePath);
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function sameColumns(left: string[], right: readonly string[]) {
  return (
    left.length === right.length && left.every((name, i) => name === right[i])
  );
}

function storageAccountUniqueIndexColumns(
  sqlite: Database.Database,
  indexName: string,
) {
  return (
    sqlite
      .prepare(`PRAGMA index_info(${quoteIdentifier(indexName)})`)
      .all() as PragmaIndexInfoRow[]
  )
    .sort((a, b) => a.seqno - b.seqno)
    .map((row) => row.name);
}

function tableHasColumn(
  sqlite: Database.Database,
  tableName: string,
  columnName: string,
) {
  const columns = sqlite
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all() as PragmaTableInfoRow[];
  return columns.some((column) => column.name === columnName);
}

function hasOldStorageAccountUniqueConstraint(sqlite: Database.Database) {
  const indexes = sqlite
    .prepare("PRAGMA index_list('onefile_storage_accounts')")
    .all() as PragmaIndexListRow[];

  return indexes.some((index) => {
    if (index.unique !== 1) {
      return false;
    }

    const columns = storageAccountUniqueIndexColumns(sqlite, index.name);
    return sameColumns(columns, ['user_id', 'name']);
  });
}

function migrateStorageAccountUniqueConstraint(sqlite: Database.Database) {
  if (!hasOldStorageAccountUniqueConstraint(sqlite)) {
    return;
  }

  const columnList = STORAGE_ACCOUNT_COLUMNS.map(quoteIdentifier).join(', ');

  sqlite.pragma('foreign_keys = OFF');
  try {
    sqlite.exec(`
      BEGIN;

      DROP TABLE IF EXISTS onefile_storage_accounts_new;
      CREATE TABLE onefile_storage_accounts_new (
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

      INSERT INTO onefile_storage_accounts_new (${columnList})
        SELECT ${columnList} FROM onefile_storage_accounts;

      DROP TABLE onefile_storage_accounts;
      ALTER TABLE onefile_storage_accounts_new RENAME TO onefile_storage_accounts;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_onefile_storage_accounts_user_provider_name
        ON onefile_storage_accounts(user_id, provider, name);
      CREATE INDEX IF NOT EXISTS idx_onefile_storage_accounts_user_id
        ON onefile_storage_accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_onefile_storage_accounts_provider
        ON onefile_storage_accounts(provider);
      CREATE INDEX IF NOT EXISTS idx_onefile_storage_accounts_status
        ON onefile_storage_accounts(status);

      COMMIT;
    `);
  } catch (error) {
    if (sqlite.inTransaction) {
      sqlite.exec('ROLLBACK');
    }
    throw error;
  } finally {
    sqlite.pragma('foreign_keys = ON');
  }
}

function migrateStorageBucketCorsStatus(sqlite: Database.Database) {
  if (!tableHasColumn(sqlite, 'onefile_storage_buckets', 'cors_status')) {
    return;
  }

  sqlite.exec('ALTER TABLE onefile_storage_buckets DROP COLUMN cors_status');
}

function migrateStorageBucketDefaultFlag(sqlite: Database.Database) {
  sqlite.exec('DROP INDEX IF EXISTS idx_onefile_storage_buckets_user_default');

  if (!tableHasColumn(sqlite, 'onefile_storage_buckets', 'is_default')) {
    return;
  }

  sqlite.exec('ALTER TABLE onefile_storage_buckets DROP COLUMN is_default');
}

function migrateFileApiKeyImageCompress(sqlite: Database.Database) {
  if (!tableHasColumn(sqlite, 'onefile_file_api_tokens', 'image_compress')) {
    return;
  }

  sqlite.exec('ALTER TABLE onefile_file_api_tokens DROP COLUMN image_compress');
}

function addFileApiKeyColumnIfMissing(
  sqlite: Database.Database,
  columnName: string,
  columnDefinition: string,
) {
  if (tableHasColumn(sqlite, 'onefile_file_api_tokens', columnName)) {
    return;
  }

  sqlite.exec(
    `ALTER TABLE onefile_file_api_tokens ADD COLUMN ${columnDefinition}`,
  );
}

function migrateFileApiKeyUploadStrategy(sqlite: Database.Database) {
  addFileApiKeyColumnIfMissing(
    sqlite,
    'token_ciphertext',
    'token_ciphertext TEXT',
  );
  addFileApiKeyColumnIfMissing(
    sqlite,
    'storage_bucket_id',
    'storage_bucket_id INTEGER REFERENCES onefile_storage_buckets(id) ON DELETE SET NULL',
  );
  addFileApiKeyColumnIfMissing(
    sqlite,
    'compress_images',
    'compress_images INTEGER NOT NULL DEFAULT 0',
  );
  addFileApiKeyColumnIfMissing(
    sqlite,
    'public_upload_uuid',
    'public_upload_uuid TEXT',
  );
  addFileApiKeyColumnIfMissing(
    sqlite,
    'public_upload_created_at',
    'public_upload_created_at TEXT',
  );
  addFileApiKeyColumnIfMissing(
    sqlite,
    'public_upload_revoked_at',
    'public_upload_revoked_at TEXT',
  );

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_onefile_file_api_tokens_storage_bucket_id
      ON onefile_file_api_tokens(storage_bucket_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_onefile_file_api_tokens_public_upload_uuid
      ON onefile_file_api_tokens(public_upload_uuid)
      WHERE public_upload_uuid IS NOT NULL;
  `);
}

function ensureSchema(sqlite: Database.Database) {
  const modelSql = fs.readFileSync(
    path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      'src',
      'lib',
      'db',
      'model.sql',
    ),
    'utf8',
  );
  sqlite.exec(modelSql);
  migrateStorageAccountUniqueConstraint(sqlite);
  migrateStorageBucketCorsStatus(sqlite);
  migrateStorageBucketDefaultFlag(sqlite);
  migrateFileApiKeyImageCompress(sqlite);
  migrateFileApiKeyUploadStrategy(sqlite);
}

function fileApiTokenSchemaIsCurrent(sqlite: Database.Database) {
  return FILE_API_TOKEN_RUNTIME_COLUMNS.every((columnName) =>
    tableHasColumn(sqlite, 'onefile_file_api_tokens', columnName),
  );
}

function ensureCachedSchema(sqlite: Database.Database) {
  if (
    globalThis.__onefileSqliteSchemaVersion === DEV_SCHEMA_VERSION &&
    fileApiTokenSchemaIsCurrent(sqlite)
  ) {
    return;
  }

  ensureSchema(sqlite);
  globalThis.__onefileSqliteSchemaVersion = DEV_SCHEMA_VERSION;
}

function createSqliteClient() {
  const dbPath = resolveProjectPath(getEnv().databasePath);
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  ensureSchema(sqlite);
  globalThis.__onefileSqliteSchemaVersion = DEV_SCHEMA_VERSION;
  return sqlite;
}

export function getSqlite() {
  if (process.env.NODE_ENV === 'production') {
    return createSqliteClient();
  }

  globalThis.__onefileSqlite ??= createSqliteClient();
  ensureCachedSchema(globalThis.__onefileSqlite);
  return globalThis.__onefileSqlite;
}

export const db = drizzle(getSqlite(), { schema });
