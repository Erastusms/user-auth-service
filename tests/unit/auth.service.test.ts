import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock semua dependencies eksternal ─────────────────────────
vi.mock('@/lib/crypto', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  hashToken: vi.fn().mockImplementation((t: string) => `hash_${t}`),
  generateSecureToken: vi.fn().mockReturnValue('mock_secure_token_96chars'),
  generateUrlSafeToken: vi.fn().mockReturnValue('mock_url_safe_token'),
}));

vi.mock('@/lib/jwt', () => ({
  signAccessToken: vi.fn().mockReturnValue('mock_access_token'),
  signRefreshToken: vi.fn().mockReturnValue('mock_refresh_token'),
  verifyRefreshToken: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
}));

import * as authService from '../../src/modules/auth/auth.service';
import prisma from '@/lib/prisma';
import {
  ConflictError,
  InvalidCredentialsError,
  AccountBannedError,
  AccountInactiveError,
  TokenInvalidError,
  UnauthorizedError,
  NotFoundError,
} from '../../src/shared/errors';

// ── Fixtures ──────────────────────────────────────────────────
const MOCK_APP = {
  id: 'app-uuid-1',
  slug: 'default',
  client_id: 'ci_testclientid',
  access_token_ttl: 900,
  refresh_token_ttl: 2592000,
  is_active: true,
  deleted_at: null,
};

const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  username: 'testuser',
  display_name: 'Test User',
  avatar_url: null,
  is_active: true,
  is_banned: false,
  ban_reason: null,
  deleted_at: null,
  email_verified_at: new Date(),
  passwords: { password_hash: '$2b$12$hashedpassword', must_change: false },
};

const MOCK_META = {
  ip: '127.0.0.1',
  userAgent: 'Jest/Test',
  deviceName: 'Test Device',
  deviceType: 'api' as const,
};

const MOCK_REFRESH_TOKEN_ROW = {
  id: 'rt-uuid-1',
  session_id: 'sess-uuid-1',
  user_id: 'user-uuid-1',
  app_id: 'app-uuid-1',
  family: 'family-uuid-1',
  token_hash: 'hash_mock_secure_token_96chars',
  used_at: null,
  expires_at: new Date(Date.now() + 2592000 * 1000),
  revoked_at: null,
};

const MOCK_SESSION_ROW = {
  id: 'sess-uuid-1',
  user_id: 'user-uuid-1',
  app_id: 'app-uuid-1',
  status: 'active',
  expires_at: new Date(Date.now() + 2592000 * 1000),
};

// ── Helper: setup Prisma mocks ─────────────────────────────────
function setupCommonMocks() {
  vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
  vi.mocked(prisma.roles.findFirst).mockResolvedValue({ id: 'role-member-uuid' } as never);
  vi.mocked(prisma.user_roles.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);

  // Mock $transaction — eksekusi callback langsung
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)
  );

  vi.mocked(prisma.users.create).mockResolvedValue({} as never);
  vi.mocked(prisma.passwords.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_profiles.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_app_memberships.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_roles.create).mockResolvedValue({} as never);
  vi.mocked(prisma.verification_tokens.create).mockResolvedValue({} as never);
  vi.mocked(prisma.sessions.create).mockResolvedValue({} as never);
  vi.mocked(prisma.refresh_tokens.create).mockResolvedValue({} as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════
describe('authService.register', () => {
  beforeEach(setupCommonMocks);

  it('harus berhasil register user baru', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    const result = await authService.register(
      {
        appClientId: 'ci_testclientid',
        email: 'new@example.com',
        password: 'Password123',
        displayName: 'New User',
        locale: 'id',
      },
      MOCK_META
    );

    expect(result.user.email).toBe('new@example.com');
    expect(result.user.emailVerified).toBe(false);
    expect(result.message).toContain('Registrasi berhasil');
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.users.create).toHaveBeenCalledOnce();
    expect(prisma.passwords.create).toHaveBeenCalledOnce();
  });

  it('harus throw ConflictError jika email sudah terdaftar', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      id: 'existing-uuid',
      deleted_at: null,
    } as never);

    await expect(
      authService.register(
        { appClientId: 'ci_testclientid', email: 'existing@example.com', password: 'Password123', locale: 'id' },
        MOCK_META
      )
    ).rejects.toThrow(ConflictError);
  });

  it('harus throw NotFoundError jika app tidak ditemukan', async () => {
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(null);

    await expect(
      authService.register(
        { appClientId: 'invalid_client_id', email: 'test@example.com', password: 'Password123', locale: 'id' },
        MOCK_META
      )
    ).rejects.toThrow(NotFoundError);
  });

  it('harus throw NotFoundError jika app inactive', async () => {
    vi.mocked(prisma.apps.findUnique).mockResolvedValue({ ...MOCK_APP, is_active: false } as never);

    await expect(
      authService.register(
        { appClientId: 'ci_testclientid', email: 'test@example.com', password: 'Password123', locale: 'id' },
        MOCK_META
      )
    ).rejects.toThrow(NotFoundError);
  });

  it('harus auto-generate displayName dari email jika tidak diisi', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    const result = await authService.register(
      { appClientId: 'ci_testclientid', email: 'johndoe@example.com', password: 'Password123', locale: 'id' },
      MOCK_META
    );

    expect(result.user.displayName).toBe('johndoe');
  });

  it('harus assign role member jika ada', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.roles.findFirst).mockResolvedValue({ id: 'role-member-uuid' } as never);

    await authService.register(
      { appClientId: 'ci_testclientid', email: 'test2@example.com', password: 'Password123', locale: 'id' },
      MOCK_META
    );

    expect(prisma.user_roles.create).toHaveBeenCalledOnce();
  });
});

// ════════════════════════════════════════════════════════════════
describe('authService.login', () => {
  beforeEach(() => {
    setupCommonMocks();
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER as never);
    vi.mocked(prisma.users.update).mockResolvedValue({} as never);
  });

  it('harus berhasil login dan return token pair', async () => {
    const result = await authService.login(
      {
        appClientId: 'ci_testclientid',
        email: 'test@example.com',
        password: 'Password123',
        deviceName: 'Test Device',
        deviceType: 'api',
      },
      MOCK_META
    );

    expect(result.tokens.accessToken).toBe('mock_access_token');
    expect(result.tokens.tokenType).toBe('Bearer');
    expect(result.tokens.expiresIn).toBe(900);
    expect(result.user.email).toBe('test@example.com');
    expect(result.session.id).toBeDefined();
  });

  it('harus throw InvalidCredentialsError jika user tidak ditemukan', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    await expect(
      authService.login(
        { appClientId: 'ci_testclientid', email: 'notfound@example.com', password: 'Password123', deviceName: 'D', deviceType: 'api' },
        MOCK_META
      )
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('harus throw InvalidCredentialsError jika password salah', async () => {
    const { verifyPassword } = await import('@/lib/crypto');
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    await expect(
      authService.login(
        { appClientId: 'ci_testclientid', email: 'test@example.com', password: 'WrongPassword', deviceName: 'D', deviceType: 'api' },
        MOCK_META
      )
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('harus throw AccountBannedError jika user di-ban', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER,
      is_banned: true,
      ban_reason: 'Melanggar ketentuan',
    } as never);

    await expect(
      authService.login(
        { appClientId: 'ci_testclientid', email: 'test@example.com', password: 'Password123', deviceName: 'D', deviceType: 'api' },
        MOCK_META
      )
    ).rejects.toThrow(AccountBannedError);
  });

  it('harus throw AccountInactiveError jika user tidak aktif', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER,
      is_active: false,
    } as never);

    await expect(
      authService.login(
        { appClientId: 'ci_testclientid', email: 'test@example.com', password: 'Password123', deviceName: 'D', deviceType: 'api' },
        MOCK_META
      )
    ).rejects.toThrow(AccountInactiveError);
  });

  it('harus throw InvalidCredentialsError jika user di-soft-delete', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER,
      deleted_at: new Date(),
    } as never);

    await expect(
      authService.login(
        { appClientId: 'ci_testclientid', email: 'test@example.com', password: 'Password123', deviceName: 'D', deviceType: 'api' },
        MOCK_META
      )
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('harus return emailVerified: false jika belum verifikasi', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER,
      email_verified_at: null,
    } as never);

    const result = await authService.login(
      { appClientId: 'ci_testclientid', email: 'test@example.com', password: 'Password123', deviceName: 'D', deviceType: 'api' },
      MOCK_META
    );

    expect(result.user.emailVerified).toBe(false);
  });

  it('harus buat session baru setiap login', async () => {
    await authService.login(
      { appClientId: 'ci_testclientid', email: 'test@example.com', password: 'Password123', deviceName: 'D', deviceType: 'api' },
      MOCK_META
    );

    expect(prisma.sessions.create).toHaveBeenCalledOnce();
    expect(prisma.refresh_tokens.create).toHaveBeenCalledOnce();
  });
});

// ════════════════════════════════════════════════════════════════
describe('authService.logout', () => {
  it('harus revoke refresh token dan session', async () => {
    vi.mocked(prisma.refresh_tokens.findUnique).mockResolvedValue({
      id: 'rt-uuid-1',
      session_id: 'sess-uuid-1',
      user_id: 'user-uuid-1',
      app_id: 'app-uuid-1',
      revoked_at: null,
    } as never);
    vi.mocked(prisma.refresh_tokens.update).mockResolvedValue({} as never);
    vi.mocked(prisma.sessions.update).mockResolvedValue({} as never);
    vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);

    await authService.logout(
      { refreshToken: 'valid_refresh_token' },
      'user-uuid-1',
      'sess-uuid-1',
      MOCK_META
    );

    expect(prisma.refresh_tokens.update).toHaveBeenCalledOnce();
    expect(prisma.sessions.update).toHaveBeenCalledOnce();
    expect(prisma.sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'revoked' }),
      })
    );
  });

  it('harus tetap revoke session meskipun refresh token tidak ditemukan', async () => {
    vi.mocked(prisma.refresh_tokens.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.sessions.update).mockResolvedValue({} as never);
    vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);

    await authService.logout(
      { refreshToken: 'not_found_token' },
      'user-uuid-1',
      'sess-uuid-1',
      MOCK_META
    );

    // Session tetap harus direvoke
    expect(prisma.sessions.update).toHaveBeenCalledOnce();
    // Tapi refresh token tidak di-update karena tidak ditemukan
    expect(prisma.refresh_tokens.update).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════
describe('authService.refresh', () => {
  beforeEach(() => {
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
    vi.mocked(prisma.refresh_tokens.findUnique).mockResolvedValue(MOCK_REFRESH_TOKEN_ROW as never);
    vi.mocked(prisma.sessions.findUnique).mockResolvedValue(MOCK_SESSION_ROW as never);
    vi.mocked(prisma.refresh_tokens.update).mockResolvedValue({} as never);
    vi.mocked(prisma.refresh_tokens.create).mockResolvedValue({} as never);
    vi.mocked(prisma.sessions.update).mockResolvedValue({} as never);
    vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);
  });

  it('harus return token pair baru dan rotate refresh token', async () => {
    const result = await authService.refresh({
      refreshToken: 'mock_secure_token_96chars',
      appClientId: 'ci_testclientid',
    });

    expect(result.tokens.accessToken).toBe('mock_access_token');
    expect(result.tokens.tokenType).toBe('Bearer');

    // Lama di-update sebagai used
    expect(prisma.refresh_tokens.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ used_at: expect.any(Date) }),
      })
    );
    // Baru dibuat
    expect(prisma.refresh_tokens.create).toHaveBeenCalledOnce();
  });

  it('harus throw TokenInvalidError jika token tidak ditemukan', async () => {
    vi.mocked(prisma.refresh_tokens.findUnique).mockResolvedValue(null);

    await expect(
      authService.refresh({ refreshToken: 'invalid', appClientId: 'ci_testclientid' })
    ).rejects.toThrow(TokenInvalidError);
  });

  it('harus throw TokenInvalidError jika token sudah expired', async () => {
    vi.mocked(prisma.refresh_tokens.findUnique).mockResolvedValue({
      ...MOCK_REFRESH_TOKEN_ROW,
      expires_at: new Date(Date.now() - 1000), // sudah lewat
    } as never);

    await expect(
      authService.refresh({ refreshToken: 'expired_token', appClientId: 'ci_testclientid' })
    ).rejects.toThrow(TokenInvalidError);
  });

  it('harus throw TokenInvalidError jika token sudah direvoke', async () => {
    vi.mocked(prisma.refresh_tokens.findUnique).mockResolvedValue({
      ...MOCK_REFRESH_TOKEN_ROW,
      revoked_at: new Date(),
    } as never);

    await expect(
      authService.refresh({ refreshToken: 'revoked_token', appClientId: 'ci_testclientid' })
    ).rejects.toThrow(TokenInvalidError);
  });

  it('harus REVOKE seluruh family dan throw UnauthorizedError saat reuse attack', async () => {
    vi.mocked(prisma.refresh_tokens.findUnique).mockResolvedValue({
      ...MOCK_REFRESH_TOKEN_ROW,
      used_at: new Date(Date.now() - 5000), // sudah dipakai sebelumnya!
    } as never);
    vi.mocked(prisma.refresh_tokens.updateMany).mockResolvedValue({ count: 3 } as never);

    await expect(
      authService.refresh({ refreshToken: 'reused_token', appClientId: 'ci_testclientid' })
    ).rejects.toThrow(UnauthorizedError);

    // Seluruh family harus direvoke
    expect(prisma.refresh_tokens.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { family: MOCK_REFRESH_TOKEN_ROW.family },
        data: expect.objectContaining({ revoke_reason: 'reuse_attack' }),
      })
    );

    // Session juga direvoke
    expect(prisma.sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revoke_reason: 'refresh_token_reuse' }),
      })
    );
  });

  it('harus throw UnauthorizedError jika session tidak aktif', async () => {
    vi.mocked(prisma.sessions.findUnique).mockResolvedValue({
      ...MOCK_SESSION_ROW,
      status: 'revoked',
    } as never);

    await expect(
      authService.refresh({ refreshToken: 'valid_token', appClientId: 'ci_testclientid' })
    ).rejects.toThrow(UnauthorizedError);
  });
});

// ════════════════════════════════════════════════════════════════
describe('authService.revokeAll', () => {
  it('harus revoke semua session aktif user', async () => {
    vi.mocked(prisma.sessions.findMany).mockResolvedValue([
      { id: 'sess-1' },
      { id: 'sess-2' },
      { id: 'sess-3' },
    ] as never);
    vi.mocked(prisma.sessions.updateMany).mockResolvedValue({ count: 3 } as never);
    vi.mocked(prisma.refresh_tokens.updateMany).mockResolvedValue({ count: 5 } as never);
    vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);

    const result = await authService.revokeAll(
      { exceptCurrentSession: false },
      'user-uuid-1',
      'sess-1',
      MOCK_META
    );

    expect(result.revokedCount).toBe(3);
    expect(prisma.sessions.updateMany).toHaveBeenCalledOnce();
    expect(prisma.refresh_tokens.updateMany).toHaveBeenCalledOnce();
  });

  it('harus exclude session saat ini jika exceptCurrentSession=true', async () => {
    vi.mocked(prisma.sessions.findMany).mockResolvedValue([
      { id: 'sess-2' },
      { id: 'sess-3' },
    ] as never);
    vi.mocked(prisma.sessions.updateMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(prisma.refresh_tokens.updateMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);

    const result = await authService.revokeAll(
      { exceptCurrentSession: true },
      'user-uuid-1',
      'sess-1',
      MOCK_META
    );

    expect(result.revokedCount).toBe(2);

    // Pastikan where clause untuk findMany include NOT currentSessionId
    expect(prisma.sessions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'sess-1' },
        }),
      })
    );
  });

  it('harus return 0 jika tidak ada session aktif', async () => {
    vi.mocked(prisma.sessions.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);

    const result = await authService.revokeAll(
      { exceptCurrentSession: false },
      'user-uuid-1',
      'sess-1',
      MOCK_META
    );

    expect(result.revokedCount).toBe(0);
    expect(prisma.sessions.updateMany).not.toHaveBeenCalled();
  });
});
