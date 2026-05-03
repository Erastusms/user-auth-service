/**
 * Generate cryptographically random code verifier.
 * Panjang: 43-128 karakter (disarankan 64+).
 * Format: Base64URL (tanpa padding, +/= diganti).
 */
export declare function generateCodeVerifier(): string;
/**
 * Derive code challenge dari code verifier menggunakan SHA-256.
 * Google & GitHub keduanya support S256 method.
 */
export declare function generateCodeChallenge(codeVerifier: string): string;
/**
 * Generate random state string untuk CSRF protection.
 * State dikirim ke provider dan dikembalikan di callback — harus cocok.
 */
export declare function generateOAuthState(): string;
