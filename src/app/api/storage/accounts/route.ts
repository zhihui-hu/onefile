import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { type StorageAccount, storageAccounts } from '@/lib/db/schema';
import { createStorageAdapter } from '@/lib/storage';
import { encryptedSecret, publicStorageAccount } from '@/lib/storage-config';
import {
  defaultStorageEndpoint,
  optionalStorageString,
  storageRegionOrDefault,
} from '@/lib/storage/endpoints';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

const providerSchema = z.enum([
  's3',
  'r2',
  'b2',
  'oci',
  'aliyun_oss',
  'tencent_cos',
]);

const createSchema = z.object({
  name: z.string().min(1).max(80),
  provider: providerSchema,
  provider_account_id: z.string().max(160).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  endpoint: z.string().url().or(z.string().max(240)).nullable().optional(),
  namespace: z.string().max(160).nullable().optional(),
  compartment_id: z.string().max(240).nullable().optional(),
  access_key_id: z.string().min(1).max(240),
  secret_access_key: z.string().min(1).max(10000),
  extra_config: z.record(z.string(), z.unknown()).optional(),
});

function assertRequiredProviderAccountId(
  provider: z.infer<typeof providerSchema>,
  providerAccountId: string | null,
) {
  if (provider === 'r2' && !providerAccountId) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      '请输入 Cloudflare Account ID。',
    );
  }

  if (provider === 'tencent_cos' && !providerAccountId) {
    throw new HttpError(400, 'VALIDATION_ERROR', '请输入腾讯云 AppID。');
  }
}

function throwStorageAccountConflict(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (
    code.startsWith('SQLITE_CONSTRAINT') &&
    message.includes('onefile_storage_accounts')
  ) {
    throw new HttpError(409, 'CONFLICT', '同一仓商下已存在同名存储账号。');
  }

  throw error;
}

export async function GET() {
  return withApiHandler(async () => {
    const user = await requireUser();
    const accounts = await db
      .select()
      .from(storageAccounts)
      .where(eq(storageAccounts.userId, user.id))
      .orderBy(desc(storageAccounts.createdAt));

    return ok({ items: accounts.map(publicStorageAccount) });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const payload = await parseJson(request, createSchema);
    const providerAccountId = optionalStorageString(
      payload.provider_account_id,
    );
    const region = storageRegionOrDefault(payload.provider, payload.region);
    const endpoint =
      optionalStorageString(payload.endpoint) ??
      defaultStorageEndpoint({
        provider: payload.provider,
        region,
        accountId: providerAccountId,
      });

    assertRequiredProviderAccountId(payload.provider, providerAccountId);

    const extraConfig = { ...(payload.extra_config ?? {}) };
    if (providerAccountId) {
      extraConfig.accountId = providerAccountId;
    }
    if (payload.namespace) {
      extraConfig.namespace = payload.namespace;
    }
    if (payload.compartment_id) {
      extraConfig.compartmentId = payload.compartment_id;
    }

    const check = await createStorageAdapter({
      provider: payload.provider,
      accessKeyId: payload.access_key_id,
      secretAccessKey: payload.secret_access_key,
      region,
      endpoint,
      extraConfig,
    }).checkCredentials();

    if (!check.ok) {
      throw new HttpError(
        400,
        'PROVIDER_ERROR',
        `凭证校验失败：${check.error?.message ?? '请检查 Access key、Secret key、Region 和 Endpoint。'}`,
        check.error,
      );
    }

    const now = new Date().toISOString();
    const secret = encryptedSecret(payload.secret_access_key);

    let account: StorageAccount | undefined;
    try {
      [account] = await db
        .insert(storageAccounts)
        .values({
          userId: user.id,
          name: payload.name,
          provider: payload.provider,
          providerAccountId,
          region,
          endpoint,
          namespace: payload.namespace ?? null,
          compartmentId: payload.compartment_id ?? null,
          accessKeyId: payload.access_key_id,
          secretKeyCiphertext: secret.secretKeyCiphertext,
          credentialHint: secret.credentialHint,
          extraConfig: JSON.stringify(payload.extra_config ?? {}),
          credentialsUpdatedAt: secret.credentialsUpdatedAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    } catch (error) {
      throwStorageAccountConflict(error);
    }

    if (!account) {
      throw new HttpError(500, 'INTERNAL_ERROR', 'Storage account not created');
    }

    return ok({ account: publicStorageAccount(account) });
  });
}
