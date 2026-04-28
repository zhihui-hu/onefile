import { randomToken } from '@/lib/crypto';
import { format } from 'date-fns';
import path from 'node:path';

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const SLASHES = /\/+/g;

export interface BuildObjectKeyOptions {
  filename: string;
  currentPrefix?: string | null;
  relativePath?: string | null;
  explicitObjectKey?: string | null;
  defaultDatePrefix?: boolean;
}

function normalizeSegments(input: string) {
  const normalized = input
    .replace(/\\/g, '/')
    .replace(CONTROL_CHARS, '')
    .replace(SLASHES, '/')
    .trim();

  const segments = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (
    normalized.startsWith('/') ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('Invalid object path');
  }

  return segments;
}

function sanitizeFilename(filename: string) {
  const cleaned = filename
    .replace(CONTROL_CHARS, '')
    .replace(/\\/g, '/')
    .trim();
  const basename = path.posix.basename(cleaned);
  if (!basename || basename === '.' || basename === '..') {
    throw new Error('Invalid filename');
  }
  return basename;
}

export function sanitizePrefix(prefix: string | null | undefined) {
  if (!prefix) {
    return '';
  }
  const segments = normalizeSegments(prefix);
  return segments.length > 0 ? `${segments.join('/')}/` : '';
}

export function buildObjectKey(options: BuildObjectKeyOptions) {
  if (options.explicitObjectKey) {
    const explicitSegments = normalizeSegments(options.explicitObjectKey);
    if (explicitSegments.length === 0) {
      throw new Error('Object key cannot be empty');
    }
    return explicitSegments.join('/');
  }

  const segments: string[] = [];
  const currentPrefix = sanitizePrefix(options.currentPrefix);
  if (currentPrefix) {
    segments.push(...currentPrefix.split('/').filter(Boolean));
  }

  if (options.defaultDatePrefix) {
    segments.push(...format(new Date(), 'yyyy/MM/dd').split('/'));
  }

  if (options.relativePath) {
    const relativeSegments = normalizeSegments(options.relativePath);
    if (relativeSegments.length > 1) {
      segments.push(...relativeSegments.slice(0, -1));
    }
  }

  segments.push(sanitizeFilename(options.filename));
  return segments.join('/');
}

export function withConflictPrefix(objectKey: string) {
  const segments = objectKey.split('/');
  const filename = segments.pop();
  if (!filename) {
    throw new Error('Object key cannot be empty');
  }
  const prefix = format(new Date(), 'yyyyMMddHHmmss');
  const shortId = randomToken(4);
  segments.push(`${prefix}-${shortId}-${filename}`);
  return segments.join('/');
}

export async function avoidObjectKeyConflict(
  objectKey: string,
  exists: (key: string) => Promise<boolean>,
) {
  if (!(await exists(objectKey))) {
    return objectKey;
  }

  let candidate = withConflictPrefix(objectKey);
  while (await exists(candidate)) {
    candidate = withConflictPrefix(objectKey);
  }
  return candidate;
}
