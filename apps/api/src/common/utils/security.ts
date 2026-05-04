import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const maxPasswordBytes = 1024;
const saltByteLength = 16;
const derivedKeyLength = 64;

function isPasswordWithinBounds(password: string) {
  return typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= maxPasswordBytes;
}

function isHex(value: string) {
  return /^[a-f0-9]+$/i.test(value) && value.length % 2 === 0;
}

export async function hashPassword(password: string): Promise<string> {
  if (!isPasswordWithinBounds(password)) {
    throw new Error('PASSWORD_TOO_LARGE');
  }

  const salt = randomBytes(saltByteLength).toString('hex');
  const derivedKey = (await scrypt(password, salt, derivedKeyLength)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (!isPasswordWithinBounds(password) || typeof encoded !== 'string' || encoded.length > 512) {
    return false;
  }

  const parts = encoded.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [salt, storedHash] = parts;
  if (!salt || !storedHash || !isHex(salt) || !isHex(storedHash)) {
    return false;
  }

  const stored = Buffer.from(storedHash, 'hex');
  if (stored.length !== derivedKeyLength || Buffer.from(salt, 'hex').length !== saltByteLength) {
    return false;
  }

  try {
    const derivedKey = (await scrypt(password, salt, derivedKeyLength)) as Buffer;
    return stored.length === derivedKey.length && timingSafeEqual(stored, derivedKey);
  } catch {
    return false;
  }
}
