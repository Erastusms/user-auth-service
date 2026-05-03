"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signJwt = signJwt;
exports.verifyJwt = verifyJwt;
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.extractBearerToken = extractBearerToken;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const errors_1 = require("../shared/errors");
// ── JWT Implementation Manual ─────────────────────────────────
// Kita implementasi JWT manual agar tidak tergantung library dan
// bisa dukung RS256 + HS256 secara transparan.
function base64UrlEncode(data) {
    const buf = typeof data === 'string' ? Buffer.from(data) : data;
    return buf
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}
function base64UrlDecode(str) {
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
// ── Sign ──────────────────────────────────────────────────────
function signJwt(payload, expiresInSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
        ...payload,
        iat: now,
        exp: now + expiresInSeconds,
    };
    const header = {
        alg: env_1.env.JWT_ALGORITHM,
        typ: 'JWT',
    };
    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload));
    const signingInput = `${headerEncoded}.${payloadEncoded}`;
    let signature;
    if (env_1.env.JWT_ALGORITHM === 'RS256') {
        if (!env_1.env.JWT_PRIVATE_KEY) {
            throw new Error('JWT_PRIVATE_KEY diperlukan untuk algoritma RS256');
        }
        const privateKey = Buffer.from(env_1.env.JWT_PRIVATE_KEY, 'base64').toString('utf8');
        const sign = crypto_1.default.createSign('RSA-SHA256');
        sign.update(signingInput);
        signature = base64UrlEncode(sign.sign(privateKey));
    }
    else {
        // HS256
        if (!env_1.env.JWT_SECRET) {
            throw new Error('JWT_SECRET diperlukan untuk algoritma HS256');
        }
        signature = base64UrlEncode(crypto_1.default
            .createHmac('sha256', env_1.env.JWT_SECRET)
            .update(signingInput)
            .digest());
    }
    return `${signingInput}.${signature}`;
}
// ── Verify ────────────────────────────────────────────────────
function verifyJwt(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new errors_1.TokenInvalidError('Format JWT tidak valid.');
    }
    const [headerEncoded, payloadEncoded, signature] = parts;
    const signingInput = `${headerEncoded}.${payloadEncoded}`;
    // Verifikasi signature
    let isValid = false;
    if (env_1.env.JWT_ALGORITHM === 'RS256') {
        if (!env_1.env.JWT_PUBLIC_KEY) {
            throw new Error('JWT_PUBLIC_KEY diperlukan untuk algoritma RS256');
        }
        const publicKey = Buffer.from(env_1.env.JWT_PUBLIC_KEY, 'base64').toString('utf8');
        const verify = crypto_1.default.createVerify('RSA-SHA256');
        verify.update(signingInput);
        try {
            isValid = verify.verify(publicKey, base64UrlDecode(signature));
        }
        catch {
            isValid = false;
        }
    }
    else {
        // HS256 — constant-time comparison untuk mencegah timing attacks
        if (!env_1.env.JWT_SECRET) {
            throw new Error('JWT_SECRET diperlukan untuk algoritma HS256');
        }
        const expectedSig = base64UrlEncode(crypto_1.default
            .createHmac('sha256', env_1.env.JWT_SECRET)
            .update(signingInput)
            .digest());
        // timingSafeEqual throws jika panjang buffer berbeda → catch → isValid = false
        try {
            const sigBuf = Buffer.from(signature);
            const expBuf = Buffer.from(expectedSig);
            if (sigBuf.length !== expBuf.length) {
                isValid = false;
            }
            else {
                isValid = crypto_1.default.timingSafeEqual(sigBuf, expBuf);
            }
        }
        catch {
            isValid = false;
        }
    }
    if (!isValid) {
        throw new errors_1.TokenInvalidError('Signature JWT tidak valid.');
    }
    // Parse payload
    let payload;
    try {
        payload = JSON.parse(base64UrlDecode(payloadEncoded).toString('utf8'));
    }
    catch {
        throw new errors_1.TokenInvalidError('Payload JWT tidak bisa di-parse.');
    }
    // Cek expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
        throw new errors_1.TokenExpiredError('Token sudah kadaluarsa.');
    }
    return payload;
}
// ── Specific Payload Generators ───────────────────────────────
function signAccessToken(data) {
    return signJwt({ ...data, type: 'access' }, env_1.env.JWT_ACCESS_TOKEN_TTL);
}
function signRefreshToken(data) {
    return signJwt({ ...data, type: 'refresh' }, env_1.env.JWT_REFRESH_TOKEN_TTL);
}
function verifyAccessToken(token) {
    const payload = verifyJwt(token);
    if (payload.type !== 'access') {
        throw new errors_1.TokenInvalidError('Bukan access token.');
    }
    return payload;
}
function verifyRefreshToken(token) {
    const payload = verifyJwt(token);
    if (payload.type !== 'refresh') {
        throw new errors_1.TokenInvalidError('Bukan refresh token.');
    }
    return payload;
}
// ── Extract token dari Authorization header ──────────────────
function extractBearerToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.slice(7).trim();
    return token.length > 0 ? token : null;
}
//# sourceMappingURL=jwt.js.map