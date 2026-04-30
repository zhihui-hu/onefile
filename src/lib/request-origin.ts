import { getEnv } from '@/lib/env';

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || undefined;
}

function forwardedValue(headers: Headers, key: string) {
  const forwarded = headers.get('forwarded');
  if (!forwarded) {
    return undefined;
  }

  const first = forwarded.split(',')[0];
  for (const part of first.split(';')) {
    const [name, rawValue] = part.split('=');
    if (name?.trim().toLowerCase() === key) {
      return rawValue?.trim().replace(/^"|"$/g, '') || undefined;
    }
  }

  return undefined;
}

function normalizeOrigin(origin: string) {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
}

function fallbackUrl(origin: string) {
  try {
    return new URL(origin);
  } catch {
    return new URL('http://localhost:27507');
  }
}

function forwardedProtocol(headers: Headers) {
  return (
    firstHeaderValue(headers.get('x-forwarded-proto')) ??
    forwardedValue(headers, 'proto')
  );
}

export function requestOrigin(
  headers: Headers,
  fallbackOrigin = 'http://localhost:27507',
) {
  const configuredOrigin = getEnv().appOrigin;
  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin);
  }

  const fallback = fallbackUrl(fallbackOrigin);
  const host =
    firstHeaderValue(headers.get('x-forwarded-host')) ??
    forwardedValue(headers, 'host') ??
    headers.get('host') ??
    fallback.host;
  const protocol = forwardedProtocol(headers) ?? fallback.protocol.slice(0, -1);

  return `${protocol}://${host}`;
}

export function secureCookiesForRequest(headers: Headers) {
  const configuredOrigin = getEnv().appOrigin;
  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin).startsWith('https://');
  }

  return forwardedProtocol(headers) === 'https';
}
