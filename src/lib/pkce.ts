import crypto from 'node:crypto';

// ── PKCE (Proof Key for Code Exchange) ───────────────────────
// RFC 7636 — wajib untuk public clients agar aman dari code injection.

/**
 * Generate cryptographically random code verifier.
 * Panjang: 43-128 karakter (disarankan 64+).
 * Format: Base64URL (tanpa padding, +/= diganti).
 */
export function generateCodeVerifier(): string {
  return crypto
    .randomBytes(64)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Derive code challenge dari code verifier menggunakan SHA-256.
 * Google & GitHub keduanya support S256 method.
 */
export function generateCodeChallenge(codeVerifier: string): string {
  return crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate random state string untuk CSRF protection.
 * State dikirim ke provider dan dikembalikan di callback — harus cocok.
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex');
}
