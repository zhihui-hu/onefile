import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR';

export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data, error: null }, init);
}

export function fail(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    { data: null, error: { code, message, details: details ?? null } },
    { status },
  );
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', 'Request body must be valid JSON');
  }
  return schema.parse(payload);
}

export async function withApiHandler<T>(handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof HttpError) {
      return fail(error.status, error.code, error.message, error.details);
    }
    if (error instanceof ZodError) {
      return fail(
        422,
        'VALIDATION_ERROR',
        'Request validation failed',
        error.flatten(),
      );
    }
    const message =
      error instanceof Error ? error.message : 'Unexpected server error';
    return fail(500, 'INTERNAL_ERROR', message);
  }
}

export function page<T>(
  items: T[],
  pageNum: number,
  pageSize: number,
  total?: number,
) {
  return {
    items,
    page: {
      page_num: pageNum,
      page_size: pageSize,
      total: total ?? items.length,
    },
  };
}
