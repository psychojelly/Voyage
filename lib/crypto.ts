import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a string produced by `encrypt()`.
 * Throws on invalid input or tampered data.
 */
export function decrypt(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Try to decrypt a value, returning null instead of throwing.
 * Useful for backwards compatibility with pre-migration plaintext values.
 */
export function tryDecrypt(value: string): string | null {
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

/**
 * HMAC-SHA256 hash of a value using the ENCRYPTION_KEY.
 * Returns hex-encoded hash.
 */
export function hmacHash(value: string): string {
  const key = getKey();
  return createHmac('sha256', key).update(value).digest('hex');
}

/**
 * Encrypt a value as JSON. Returns the encrypted string, or undefined if falsy.
 * Stored in Prisma Json columns as a string value.
 */
export function encryptJson(value: unknown): string | undefined {
  if (!value) return undefined;
  return encrypt(JSON.stringify(value));
}

/**
 * Decrypt a field that may be:
 * - null/undefined → returns undefined
 * - an object → pre-migration unencrypted data, returned as-is
 * - a string → encrypted data, decrypted + JSON.parsed
 *
 * Backwards-compatible: handles both encrypted and unencrypted data.
 */
export function decryptJsonField<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;

  // Pre-migration unencrypted data stored as a JSON object
  if (typeof value === 'object') return value as T;

  // Encrypted string
  if (typeof value === 'string') {
    try {
      const decrypted = decrypt(value);
      return JSON.parse(decrypted) as T;
    } catch {
      // Edge case: maybe a plain JSON string that wasn't encrypted
      try {
        return JSON.parse(value) as T;
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}
