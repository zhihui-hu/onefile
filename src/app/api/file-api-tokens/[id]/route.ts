import { HttpError, ok, parseJson, withApiHandler } from '@/lib/api/response';
import { publicApiToken, serializeScopes } from '@/lib/auth/api-tokens';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { fileApiTokens } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

const scopeSchema = z.enum([
  'files:read',
  'files:write',
  'files:delete',
  'uploads:write',
]);

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  scopes: z.array(scopeSchema).min(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const payload = await parseJson(request, updateSchema);
    const tokenId = Number(id);
    if (!Number.isInteger(tokenId)) {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid token id');
    }

    const [updated] = await db
      .update(fileApiTokens)
      .set({
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description }
          : {}),
        ...(payload.scopes !== undefined
          ? { scopes: serializeScopes(payload.scopes) }
          : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.expires_at !== undefined
          ? { expiresAt: payload.expires_at }
          : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(eq(fileApiTokens.id, tokenId), eq(fileApiTokens.userId, user.id)),
      )
      .returning();

    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'API token not found');
    }

    return ok({ token: publicApiToken(updated) });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const tokenId = Number(id);
    if (!Number.isInteger(tokenId)) {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid token id');
    }

    await db
      .delete(fileApiTokens)
      .where(
        and(eq(fileApiTokens.id, tokenId), eq(fileApiTokens.userId, user.id)),
      );

    return ok({ deleted: true });
  });
}
