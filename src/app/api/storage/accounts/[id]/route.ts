import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { type StorageAccount, storageAccounts } from '@/lib/db/schema';
import {
  encryptedSecret,
  getStorageAccountForUser,
  publicStorageAccount,
} from '@/lib/storage-config';
import {
  defaultStorageEndpoint,
  optionalStorageString,
  storageRegionOrDefault,
} from '@/lib/storage/endpoints';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  provider_account_id: z.string().max(160).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  endpoint: z.string().url().or(z.string().max(240)).nullable().optional(),
  namespace: z.string().max(160).nullable().optional(),
  compartment_id: z.string().max(240).nullable().optional(),
  access_key_id: z.string().min(1).max(240).optional(),
  secret_access_key: z.string().min(1).max(10000).optional(),
  extra_config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

function assertRequiredProviderAccountId(
  provider: StorageAccount['provider'],
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const accountId = Number(id);
    if (!Number.isInteger(accountId)) {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid account id');
    }
    const payload = await parseJson(request, updateSchema);
    const existing = await getStorageAccountForUser(user.id, accountId);
    const providerAccountId =
      payload.provider_account_id !== undefined
        ? optionalStorageString(payload.provider_account_id)
        : existing.providerAccountId;
    const region =
      payload.region !== undefined
        ? storageRegionOrDefault(existing.provider, payload.region)
        : existing.region;
    const endpoint =
      payload.endpoint !== undefined
        ? (optionalStorageString(payload.endpoint) ??
          defaultStorageEndpoint({
            provider: existing.provider,
            region,
            accountId: providerAccountId,
          }))
        : payload.region !== undefined ||
            payload.provider_account_id !== undefined
          ? (defaultStorageEndpoint({
              provider: existing.provider,
              region,
              accountId: providerAccountId,
            }) ?? existing.endpoint)
          : undefined;
    const secret = payload.secret_access_key
      ? encryptedSecret(payload.secret_access_key)
      : null;

    assertRequiredProviderAccountId(existing.provider, providerAccountId);

    let updated: StorageAccount | undefined;
    try {
      [updated] = await db
        .update(storageAccounts)
        .set({
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.provider_account_id !== undefined
            ? { providerAccountId }
            : {}),
          ...(payload.region !== undefined ? { region } : {}),
          ...(endpoint !== undefined ? { endpoint } : {}),
          ...(payload.namespace !== undefined
            ? { namespace: payload.namespace }
            : {}),
          ...(payload.compartment_id !== undefined
            ? { compartmentId: payload.compartment_id }
            : {}),
          ...(payload.access_key_id !== undefined
            ? { accessKeyId: payload.access_key_id }
            : {}),
          ...(payload.extra_config !== undefined
            ? { extraConfig: JSON.stringify(payload.extra_config) }
            : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
          ...(secret
            ? {
                secretKeyCiphertext: secret.secretKeyCiphertext,
                credentialHint: secret.credentialHint,
                credentialsUpdatedAt: secret.credentialsUpdatedAt,
              }
            : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(storageAccounts.id, existing.id))
        .returning();
    } catch (error) {
      throwStorageAccountConflict(error);
    }

    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'Storage account not found');
    }

    return ok({ account: publicStorageAccount(updated) });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const accountId = Number(id);
    if (!Number.isInteger(accountId)) {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid account id');
    }

    await db
      .delete(storageAccounts)
      .where(
        and(
          eq(storageAccounts.id, accountId),
          eq(storageAccounts.userId, user.id),
        ),
      );

    return ok({ deleted: true });
  });
}
