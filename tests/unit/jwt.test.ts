import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.JWT_ALGORITHM = 'HS256';
  process.env.JWT_SECRET =
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
});

import {
  signJwt,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractBearerToken,
} from '../../src/lib/jwt';
import { TokenExpiredError, TokenInvalidError } from '../../src/shared/errors';

const MOCK_USER_ID    = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_SESSION_ID = '660e8400-e29b-41d4-a716-446655440001';
const MOCK_APP_ID     = '770e8400-e29b-41d4-a716-446655440002';

describe('JWT Utility', () => {
  describe('signAccessToken + verifyAccessToken', () => {
    it('harus bisa sign dan verify access token', () => {
      const token = signAccessToken({
        sub: MOCK_USER_ID,
        sessionId: MOCK_SESSION_ID,
        appId: MOCK_APP_ID,
      });

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const payload = verifyAccessToken(token);
      expect(payload.sub).toBe(MOCK_USER_ID);
      expect(payload.sessionId).toBe(MOCK_SESSION_ID);
      expect(payload.appId).toBe(MOCK_APP_ID);
      expect(payload.type).toBe('access');
    });

    it('harus throw TokenInvalidError jika token dimodifikasi', () => {
      const token = signAccessToken({
        sub: MOCK_USER_ID,
        sessionId: MOCK_SESSION_ID,
        appId: MOCK_APP_ID,
      });

      const parts = token.split('.');
      parts[1] = Buffer.from(
        JSON.stringify({ sub: 'hacked', type: 'access' })
      )
        .toString('base64')
        .replace(/=/g, '');
      const tampered = parts.join('.');

      expect(() => verifyAccessToken(tampered)).toThrow(TokenInvalidError);
    });

    it('harus throw TokenExpiredError jika token sudah expired', () => {
      // Gunakan signJwt langsung dengan TTL = -1 (langsung expired)
      const token = signJwt(
        {
          sub: MOCK_USER_ID,
          sessionId: MOCK_SESSION_ID,
          appId: MOCK_APP_ID,
          type: 'access',
        },
        -1
      );

      expect(() => verifyAccessToken(token)).toThrow(TokenExpiredError);
    });

    it('harus throw TokenInvalidError jika pakai refresh token sebagai access token', () => {
      const refreshToken = signRefreshToken({
        sub: MOCK_USER_ID,
        sessionId: MOCK_SESSION_ID,
        appId: MOCK_APP_ID,
        tokenFamily: MOCK_APP_ID,
      });

      expect(() => verifyAccessToken(refreshToken)).toThrow(TokenInvalidError);
    });
  });

  describe('signRefreshToken + verifyRefreshToken', () => {
    it('harus bisa sign dan verify refresh token', () => {
      const tokenFamily = '880e8400-e29b-41d4-a716-446655440003';
      const token = signRefreshToken({
        sub: MOCK_USER_ID,
        sessionId: MOCK_SESSION_ID,
        appId: MOCK_APP_ID,
        tokenFamily,
      });

      const payload = verifyRefreshToken(token);
      expect(payload.sub).toBe(MOCK_USER_ID);
      expect(payload.type).toBe('refresh');
      expect(payload.tokenFamily).toBe(tokenFamily);
    });

    it('harus throw TokenInvalidError jika pakai access token sebagai refresh token', () => {
      const accessToken = signAccessToken({
        sub: MOCK_USER_ID,
        sessionId: MOCK_SESSION_ID,
        appId: MOCK_APP_ID,
      });

      expect(() => verifyRefreshToken(accessToken)).toThrow(TokenInvalidError);
    });
  });

  describe('extractBearerToken', () => {
    it('harus ekstrak token dari Authorization header yang valid', () => {
      const token = 'eyJhbGciOiJIUzI1NiJ9.test.sig';
      expect(extractBearerToken(`Bearer ${token}`)).toBe(token);
    });

    it('harus return null jika header tidak ada', () => {
      expect(extractBearerToken(undefined)).toBeNull();
    });

    it('harus return null jika format bukan Bearer', () => {
      expect(extractBearerToken('Basic abc123')).toBeNull();
    });

    it('harus return null jika token kosong setelah Bearer', () => {
      expect(extractBearerToken('Bearer ')).toBeNull();
    });
  });
});
