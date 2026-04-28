import { getEnv } from '@/lib/env';
import crypto from 'node:crypto';

const TEXT_ENCODER = new TextEncoder();

function keyFromSecret(secret: string, salt: string) {
  return crypto.scryptSync(secret, salt, 32);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function timingSafeEqualString(left: string, right: string) {
  const leftBytes = TEXT_ENCODER.encode(left);
  const rightBytes = TEXT_ENCODER.encode(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBytes, rightBytes);
}

export function encryptText(plainText: string) {
  const iv = crypto.randomBytes(12);
  const key = keyFromSecret(
    getEnv().storageCredentialEncryptionKey,
    'onefile-storage-credentials',
  );
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptText(cipherText: string) {
  const [version, ivText, authTagText, encryptedText] = cipherText.split('.');
  if (version !== 'v1' || !ivText || !authTagText || !encryptedText) {
    throw new Error('Unsupported ciphertext format');
  }

  const key = keyFromSecret(
    getEnv().storageCredentialEncryptionKey,
    'onefile-storage-credentials',
  );
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivText, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagText, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function signValue(value: string) {
  return crypto
    .createHmac('sha256', getEnv().sessionSecret)
    .update(value)
    .digest('base64url');
}

export function encodeSignedValue(value: string) {
  return `${value}.${signValue(value)}`;
}

export function decodeSignedValue(signedValue: string) {
  const index = signedValue.lastIndexOf('.');
  if (index < 1) {
    return null;
  }
  const value = signedValue.slice(0, index);
  const signature = signedValue.slice(index + 1);
  return timingSafeEqualString(signValue(value), signature) ? value : null;
}
