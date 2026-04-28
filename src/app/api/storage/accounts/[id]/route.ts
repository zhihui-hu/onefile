import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { storageAccounts } from '@/lib/db/schema';
import { encryptedSecret, publicStorageAccount } from '@/lib/storage-config';
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
  secret_access_key: z.string().min(1).max(2000).optional(),
  extra_config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

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
    const secret = payload.secret_access_key
      ? encryptedSecret(payload.secret_access_key)
      : null;

    const [updated] = await db
      .update(storageAccounts)
      .set({
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.provider_account_id !== undefined
          ? { providerAccountId: payload.provider_account_id }
          : {}),
        ...(payload.region !== undefined ? { region: payload.region } : {}),
        ...(payload.endpoint !== undefined
          ? { endpoint: payload.endpoint }
          : {}),
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
      .where(
        and(
          eq(storageAccounts.id, accountId),
          eq(storageAccounts.userId, user.id),
        ),
      )
      .returning();

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
