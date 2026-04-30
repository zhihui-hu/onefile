import sharp from 'sharp';

const COMPRESSIBLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/heic',
  'image/heif',
]);

const COMPRESSIBLE_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
]);

export const WEBP_MIME_TYPE = 'image/webp';

function extensionIndex(filename: string) {
  const slashIndex = filename.lastIndexOf('/');
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex > slashIndex + 1 ? dotIndex : -1;
}

export function isCompressibleImage(mimeType: string, filename: string) {
  const normalizedMimeType = mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
  if (COMPRESSIBLE_IMAGE_TYPES.has(normalizedMimeType)) {
    return true;
  }

  const dotIndex = extensionIndex(filename);
  if (dotIndex < 0) {
    return false;
  }

  return COMPRESSIBLE_IMAGE_EXTENSIONS.has(
    filename.slice(dotIndex).toLowerCase(),
  );
}

export function webpFilename(filename: string) {
  const dotIndex = extensionIndex(filename);
  return dotIndex >= 0
    ? `${filename.slice(0, dotIndex)}.webp`
    : `${filename}.webp`;
}

export async function compressImageToWebp(input: Buffer) {
  return sharp(input, { animated: true, failOn: 'none' })
    .rotate()
    .webp({
      quality: 82,
      effort: 4,
      smartSubsample: true,
      mixed: true,
    })
    .toBuffer();
}
