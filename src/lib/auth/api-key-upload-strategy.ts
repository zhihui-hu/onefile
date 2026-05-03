import { HttpError } from '@/lib/api/response';
import { type ApiKeyScope, parseScopes } from '@/lib/auth/api-keys';
import { db, getSqlite } from '@/lib/db/client';
import { type User, users } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

const FILE_API_KEY_TABLE = 'onefile_file_api_tokens';

type ApiKeyUploadStrategyRow = {
  id: number;
  user_id: number;
  scopes: string;
  public_upload_uuid: string | null;
  public_upload_revoked_at: string | null;
  storage_bucket_id: number | null;
  compress_images: number | string | boolean | null;
};

type ApiKeyUploadStrategy = {
  apiKeyId: number;
  userId: number;
  publicUploadUuid: string | null;
  storageBucketId: number | null;
  compressImages: boolean;
};

type PublicUploadApiKeyContext = {
  user: User;
  strategy: ApiKeyUploadStrategy;
};

type PragmaTableInfoRow = {
  name: string;
};

const IMPLIED_SCOPES: Record<ApiKeyScope, ApiKeyScope[]> = {
  'files:read': [],
  'files:write': ['uploads:write'],
  'files:delete': [],
  'uploads:write': [],
};

function fileApiKeyColumns() {
  const sqlite = getSqlite();
  const columns = sqlite
    .prepare(`PRAGMA table_info(${FILE_API_KEY_TABLE})`)
    .all() as PragmaTableInfoRow[];
  return new Set(columns.map((column) => column.name));
}

function optionalColumn(
  columns: Set<string>,
  name: string,
  alias: keyof ApiKeyUploadStrategyRow,
) {
  return columns.has(name) ? `${name} AS ${alias}` : `NULL AS ${alias}`;
}

function normalizeBoolean(value: number | string | boolean | null) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
  return false;
}

function expandScopes(scopes: ApiKeyScope[]) {
  const expanded = new Set(scopes);
  for (const scope of scopes) {
    for (const impliedScope of IMPLIED_SCOPES[scope]) {
      expanded.add(impliedScope);
    }
  }
  return expanded;
}

function assertScopes(row: ApiKeyUploadStrategyRow, scopes: ApiKeyScope[]) {
  const expanded = expandScopes(parseScopes(row.scopes));
  const missingScopes = scopes.filter((scope) => !expanded.has(scope));
  if (missingScopes.length > 0) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      'API key does not include required scope',
      { required_scopes: missingScopes },
    );
  }
}

function toStrategy(row: ApiKeyUploadStrategyRow): ApiKeyUploadStrategy {
  return {
    apiKeyId: row.id,
    userId: row.user_id,
    publicUploadUuid: row.public_upload_revoked_at
      ? null
      : row.public_upload_uuid,
    storageBucketId: row.storage_bucket_id,
    compressImages: normalizeBoolean(row.compress_images),
  };
}

function lastUsedPatch(request: NextRequest, now: string) {
  return {
    lastUsedAt: now,
    lastUsedIp:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null,
    lastUsedUserAgent: request.headers.get('user-agent') ?? null,
  };
}

export function getApiKeyUploadStrategy(apiKeyId: number) {
  const columns = fileApiKeyColumns();
  const sqlite = getSqlite();
  const row = sqlite
    .prepare(
      `
        SELECT
          id,
          user_id,
          scopes,
          ${optionalColumn(columns, 'public_upload_uuid', 'public_upload_uuid')},
          ${optionalColumn(
            columns,
            'public_upload_revoked_at',
            'public_upload_revoked_at',
          )},
          ${optionalColumn(columns, 'storage_bucket_id', 'storage_bucket_id')},
          ${optionalColumn(columns, 'compress_images', 'compress_images')}
        FROM ${FILE_API_KEY_TABLE}
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(apiKeyId) as ApiKeyUploadStrategyRow | undefined;

  return row ? toStrategy(row) : null;
}

export async function getPublicUploadApiKeyContext(
  request: NextRequest,
  publicUploadUuid: string,
  requiredScopes: ApiKeyScope[] = ['uploads:write'],
): Promise<PublicUploadApiKeyContext> {
  const columns = fileApiKeyColumns();
  if (!columns.has('public_upload_uuid')) {
    throw new HttpError(404, 'NOT_FOUND', 'Public upload link was not found');
  }

  const revokedFilter = columns.has('public_upload_revoked_at')
    ? 'AND public_upload_revoked_at IS NULL'
    : '';
  const now = new Date().toISOString();
  const sqlite = getSqlite();
  const row = sqlite
    .prepare(
      `
        SELECT
          id,
          user_id,
          scopes,
          public_upload_uuid,
          ${optionalColumn(
            columns,
            'public_upload_revoked_at',
            'public_upload_revoked_at',
          )},
          ${optionalColumn(columns, 'storage_bucket_id', 'storage_bucket_id')},
          ${optionalColumn(columns, 'compress_images', 'compress_images')}
        FROM ${FILE_API_KEY_TABLE}
        WHERE public_upload_uuid = ?
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > ?)
          ${revokedFilter}
        LIMIT 1
      `,
    )
    .get(publicUploadUuid, now) as ApiKeyUploadStrategyRow | undefined;

  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', 'Public upload link was not found');
  }

  assertScopes(row, requiredScopes);

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, row.user_id), eq(users.status, 'active')))
    .limit(1);

  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'API key user is unavailable');
  }

  sqlite
    .prepare(
      `
        UPDATE ${FILE_API_KEY_TABLE}
        SET last_used_at = @lastUsedAt,
            last_used_ip = @lastUsedIp,
            last_used_user_agent = @lastUsedUserAgent
        WHERE id = @apiKeyId
      `,
    )
    .run({ ...lastUsedPatch(request, now), apiKeyId: row.id });

  return { user, strategy: toStrategy(row) };
}
