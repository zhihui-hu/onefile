import type {
  FileApiKey,
  FileApiKeyPayload,
} from '@/app/(main)/components/types';

export type KeyForm = {
  name: string;
  bucket_id: string;
  compress_images: boolean;
};

const uploadScopes = [
  'files:read',
  'files:write',
  'uploads:write',
  'files:delete',
] satisfies string[];

export const emptyForm: KeyForm = {
  name: '',
  bucket_id: '',
  compress_images: false,
};

export function formFromKey(apiKey: FileApiKey): KeyForm {
  return {
    name: apiKey.name,
    bucket_id: apiKey.bucket_id ? String(apiKey.bucket_id) : '',
    compress_images: apiKey.compress_images === true,
  };
}

export function keyPayload(form: KeyForm): FileApiKeyPayload {
  return {
    name: form.name.trim(),
    bucket_id: form.bucket_id || null,
    compress_images: form.compress_images,
  };
}

export function createKeyPayload(form: KeyForm): FileApiKeyPayload {
  return {
    ...keyPayload(form),
    scopes: uploadScopes,
    expires_at: null,
  };
}

export function publicLink(apiKey: FileApiKey) {
  if (apiKey.public_upload_url) return apiKey.public_upload_url;
  if (apiKey.public_upload_uuid && typeof window !== 'undefined') {
    return `${window.location.origin}/${apiKey.public_upload_uuid}`;
  }
  return '';
}

export function keyToken(apiKey: FileApiKey) {
  return apiKey.key || apiKey.raw_key || apiKey.plain_key || '';
}

export function tokenDisplay(apiKey: FileApiKey) {
  return keyToken(apiKey) || apiKey.key_prefix || 'ofk_****';
}

export function apiDocsUrl(apiKey: FileApiKey) {
  const token = keyToken(apiKey);
  return token ? `/api-docs?key=${encodeURIComponent(token)}` : '/api-docs';
}
