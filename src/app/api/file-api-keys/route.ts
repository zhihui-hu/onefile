import { HttpError, parseJson, withApiHandler } from '@/lib/api/response';
import {
  createRawApiKey,
  publicApiKey,
  serializeScopes,
} from '@/lib/auth/api-keys';
import { requireUser } from '@/lib/auth/session';
import { sha256 } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import { fileApiKeys } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

import { createFileApiKeySchema, noStoreOk } from './schema';

export const runtime = 'nodejs';

function isSqliteConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    String(error.code) === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export async function GET() {
  return withApiHandler(async () => {
    const user = await requireUser();
    const keys = await db
      .select()
      .from(fileApiKeys)
      .where(eq(fileApiKeys.userId, user.id))
      .orderBy(desc(fileApiKeys.createdAt));

    return noStoreOk({ items: keys.map(publicApiKey) });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const payload = await parseJson(request, createFileApiKeySchema);
    const apiKey = createRawApiKey();
    const now = new Date().toISOString();

    let created: typeof fileApiKeys.$inferSelect;
    try {
      [created] = await db
        .insert(fileApiKeys)
        .values({
          userId: user.id,
          name: payload.name,
          tokenPrefix: apiKey.keyPrefix,
          tokenHash: sha256(apiKey.rawKey),
          description: payload.description ?? null,
          scopes: serializeScopes(payload.scopes),
          expiresAt: payload.expires_at ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    } catch (error) {
      if (isSqliteConstraintError(error)) {
        throw new HttpError(
          409,
          'CONFLICT',
          'API key already exists, please retry',
        );
      }
      throw error;
    }

    const publicKey = publicApiKey(created);
    return noStoreOk(
      {
        key: publicKey,
        raw_key: apiKey.rawKey,
      },
      { status: 201 },
    );
  });
}
