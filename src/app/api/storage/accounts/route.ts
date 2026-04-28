import { ok, parseJson, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { storageAccounts } from '@/lib/db/schema';
import { encryptedSecret, publicStorageAccount } from '@/lib/storage-config';
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
  secret_access_key: z.string().min(1).max(2000),
  extra_config: z.record(z.string(), z.unknown()).optional(),
});

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
    const now = new Date().toISOString();
    const secret = encryptedSecret(payload.secret_access_key);

    const [account] = await db
      .insert(storageAccounts)
      .values({
        userId: user.id,
        name: payload.name,
        provider: payload.provider,
        providerAccountId: payload.provider_account_id ?? null,
        region: payload.region ?? null,
        endpoint: payload.endpoint ?? null,
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

    return ok({ account: publicStorageAccount(account) });
  });
}
