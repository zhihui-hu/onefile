export function normalizePrefix(prefix: string) {
  const cleaned = prefix
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');

  if (!cleaned) return '';
  return cleaned.endsWith('/') ? cleaned : `${cleaned}/`;
}

function cleanRelativePath(path: string) {
  const segments = path
    .replaceAll('\\', '/')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== '.' && segment !== '..');

  return segments.join('/');
}

export function joinObjectKey(prefix: string, relativePath: string) {
  const safePrefix = normalizePrefix(prefix);
  const safePath = cleanRelativePath(relativePath);

  if (!safePath) return safePrefix.replace(/\/$/, '');
  return `${safePrefix}${safePath}`;
}

export function parentPrefix(prefix: string) {
  const normalized = normalizePrefix(prefix);
  if (!normalized) return '';

  const segments = normalized.split('/').filter(Boolean);
  segments.pop();
  return segments.length ? `${segments.join('/')}/` : '';
}

export function buildAddress(bucketName: string, prefix: string) {
  return `${bucketName}:/${normalizePrefix(prefix)}`;
}

export function parseAddress(value: string, bucketName: string) {
  const trimmed = value.trim();
  const bucketPrefix = `${bucketName}:/`;

  if (!trimmed || trimmed === bucketName || trimmed === bucketPrefix) {
    return '';
  }

  if (trimmed.startsWith(bucketPrefix)) {
    return normalizePrefix(trimmed.slice(bucketPrefix.length));
  }

  return normalizePrefix(trimmed);
}
