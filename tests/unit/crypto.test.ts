import { describe, it, expect } from 'vitest';
import {
  hashToken,
  generateSecureToken,
  generateUrlSafeToken,
  generateBackupCode,
  generateBackupCodes,
  hashPassword,
  verifyPassword,
  encrypt,
  decrypt,
  timingSafeEqual,
  generateClientId,
  generateClientSecret,
} from '../../src/lib/crypto';

describe('Crypto Utility', () => {
  describe('hashToken', () => {
    it('harus menghasilkan SHA-256 hash yang konsisten', () => {
      const token = 'my-secret-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
    });

    it('hash berbeda untuk token yang berbeda', () => {
      expect(hashToken('token1')).not.toBe(hashToken('token2'));
    });
  });

  describe('generateSecureToken', () => {
    it('harus generate token 64 chars (32 bytes default)', () => {
      const token = generateSecureToken();
      expect(token).toHaveLength(64);
    });

    it('harus generate token unik setiap kali', () => {
      const t1 = generateSecureToken();
      const t2 = generateSecureToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('generateUrlSafeToken', () => {
    it('harus tidak mengandung karakter tidak aman untuk URL', () => {
      const token = generateUrlSafeToken();
      expect(token).not.toMatch(/[+/=]/);
    });
  });

  describe('generateBackupCode', () => {
    it('harus format XXXXX-XXXXX (5-5 uppercase hex)', () => {
      const code = generateBackupCode();
      expect(code).toMatch(/^[A-F0-9]{5}-[A-F0-9]{5}$/);
    });

    it('generateBackupCodes harus generate N codes unik', () => {
      const codes = generateBackupCodes(10);
      expect(codes).toHaveLength(10);
      const unique = new Set(codes);
      expect(unique.size).toBe(10);
    });
  });

  describe('hashPassword + verifyPassword', () => {
    it('harus hash dan verify password dengan benar', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt format

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('harus return false untuk password yang salah', async () => {
      const hash = await hashPassword('CorrectPassword123');
      const isValid = await verifyPassword('WrongPassword123', hash);
      expect(isValid).toBe(false);
    });

    it('harus generate hash berbeda untuk password yang sama (bcrypt salt)', async () => {
      const hash1 = await hashPassword('SamePassword123');
      const hash2 = await hashPassword('SamePassword123');
      expect(hash1).not.toBe(hash2); // Berbeda karena random salt
    });
  });

  describe('encrypt + decrypt (AES-256-GCM)', () => {
    it('harus encrypt dan decrypt dengan benar', () => {
      const plaintext = 'my-secret-oauth-token-value';
      const ciphertext = encrypt(plaintext);

      expect(ciphertext).not.toBe(plaintext);

      const decrypted = decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('ciphertext harus berbeda setiap kali encrypt (IV unik)', () => {
      const plaintext = 'same-input-text';
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      expect(c1).not.toBe(c2); // IV berbeda
    });

    it('harus throw error jika ciphertext dimanipulasi', () => {
      const ciphertext = encrypt('original-text');
      // Corrupt ciphertext
      const corrupted = ciphertext.slice(0, -4) + 'ffff';
      expect(() => decrypt(corrupted)).toThrow();
    });
  });

  describe('timingSafeEqual', () => {
    it('harus return true untuk string yang sama', () => {
      expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
    });

    it('harus return false untuk string yang berbeda', () => {
      expect(timingSafeEqual('abc123', 'abc456')).toBe(false);
    });

    it('harus return false untuk string dengan panjang berbeda', () => {
      expect(timingSafeEqual('short', 'longer-string')).toBe(false);
    });
  });

  describe('generateClientId + generateClientSecret', () => {
    it('client_id harus diawali ci_', () => {
      expect(generateClientId().startsWith('ci_')).toBe(true);
    });

    it('client_secret harus diawali cs_', () => {
      expect(generateClientSecret().startsWith('cs_')).toBe(true);
    });

    it('harus generate nilai unik setiap kali', () => {
      expect(generateClientId()).not.toBe(generateClientId());
      expect(generateClientSecret()).not.toBe(generateClientSecret());
    });
  });
});
