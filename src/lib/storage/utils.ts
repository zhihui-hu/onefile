import type { StorageAdapterConfig, StorageErrorInfo } from './types';

const MAX_LIST_LIMIT = 1000;

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

export function normalizeOptionalString(
  value?: string | null,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getExtraString(
  config: StorageAdapterConfig,
  key: string,
): string | undefined {
  const value = config.extraConfig?.[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function getExtraBoolean(
  config: StorageAdapterConfig,
  key: string,
): boolean | undefined {
  const value = config.extraConfig?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function getExtraNumber(
  config: StorageAdapterConfig,
  key: string,
): number | undefined {
  const value = config.extraConfig?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function normalizePrefix(prefix?: string): string | undefined {
  if (!prefix) {
    return undefined;
  }

  const normalized = prefix.replace(/^\/+/, '');
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeObjectKey(key: string): string {
  return key.replace(/^\/+/, '');
}

export function normalizeDelimiter(delimiter?: string): string | undefined {
  if (delimiter === '') {
    return undefined;
  }

  return delimiter ?? '/';
}

export function normalizeListLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return MAX_LIST_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}

export function basenameFromObjectPath(path: string): string {
  const withoutTrailingSlash = path.endsWith('/') ? path.slice(0, -1) : path;
  const slashIndex = withoutTrailingSlash.lastIndexOf('/');
  return slashIndex >= 0
    ? withoutTrailingSlash.slice(slashIndex + 1)
    : withoutTrailingSlash;
}

export function dateFromUnknown(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

export function numberFromUnknown(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function normalizeErrorInfo(error: unknown): StorageErrorInfo {
  if (error instanceof Error) {
    const record = error as Error & UnknownRecord;
    return {
      code: stringFromUnknown(record.Code ?? record.code ?? record.name),
      message: error.message,
      statusCode: numberFromUnknown(
        record.$metadata && isRecord(record.$metadata)
          ? record.$metadata.httpStatusCode
          : (record.statusCode ?? record.status),
      ),
    };
  }

  if (isRecord(error)) {
    return {
      code: stringFromUnknown(error.Code ?? error.code ?? error.name),
      message:
        stringFromUnknown(error.message ?? error.error) ?? 'Unknown error',
      statusCode: numberFromUnknown(error.statusCode ?? error.status),
    };
  }

  return {
    message: String(error),
  };
}

export function metadataFromHeaders(
  headers: Record<string, unknown>,
  prefix: string,
): Record<string, string> | undefined {
  const metadata: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (!key.toLowerCase().startsWith(prefix)) {
      continue;
    }

    const stringValue = stringFromUnknown(value);
    if (stringValue !== undefined) {
      metadata[key.slice(prefix.length)] = stringValue;
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function stringFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}
