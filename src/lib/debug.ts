const DEBUG_PREFIX = '[onefile-debug]';
const DEBUG_STORAGE_KEY = 'onefile:debug';

const counters = new Map<string, number>();

function debugEnvValue() {
  return process.env.NEXT_PUBLIC_ONEFILE_DEBUG?.toLowerCase();
}

function isExplicitFalse(value: string | null | undefined) {
  return value === '0' || value === 'false' || value === 'off';
}

function isExplicitTrue(value: string | null | undefined) {
  return value === '1' || value === 'true' || value === 'on';
}

function isOneFileDebugEnabled() {
  const envValue = debugEnvValue();
  if (isExplicitTrue(envValue)) return true;
  if (isExplicitFalse(envValue)) return false;

  if (typeof window !== 'undefined') {
    try {
      const storedValue = window.localStorage.getItem(DEBUG_STORAGE_KEY);
      if (isExplicitTrue(storedValue)) return true;
      if (isExplicitFalse(storedValue)) return false;
    } catch {
      // Ignore localStorage failures in private mode or restricted contexts.
    }
  }

  return process.env.NODE_ENV === 'development';
}

function debugPayload(data: unknown) {
  if (data instanceof Error) {
    return { name: data.name, message: data.message, stack: data.stack };
  }
  return data;
}

export function debugLog(label: string, data?: unknown) {
  if (!isOneFileDebugEnabled()) return;

  if (data === undefined) {
    console.log(DEBUG_PREFIX, label);
    return;
  }

  console.log(DEBUG_PREFIX, label, debugPayload(data));
}

export function debugError(label: string, data?: unknown) {
  if (!isOneFileDebugEnabled()) return;
  console.error(DEBUG_PREFIX, label, debugPayload(data));
}

export function debugLogLimited(
  label: string,
  data?: unknown,
  options: { first?: number; every?: number } = {},
) {
  if (!isOneFileDebugEnabled()) return;

  const count = (counters.get(label) ?? 0) + 1;
  counters.set(label, count);

  const first = options.first ?? 20;
  const every = options.every ?? 50;
  if (count > first && (every <= 0 || count % every !== 0)) {
    return;
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    debugLog(label, { count, ...data });
    return;
  }

  debugLog(label, { count, data });
}

export function errorDebugData(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}
