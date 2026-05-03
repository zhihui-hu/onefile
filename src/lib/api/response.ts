import { debugError, debugLog } from '@/lib/debug';
import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';

export const API_ERROR_DEFINITIONS = {
  BAD_REQUEST: { code: 4000 },
  UNAUTHORIZED: { code: 4010 },
  FORBIDDEN: { code: 4030 },
  NOT_FOUND: { code: 4040 },
  CONFLICT: { code: 4090 },
  UPLOAD_EXPIRED: { code: 4100 },
  VALIDATION_ERROR: { code: 4220 },
  PROVIDER_ERROR: { code: 4600 },
  INTERNAL_ERROR: { code: 5000 },
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_DEFINITIONS;

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
  const definition = API_ERROR_DEFINITIONS[code];
  return NextResponse.json(
    {
      data: null,
      error: {
        code: definition.code,
        type: code,
        message,
        details: details ?? null,
      },
    },
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

type ApiHandlerDebugOptions = {
  label?: string;
  request?: Request;
  meta?: Record<string, unknown>;
};

function requestDebugMeta(request?: Request) {
  if (!request) {
    return {};
  }

  try {
    const url = new URL(request.url);
    return {
      method: request.method,
      pathname: url.pathname,
      search: url.search,
    };
  } catch {
    return { method: request.method, url: request.url };
  }
}

export async function withApiHandler<T>(
  handler: () => Promise<T>,
  debugOptions: ApiHandlerDebugOptions = {},
) {
  const startedAt = Date.now();
  const debugMeta = {
    label: debugOptions.label,
    ...requestDebugMeta(debugOptions.request),
    ...debugOptions.meta,
  };

  if (debugOptions.label) {
    debugLog('api:start', debugMeta);
  }

  try {
    const response = await handler();
    if (debugOptions.label) {
      debugLog('api:end', {
        ...debugMeta,
        duration_ms: Date.now() - startedAt,
        status: response instanceof Response ? response.status : undefined,
      });
    }
    return response;
  } catch (error) {
    if (debugOptions.label) {
      debugError('api:error', {
        ...debugMeta,
        duration_ms: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }

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
