import { formatBytes } from '@/app/(main)/components/format';
import type { PublicUploadResult } from '@/app/(main)/components/types';

import type { StoredUpload } from './types';

export const HISTORY_LIMIT = 80;
export const IMAGE_BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';

function storageKey(uuid: string) {
  return `onefile:public-upload:${uuid}:uploads:v1`;
}

function isStoredUpload(value: unknown): value is StoredUpload {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StoredUpload>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.url === 'string' &&
    typeof item.uploadedAt === 'string'
  );
}

export function readUploadHistory(uuid: string) {
  try {
    const raw = window.localStorage.getItem(storageKey(uuid));
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredUpload) : [];
  } catch {
    return [];
  }
}

export function writeUploadHistory(uuid: string, uploads: StoredUpload[]) {
  window.localStorage.setItem(
    storageKey(uuid),
    JSON.stringify(uploads.slice(0, HISTORY_LIMIT)),
  );
}

function toAbsoluteUrl(value?: string | null) {
  if (!value) return '';
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}

function resultUrl(result: PublicUploadResult) {
  return toAbsoluteUrl(result.url || result.location);
}

export function storedUploadFromResult(
  result: PublicUploadResult,
  file: File,
): StoredUpload {
  const url = resultUrl(result);
  const objectKey = result.object_key || result.original_filename || file.name;

  return {
    id: result.id || result.upload_id || crypto.randomUUID(),
    name: result.original_filename || file.name,
    bucketName: result.bucket_name,
    objectKey,
    mimeType: result.mime_type || result.original_mime_type || file.type,
    size: result.file_size ?? file.size,
    originalSize: result.original_file_size ?? file.size,
    compressed: result.compressed,
    url,
    uploadedAt: new Date().toISOString(),
  };
}

export function uploadSubtitle(upload: StoredUpload) {
  const parts = [
    upload.bucketName,
    upload.objectKey,
    upload.mimeType,
    formatBytes(upload.size),
  ].filter(Boolean);

  return parts.join(' · ');
}

export function filesFromFileList(files?: FileList | null) {
  return files ? Array.from(files) : [];
}

export function filesFromDataTransfer(dataTransfer: DataTransfer) {
  const itemFiles = Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((item): item is File => Boolean(item));

  return itemFiles.length > 0
    ? itemFiles
    : filesFromFileList(dataTransfer.files);
}

export function filesFromClipboard(dataTransfer: DataTransfer | null) {
  return dataTransfer ? filesFromDataTransfer(dataTransfer) : [];
}

export function hasFileTransfer(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes('Files');
}

export function markdownImage(upload: StoredUpload) {
  const alt = upload.name.replace(/[\n\r[\]]+/g, ' ').trim() || 'image';
  return `![${alt}](${upload.url})`;
}

export function bbcodeImage(upload: StoredUpload) {
  return `[img]${upload.url}[/img]`;
}
