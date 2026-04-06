import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '@/config/env';
import { PASSWORD_POLICY } from '@/config/constants';

// ── SHA-256 Hashing ───────────────────────────────────────────
// Digunakan untuk: token storage (verification_tokens, refresh_tokens)
// Token asli dikirim ke user, hash-nya disimpan di DB.
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Secure Random Token Generator ────────────────────────────
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

// ── URL-Safe Token untuk link di email ───────────────────────
export function generateUrlSafeToken(bytes = 32): string {
  return crypto
    .randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ── Backup Code Generator ────────────────────────────────────
// Format: XXXXX-XXXXX (5 hex + 5 hex, mudah dibaca user)
export function generateBackupCode(): string {
  const part1 = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  const part2 = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  return `${part1.slice(0, 5)}-${part2.slice(0, 5)}`;
}

export function generateBackupCodes(count: number): string[] {
  return Array.from({ length: count }, () => generateBackupCode());
}

// ── Password Hashing (bcrypt) ────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_POLICY.BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── AES-256-GCM Encryption ───────────────────────────────────
// Digunakan untuk: provider_access_token, TOTP secrets di DB.
// IV di-generate baru setiap enkripsi → ciphertext selalu berbeda
// meskipun plaintext sama.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV, recommended untuk GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

function getEncryptionKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv(12) + authTag(16) + ciphertext — semua di-encode ke hex
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, 'hex');

  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final('utf8');
}

// ── Timing-Safe Comparison ────────────────────────────────────
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Tetap lakukan operasi untuk menghindari timing attack
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ── Client Secret Generator ───────────────────────────────────
export function generateClientId(): string {
  return 'ci_' + crypto.randomBytes(16).toString('hex');
}

export function generateClientSecret(): string {
  return 'cs_' + crypto.randomBytes(32).toString('hex');
}

// ── MFA Token Hasher ─────────────────────────────────────────
// Temporary MFA token yang dikirim ke client setelah login berhasil
// tapi MFA belum diverifikasi.
export function generateMfaToken(): string {
  return 'mfa_' + crypto.randomBytes(24).toString('hex');
}
