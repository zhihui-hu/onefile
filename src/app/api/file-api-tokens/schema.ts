import { HttpError, ok } from '@/lib/api/response';
import { API_TOKEN_SCOPES, type ApiTokenScope } from '@/lib/auth/api-tokens';
import { z } from 'zod';

const scopeSchema = z.enum(API_TOKEN_SCOPES);

const nullableTrimmedString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() || null : value),
    z.string().max(max).nullable().optional(),
  );

const expiresAtSchema = z
  .string()
  .datetime()
  .nullable()
  .optional()
  .refine((value) => !value || Date.parse(value) > Date.now(), {
    message: 'expires_at must be a future datetime',
  });

const scopesSchema = z
  .array(scopeSchema)
  .min(1)
  .transform((scopes) => Array.from(new Set(scopes)) as ApiTokenScope[]);

export const createFileApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: nullableTrimmedString(500),
  scopes: scopesSchema,
  expires_at: expiresAtSchema,
});

export const updateFileApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: nullableTrimmedString(500),
  scopes: scopesSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
  expires_at: expiresAtSchema,
});

export type UpdateFileApiTokenInput = z.infer<typeof updateFileApiTokenSchema>;

export function parseFileApiTokenId(id: string) {
  const tokenId = Number(id);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'Invalid token id');
  }
  return tokenId;
}

export function assertHasTokenUpdate(payload: UpdateFileApiTokenInput) {
  if (Object.values(payload).every((value) => value === undefined)) {
    throw new HttpError(400, 'BAD_REQUEST', 'No token fields to update');
  }
}

export function noStoreOk<T>(data: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return ok(data, { ...init, headers });
}
