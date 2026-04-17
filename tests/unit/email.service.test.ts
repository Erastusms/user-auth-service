import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/crypto', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2b$12$newhashedpassword'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  hashToken: vi.fn().mockImplementation((t: string) => `hash_${t}`),
  generateUrlSafeToken: vi.fn().mockReturnValue('mock_url_safe_token_64chars'),
}));

vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  sendMagicLinkEmail: vi.fn().mockResolvedValue(true),
}));

import * as emailService from '../../src/modules/email/email.service';
import prisma from '@/lib/prisma';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  InvalidCredentialsError,
  AccountBannedError,
  AccountInactiveError,
} from '../../src/shared/errors';

// ── Fixtures ──────────────────────────────────────────────────
const MOCK_APP = { id: 'app-uuid-1', is_active: true, deleted_at: null };

const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  username: 'testuser',
  display_name: 'Test User',
  is_active: true,
  is_banned: false,
  ban_reason: null,
  deleted_at: null,
  email_verified_at: null,
};

const MOCK_USER_VERIFIED = { ...MOCK_USER, email_verified_at: new Date() };

const MOCK_TOKEN = {
  id: 'token-uuid-1',
  user_id: 'user-uuid-1',
  type: 'email_verification',
  token_hash: 'hash_mock_url_safe_token_64chars',
  target: 'test@example.com',
  expires_at: new Date(Date.now() + 3_600_000),
  used_at: null,
};

const MOCK_PASSWORD = {
  id: 'pass-uuid-1',
  user_id: 'user-uuid-1',
  password_hash: '$2b$12$currenthash',
  previous_hashes: [],
  must_change: false,
};

const META = { ip: '127.0.0.1', userAgent: 'Vitest' };

function setupCommonMocks() {
  vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);
  vi.mocked(prisma.verification_tokens.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.verification_tokens.create).mockResolvedValue({} as never);
  vi.mocked(prisma.users.update).mockResolvedValue({} as never);
  vi.mocked(prisma.sessions.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.sessions.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.refresh_tokens.updateMany).mockResolvedValue({ count: 0 } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupCommonMocks();
});

// ════════════════════════════════════════════════════════════════
describe('emailService.sendEmailVerification', () => {

  it('harus kirim email dan return message sukses', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER as never);
    vi.mocked(prisma.verification_tokens.create).mockResolvedValue({} as never);

    const result = await emailService.sendEmailVerification(
      { email: 'test@example.com' }, META
    );

    expect(result.message).toBeTruthy();
    expect(prisma.verification_tokens.create).toHaveBeenCalledOnce();
    // Token lama di-invalidate dulu sebelum buat baru
    expect(prisma.verification_tokens.updateMany).toHaveBeenCalledOnce();
  });

  it('harus return generic message jika email tidak terdaftar (anti-enumeration)', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    const result = await emailService.sendEmailVerification(
      { email: 'notexist@example.com' }, META
    );

    // Tetap return pesan tanpa error
    expect(result.message).toBeTruthy();
    // Tidak buat token karena email tidak ada
    expect(prisma.verification_tokens.create).not.toHaveBeenCalled();
  });

  it('harus throw ConflictError jika email sudah terverifikasi', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER_VERIFIED as never);

    await expect(
      emailService.sendEmailVerification({ email: 'test@example.com' }, META)
    ).rejects.toThrow(ConflictError);
  });

  it('harus throw AccountBannedError jika user di-ban', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER, is_banned: true, ban_reason: 'Spamming',
    } as never);

    await expect(
      emailService.sendEmailVerification({ email: 'test@example.com' }, META)
    ).rejects.toThrow(AccountBannedError);
  });

  it('harus throw AccountInactiveError jika user tidak aktif', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER, is_active: false,
    } as never);

    await expect(
      emailService.sendEmailVerification({ email: 'test@example.com' }, META)
    ).rejects.toThrow(AccountInactiveError);
  });

  it('token baru harus replace token lama (invalidate existing)', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER as never);

    await emailService.sendEmailVerification({ email: 'test@example.com' }, META);

    // updateMany dipanggil untuk invalidate token lama
    expect(prisma.verification_tokens.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: MOCK_USER.id,
          type: 'email_verification',
          used_at: null,
        }),
      })
    );
  });
});

// ════════════════════════════════════════════════════════════════
describe('emailService.verifyEmail', () => {

  it('harus berhasil verify email dan update user', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue(MOCK_TOKEN as never);
    vi.mocked(prisma.verification_tokens.update).mockResolvedValue({} as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER,
      email_verified_at: null,
    } as never);

    const result = await emailService.verifyEmail(
      { token: 'mock_url_safe_token_64chars' }, META
    );

    expect(result.user.emailVerified).toBe(true);
    expect(prisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email_verified_at: expect.any(Date) }),
      })
    );
  });

  it('harus throw BadRequestError jika token tidak ditemukan', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue(null);

    await expect(
      emailService.verifyEmail({ token: 'invalid_token' }, META)
    ).rejects.toThrow(BadRequestError);
  });

  it('harus throw BadRequestError jika token sudah digunakan', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue({
      ...MOCK_TOKEN,
      used_at: new Date(), // sudah dipakai
    } as never);

    await expect(
      emailService.verifyEmail({ token: 'already_used_token' }, META)
    ).rejects.toThrow(BadRequestError);
  });

  it('harus throw BadRequestError jika token sudah expired', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue({
      ...MOCK_TOKEN,
      expires_at: new Date(Date.now() - 1000), // 1 detik lalu
    } as never);

    await expect(
      emailService.verifyEmail({ token: 'expired_token' }, META)
    ).rejects.toThrow(BadRequestError);
  });

  it('harus idempotent — return sukses jika email sudah verified sebelumnya', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue(MOCK_TOKEN as never);
    vi.mocked(prisma.verification_tokens.update).mockResolvedValue({} as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER,
      email_verified_at: new Date(), // sudah verified
    } as never);

    const result = await emailService.verifyEmail(
      { token: 'mock_url_safe_token_64chars' }, META
    );

    expect(result.user.emailVerified).toBe(true);
    // Tidak perlu update lagi
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('harus throw BadRequestError jika tipe token tidak cocok (password reset dipakai untuk verify email)', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue({
      ...MOCK_TOKEN,
      type: 'password_reset', // tipe salah
    } as never);

    await expect(
      emailService.verifyEmail({ token: 'wrong_type_token' }, META)
    ).rejects.toThrow(BadRequestError);
  });
});

// ════════════════════════════════════════════════════════════════
describe('emailService.forgotPassword', () => {

  it('harus return generic message dan kirim email reset', async () => {
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER as never);

    const result = await emailService.forgotPassword(
      { email: 'test@example.com', appClientId: 'ci_test' }, META
    );

    expect(result.message).toBeTruthy();
    expect(prisma.verification_tokens.create).toHaveBeenCalledOnce();
  });

  it('harus return generic message jika email tidak terdaftar (anti-enumeration)', async () => {
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    const result = await emailService.forgotPassword(
      { email: 'notfound@example.com', appClientId: 'ci_test' }, META
    );

    // Tetap return pesan sukses — tidak reveal apakah email ada
    expect(result.message).toBeTruthy();
    expect(prisma.verification_tokens.create).not.toHaveBeenCalled();
  });

  it('harus return generic message jika app tidak ditemukan', async () => {
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(null);

    const result = await emailService.forgotPassword(
      { email: 'test@example.com', appClientId: 'ci_invalid' }, META
    );

    expect(result.message).toBeTruthy();
    expect(prisma.verification_tokens.create).not.toHaveBeenCalled();
  });

  it('harus return generic message jika user di-ban (anti-enumeration)', async () => {
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER, is_banned: true,
    } as never);

    const result = await emailService.forgotPassword(
      { email: 'test@example.com', appClientId: 'ci_test' }, META
    );

    expect(result.message).toBeTruthy();
    expect(prisma.verification_tokens.create).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════
describe('emailService.resetPassword', () => {

  it('harus reset password dan revoke semua session', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue({
      ...MOCK_TOKEN, type: 'password_reset',
    } as never);
    vi.mocked(prisma.verification_tokens.update).mockResolvedValue({} as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      id: 'user-uuid-1', email: 'test@example.com',
      is_active: true, deleted_at: null,
    } as never);
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue(MOCK_PASSWORD as never);
    vi.mocked(prisma.passwords.update).mockResolvedValue({} as never);
    vi.mocked(prisma.sessions.findMany).mockResolvedValue([
      { id: 'sess-1' }, { id: 'sess-2' },
    ] as never);

    const { verifyPassword: vp } = await import('@/lib/crypto');
    vi.mocked(vp).mockResolvedValue(false); // new password != current

    const result = await emailService.resetPassword(
      { token: 'mock_url_safe_token_64chars', newPassword: 'NewPassword123' }, META
    );

    expect(result.revokedSessions).toBe(2);
    expect(prisma.sessions.updateMany).toHaveBeenCalledOnce();
    expect(prisma.passwords.update).toHaveBeenCalledOnce();
  });

  it('harus throw BadRequestError jika token tidak valid', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue(null);

    await expect(
      emailService.resetPassword(
        { token: 'invalid_token', newPassword: 'NewPassword123' }, META
      )
    ).rejects.toThrow(BadRequestError);
  });

  it('harus throw BadRequestError jika password baru sama dengan yang sekarang', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue({
      ...MOCK_TOKEN, type: 'password_reset',
    } as never);
    vi.mocked(prisma.verification_tokens.update).mockResolvedValue({} as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      id: 'user-uuid-1', email: 'test@example.com',
      is_active: true, deleted_at: null,
    } as never);
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue(MOCK_PASSWORD as never);

    const { verifyPassword: vp } = await import('@/lib/crypto');
    vi.mocked(vp).mockResolvedValue(true); // new == current

    await expect(
      emailService.resetPassword(
        { token: 'mock_url_safe_token_64chars', newPassword: 'SamePassword123' }, META
      )
    ).rejects.toThrow(BadRequestError);
  });

  it('harus buat password record baru jika belum ada (user OAuth)', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue({
      ...MOCK_TOKEN, type: 'password_reset',
    } as never);
    vi.mocked(prisma.verification_tokens.update).mockResolvedValue({} as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      id: 'user-uuid-1', email: 'oauth@example.com',
      is_active: true, deleted_at: null,
    } as never);
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue(null); // tidak ada password
    vi.mocked(prisma.passwords.create).mockResolvedValue({} as never);

    const result = await emailService.resetPassword(
      { token: 'mock_url_safe_token_64chars', newPassword: 'NewPassword123' }, META
    );

    expect(prisma.passwords.create).toHaveBeenCalledOnce();
    expect(result.message).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════
describe('emailService.changePassword', () => {

  it('harus berhasil ganti password dan revoke session lain', async () => {
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue(MOCK_PASSWORD as never);
    vi.mocked(prisma.passwords.update).mockResolvedValue({} as never);
    vi.mocked(prisma.sessions.findMany).mockResolvedValue([
      { id: 'sess-other-1' }, { id: 'sess-other-2' },
    ] as never);

    const { verifyPassword: vp } = await import('@/lib/crypto');
    vi.mocked(vp)
      .mockResolvedValueOnce(true)   // current password match
      .mockResolvedValue(false);     // new password != history

    const result = await emailService.changePassword(
      {
        currentPassword: 'CurrentPass123',
        newPassword: 'NewPassword456',
        revokeOtherSessions: true,
      },
      'user-uuid-1',
      'current-sess-id',
      META
    );

    expect(result.message).toBeTruthy();
    expect(prisma.passwords.update).toHaveBeenCalledOnce();
    // Sessions lain direvoke
    expect(prisma.sessions.updateMany).toHaveBeenCalledOnce();
  });

  it('harus throw BadRequestError jika user tidak punya password (OAuth user)', async () => {
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue(null);

    await expect(
      emailService.changePassword(
        { currentPassword: 'Old123', newPassword: 'New123456', revokeOtherSessions: false },
        'user-uuid-oauth',
        'sess-id',
        META
      )
    ).rejects.toThrow(BadRequestError);
  });

  it('harus throw InvalidCredentialsError jika password saat ini salah', async () => {
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue(MOCK_PASSWORD as never);

    const { verifyPassword: vp } = await import('@/lib/crypto');
    vi.mocked(vp).mockResolvedValueOnce(false); // current password wrong

    await expect(
      emailService.changePassword(
        { currentPassword: 'WrongCurrent', newPassword: 'NewPassword123', revokeOtherSessions: false },
        'user-uuid-1',
        'sess-id',
        META
      )
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('harus throw BadRequestError jika password baru ada di history', async () => {
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue({
      ...MOCK_PASSWORD,
      previous_hashes: ['$2b$12$oldhash1', '$2b$12$oldhash2'],
    } as never);

    const { verifyPassword: vp } = await import('@/lib/crypto');
    vi.mocked(vp)
      .mockResolvedValueOnce(true)   // current ok
      .mockResolvedValueOnce(false)  // not = oldhash1
      .mockResolvedValueOnce(true);  // match oldhash2 = history reuse!

    await expect(
      emailService.changePassword(
        { currentPassword: 'Current123', newPassword: 'OldPassword123', revokeOtherSessions: false },
        'user-uuid-1',
        'sess-id',
        META
      )
    ).rejects.toThrow(BadRequestError);
  });

  it('harus tidak revoke sessions jika revokeOtherSessions=false', async () => {
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue(MOCK_PASSWORD as never);
    vi.mocked(prisma.passwords.update).mockResolvedValue({} as never);

    const { verifyPassword: vp } = await import('@/lib/crypto');
    vi.mocked(vp)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);

    await emailService.changePassword(
      { currentPassword: 'Current123', newPassword: 'NewPass456', revokeOtherSessions: false },
      'user-uuid-1',
      'current-sess-id',
      META
    );

    // findMany untuk session tidak dipanggil
    expect(prisma.sessions.findMany).not.toHaveBeenCalled();
    expect(prisma.sessions.updateMany).not.toHaveBeenCalled();
  });
});
