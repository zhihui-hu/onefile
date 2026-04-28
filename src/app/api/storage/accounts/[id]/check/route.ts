import { HttpError, ok, withApiHandler } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { storageAccounts } from '@/lib/db/schema';
import {
  adapterFromAccount,
  getStorageAccountForUser,
  publicStorageAccount,
} from '@/lib/storage-config';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function POST(
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

    const account = await getStorageAccountForUser(user.id, accountId);
    const result = await adapterFromAccount(account).checkCredentials();
    const now = new Date().toISOString();

    const [updated] = await db
      .update(storageAccounts)
      .set({
        status: result.ok ? 'active' : 'error',
        lastCheckedAt: now,
        lastError: result.ok ? null : (result.error?.message ?? 'Check failed'),
        updatedAt: now,
      })
      .where(eq(storageAccounts.id, account.id))
      .returning();

    return ok({ account: publicStorageAccount(updated), check: result });
  });
}
