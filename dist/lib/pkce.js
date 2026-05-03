"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCodeVerifier = generateCodeVerifier;
exports.generateCodeChallenge = generateCodeChallenge;
exports.generateOAuthState = generateOAuthState;
const node_crypto_1 = __importDefault(require("node:crypto"));
// ── PKCE (Proof Key for Code Exchange) ───────────────────────
// RFC 7636 — wajib untuk public clients agar aman dari code injection.
/**
 * Generate cryptographically random code verifier.
 * Panjang: 43-128 karakter (disarankan 64+).
 * Format: Base64URL (tanpa padding, +/= diganti).
 */
function generateCodeVerifier() {
    return node_crypto_1.default
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
function generateCodeChallenge(codeVerifier) {
    return node_crypto_1.default
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
function generateOAuthState() {
    return node_crypto_1.default.randomBytes(32).toString('hex');
}
//# sourceMappingURL=pkce.js.map