"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = hashToken;
exports.generateSecureToken = generateSecureToken;
exports.generateUrlSafeToken = generateUrlSafeToken;
exports.generateBackupCode = generateBackupCode;
exports.generateBackupCodes = generateBackupCodes;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.timingSafeEqual = timingSafeEqual;
exports.generateClientId = generateClientId;
exports.generateClientSecret = generateClientSecret;
exports.generateMfaToken = generateMfaToken;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("../config/env");
const constants_1 = require("../config/constants");
// ── SHA-256 Hashing ───────────────────────────────────────────
// Digunakan untuk: token storage (verification_tokens, refresh_tokens)
// Token asli dikirim ke user, hash-nya disimpan di DB.
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
// ── Secure Random Token Generator ────────────────────────────
function generateSecureToken(bytes = 32) {
    return crypto_1.default.randomBytes(bytes).toString('hex');
}
// ── URL-Safe Token untuk link di email ───────────────────────
function generateUrlSafeToken(bytes = 32) {
    return crypto_1.default
        .randomBytes(bytes)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}
// ── Backup Code Generator ────────────────────────────────────
// Format: XXXXX-XXXXX (5 hex + 5 hex, mudah dibaca user)
function generateBackupCode() {
    const part1 = crypto_1.default.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
    const part2 = crypto_1.default.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
    return `${part1.slice(0, 5)}-${part2.slice(0, 5)}`;
}
function generateBackupCodes(count) {
    return Array.from({ length: count }, () => generateBackupCode());
}
// ── Password Hashing (bcrypt) ────────────────────────────────
async function hashPassword(password) {
    return bcryptjs_1.default.hash(password, constants_1.PASSWORD_POLICY.BCRYPT_ROUNDS);
}
async function verifyPassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
// ── AES-256-GCM Encryption ───────────────────────────────────
// Digunakan untuk: provider_access_token, TOTP secrets di DB.
// IV di-generate baru setiap enkripsi → ciphertext selalu berbeda
// meskipun plaintext sama.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV, recommended untuk GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
function getEncryptionKey() {
    return Buffer.from(env_1.env.ENCRYPTION_KEY, 'hex');
}
function encrypt(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv, {
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
function decrypt(ciphertext) {
    const key = getEncryptionKey();
    const buf = Buffer.from(ciphertext, 'hex');
    const iv = buf.subarray(0, IV_LENGTH);
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
}
// ── Timing-Safe Comparison ────────────────────────────────────
function timingSafeEqual(a, b) {
    if (a.length !== b.length) {
        // Tetap lakukan operasi untuk menghindari timing attack
        crypto_1.default.timingSafeEqual(Buffer.from(a), Buffer.from(a));
        return false;
    }
    return crypto_1.default.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
// ── Client Secret Generator ───────────────────────────────────
function generateClientId() {
    return 'ci_' + crypto_1.default.randomBytes(16).toString('hex');
}
function generateClientSecret() {
    return 'cs_' + crypto_1.default.randomBytes(32).toString('hex');
}
// ── MFA Token Hasher ─────────────────────────────────────────
// Temporary MFA token yang dikirim ke client setelah login berhasil
// tapi MFA belum diverifikasi.
function generateMfaToken() {
    return 'mfa_' + crypto_1.default.randomBytes(24).toString('hex');
}
//# sourceMappingURL=crypto.js.map