import crypto from 'crypto';
import { env } from '@/config/env';
import {
  TokenExpiredError,
  TokenInvalidError,
} from '@/shared/errors';
import type {
  JwtAccessPayload,
  JwtRefreshPayload,
  JwtPayload,
} from '@/types';

// ── JWT Implementation Manual ─────────────────────────────────
// Kita implementasi JWT manual agar tidak tergantung library dan
// bisa dukung RS256 + HS256 secara transparan.

function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): Buffer {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// ── Sign ──────────────────────────────────────────────────────
export function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresInSeconds: number
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = {
    alg: env.JWT_ALGORITHM,
    typ: 'JWT',
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  let signature: string;

  if (env.JWT_ALGORITHM === 'RS256') {
    if (!env.JWT_PRIVATE_KEY) {
      throw new Error('JWT_PRIVATE_KEY diperlukan untuk algoritma RS256');
    }
    const privateKey = Buffer.from(env.JWT_PRIVATE_KEY, 'base64').toString(
      'utf8'
    );
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingInput);
    signature = base64UrlEncode(sign.sign(privateKey));
  } else {
    // HS256
    if (!env.JWT_SECRET) {
      throw new Error('JWT_SECRET diperlukan untuk algoritma HS256');
    }
    signature = base64UrlEncode(
      crypto
        .createHmac('sha256', env.JWT_SECRET)
        .update(signingInput)
        .digest()
    );
  }

  return `${signingInput}.${signature}`;
}

// ── Verify ────────────────────────────────────────────────────
export function verifyJwt(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new TokenInvalidError('Format JWT tidak valid.');
  }

  const [headerEncoded, payloadEncoded, signature] = parts;
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  // Verifikasi signature
  let isValid = false;

  if (env.JWT_ALGORITHM === 'RS256') {
    if (!env.JWT_PUBLIC_KEY) {
      throw new Error('JWT_PUBLIC_KEY diperlukan untuk algoritma RS256');
    }
    const publicKey = Buffer.from(env.JWT_PUBLIC_KEY, 'base64').toString('utf8');
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signingInput);
    try {
      isValid = verify.verify(publicKey, base64UrlDecode(signature));
    } catch {
      isValid = false;
    }
  } else {
    // HS256 — constant-time comparison untuk mencegah timing attacks
    if (!env.JWT_SECRET) {
      throw new Error('JWT_SECRET diperlukan untuk algoritma HS256');
    }
    const expectedSig = base64UrlEncode(
      crypto
        .createHmac('sha256', env.JWT_SECRET)
        .update(signingInput)
        .digest()
    );
    // timingSafeEqual throws jika panjang buffer berbeda → catch → isValid = false
    try {
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expectedSig);
      if (sigBuf.length !== expBuf.length) {
        isValid = false;
      } else {
        isValid = crypto.timingSafeEqual(sigBuf, expBuf);
      }
    } catch {
      isValid = false;
    }
  }

  if (!isValid) {
    throw new TokenInvalidError('Signature JWT tidak valid.');
  }

  // Parse payload
  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded).toString('utf8'));
  } catch {
    throw new TokenInvalidError('Payload JWT tidak bisa di-parse.');
  }

  // Cek expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    throw new TokenExpiredError('Token sudah kadaluarsa.');
  }

  return payload;
}

// ── Specific Payload Generators ───────────────────────────────
export function signAccessToken(
  data: Omit<JwtAccessPayload, 'type' | 'iat' | 'exp'>
): string {
  return signJwt(
    { ...data, type: 'access' },
    env.JWT_ACCESS_TOKEN_TTL
  );
}

export function signRefreshToken(
  data: Omit<JwtRefreshPayload, 'type' | 'iat' | 'exp'>
): string {
  return signJwt(
    { ...data, type: 'refresh' },
    env.JWT_REFRESH_TOKEN_TTL
  );
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  const payload = verifyJwt(token);
  if (payload.type !== 'access') {
    throw new TokenInvalidError('Bukan access token.');
  }
  return payload as JwtAccessPayload;
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  const payload = verifyJwt(token);
  if (payload.type !== 'refresh') {
    throw new TokenInvalidError('Bukan refresh token.');
  }
  return payload as JwtRefreshPayload;
}

// ── Extract token dari Authorization header ──────────────────
export function extractBearerToken(
  authHeader: string | undefined
): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}
