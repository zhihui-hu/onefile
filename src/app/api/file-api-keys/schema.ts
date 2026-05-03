import { HttpError, ok } from '@/lib/api/response';
import { API_KEY_SCOPES, type ApiKeyScope } from '@/lib/auth/api-keys';
import { z } from 'zod';

const scopeSchema = z.enum(API_KEY_SCOPES);

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
  .transform((scopes) => Array.from(new Set(scopes)) as ApiKeyScope[]);

const bucketIdSchema = z.preprocess((value) => {
  if (value === '' || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return Number(value);
  }
  return value;
}, z.number().int().positive().nullable().optional());

export const createFileApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: nullableTrimmedString(500),
  scopes: scopesSchema,
  bucket_id: bucketIdSchema,
  compress_images: z.boolean().optional().default(false),
  expires_at: expiresAtSchema,
});

export const updateFileApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: nullableTrimmedString(500),
  scopes: scopesSchema.optional(),
  bucket_id: bucketIdSchema,
  compress_images: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  expires_at: expiresAtSchema,
  public_upload: z.enum(['revoke', 'regenerate']).optional(),
});

type UpdateFileApiKeyInput = z.infer<typeof updateFileApiKeySchema>;

export function parseFileApiKeyId(id: string) {
  const keyId = Number(id);
  if (!Number.isInteger(keyId) || keyId <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'Invalid key id');
  }
  return keyId;
}

export function assertHasKeyUpdate(payload: UpdateFileApiKeyInput) {
  if (Object.values(payload).every((value) => value === undefined)) {
    throw new HttpError(400, 'BAD_REQUEST', 'No key fields to update');
  }
}

export function noStoreOk<T>(data: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return ok(data, { ...init, headers });
}
