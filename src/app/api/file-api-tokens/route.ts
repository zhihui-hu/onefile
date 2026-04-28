import { ok, parseJson, withApiHandler } from '@/lib/api/response';
import {
  createRawApiToken,
  publicApiToken,
  serializeScopes,
} from '@/lib/auth/api-tokens';
import { requireUser } from '@/lib/auth/session';
import { sha256 } from '@/lib/crypto';
import { db } from '@/lib/db/client';
import { fileApiTokens } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

const scopeSchema = z.enum([
  'files:read',
  'files:write',
  'files:delete',
  'uploads:write',
]);

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
  scopes: z.array(scopeSchema).min(1),
  expires_at: z.string().datetime().nullable().optional(),
});

export async function GET() {
  return withApiHandler(async () => {
    const user = await requireUser();
    const tokens = await db
      .select()
      .from(fileApiTokens)
      .where(eq(fileApiTokens.userId, user.id))
      .orderBy(desc(fileApiTokens.createdAt));

    return ok({ items: tokens.map(publicApiToken) });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const user = await requireUser();
    const payload = await parseJson(request, createSchema);
    const token = createRawApiToken();
    const now = new Date().toISOString();

    const [created] = await db
      .insert(fileApiTokens)
      .values({
        userId: user.id,
        name: payload.name,
        tokenPrefix: token.tokenPrefix,
        tokenHash: sha256(token.rawToken),
        description: payload.description ?? null,
        scopes: serializeScopes(payload.scopes),
        expiresAt: payload.expires_at ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return ok({ token: publicApiToken(created), raw_token: token.rawToken });
  });
}
