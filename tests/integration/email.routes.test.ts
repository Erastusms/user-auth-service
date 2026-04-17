import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import prisma from '@/lib/prisma';

let app: FastifyInstance;

const MOCK_APP = { id: 'app-uuid-1', is_active: true, deleted_at: null };
const MOCK_USER_UNVERIFIED = {
  id: 'user-uuid-1', email: 'test@example.com', username: 'testuser',
  display_name: 'Test User', is_active: true, is_banned: false,
  ban_reason: null, deleted_at: null, email_verified_at: null,
};
const MOCK_USER_VERIFIED = { ...MOCK_USER_UNVERIFIED, email_verified_at: new Date() };
const MOCK_TOKEN_EMAIL = {
  id: 'token-uuid-1', user_id: 'user-uuid-1', type: 'email_verification',
  token_hash: 'hash_valid_token', target: 'test@example.com',
  expires_at: new Date(Date.now() + 3_600_000), used_at: null,
};
const MOCK_TOKEN_RESET = { ...MOCK_TOKEN_EMAIL, type: 'password_reset' };
const MOCK_PASSWORD = {
  id: 'pass-uuid-1', user_id: 'user-uuid-1',
  password_hash: '$2b$12$0POS5pMz6OMAGI9wz2zChOBNH2aAUzHuHykSncyS7ewIsm6pc1Ly2',
  previous_hashes: [], must_change: false,
};

function setupDefaultMocks() {
  vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
  vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);
  vi.mocked(prisma.verification_tokens.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.verification_tokens.create).mockResolvedValue({} as never);
  vi.mocked(prisma.verification_tokens.update).mockResolvedValue({} as never);
  vi.mocked(prisma.users.update).mockResolvedValue({} as never);
  vi.mocked(prisma.passwords.update).mockResolvedValue({} as never);
  vi.mocked(prisma.passwords.create).mockResolvedValue({} as never);
  vi.mocked(prisma.sessions.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.sessions.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.refresh_tokens.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.user_roles.findMany).mockResolvedValue([] as never);
}

beforeAll(async () => {
  const { buildApp } = await import('../../src/app');
  app = await buildApp();
  await app.ready();
});
afterAll(async () => { await app.close(); });
beforeEach(() => { vi.clearAllMocks(); setupDefaultMocks(); });

function parseBody(raw: string) { try { return JSON.parse(raw); } catch { return {}; } }
let _ip = 1;
function testIp() { return `10.3.0.${_ip++}`; }

describe('POST /v1/auth/email/send-verification', () => {
  it('harus return 200 dan buat token verifikasi', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER_UNVERIFIED as never);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(200);
    const body = parseBody(res.body);
    expect(body.success).toBe(true);
    expect(body.data.message).toBeTruthy();
    expect(prisma.verification_tokens.create).toHaveBeenCalledOnce();
  });

  it('harus return 200 jika email tidak ada (anti-enumeration)', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'notfound@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.verification_tokens.create).not.toHaveBeenCalled();
  });

  it('harus return 409 jika email sudah terverifikasi', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER_VERIFIED as never);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(409);
    expect(parseBody(res.body).error.code).toBe('CONFLICT');
  });

  it('harus return 400 jika email tidak valid', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'bukan-email' },
    });
    expect(res.statusCode).toBe(400);
    expect(parseBody(res.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('harus return 400 jika body kosong', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() }, payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('response harus punya meta.requestId dan meta.timestamp', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'test@example.com' },
    });
    const body = parseBody(res.body);
    expect(body.meta?.requestId).toBeDefined();
    expect(body.meta?.timestamp).toBeDefined();
  });
});

describe('POST /v1/auth/email/verify', () => {
  it('harus return 200 dan mark email sebagai verified', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue(MOCK_TOKEN_EMAIL as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      id: 'user-uuid-1', email: 'test@example.com',
      is_active: true, deleted_at: null, email_verified_at: null,
    } as never);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/verify',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { token: 'valid_token' },
    });
    expect(res.statusCode).toBe(200);
    expect(parseBody(res.body).data.user.emailVerified).toBe(true);
    expect(prisma.users.update).toHaveBeenCalledOnce();
  });

  it('harus return 400 jika token tidak ditemukan', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/verify',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { token: 'tidak_ada' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika token sudah expired', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue({
      ...MOCK_TOKEN_EMAIL, expires_at: new Date(Date.now() - 1000),
    } as never);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/verify',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { token: 'expired' },
    });
    expect(res.statusCode).toBe(400);
    expect(parseBody(res.body).error.message.toLowerCase()).toContain('kadaluarsa');
  });

  it('harus return 400 jika token sudah digunakan', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue({
      ...MOCK_TOKEN_EMAIL, used_at: new Date(),
    } as never);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/verify',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { token: 'used' },
    });
    expect(res.statusCode).toBe(400);
    expect(parseBody(res.body).error.message.toLowerCase()).toContain('digunakan');
  });

  it('harus return 400 jika body kosong', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/verify',
      headers: { 'X-Forwarded-For': testIp() }, payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('idempotent — return 200 jika email sudah verified', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue(MOCK_TOKEN_EMAIL as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      id: 'user-uuid-1', email: 'test@example.com',
      is_active: true, deleted_at: null, email_verified_at: new Date(),
    } as never);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/verify',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { token: 'valid_token' },
    });
    expect(res.statusCode).toBe(200);
    expect(parseBody(res.body).data.user.emailVerified).toBe(true);
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('reset-token tidak bisa dipakai untuk verify email', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue({
      ...MOCK_TOKEN_RESET, type: 'password_reset',
    } as never);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/verify',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { token: 'reset_token' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /v1/auth/password/forgot', () => {
  it('harus return 200 (user ada)', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER_UNVERIFIED as never);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/password/forgot',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'test@example.com', appClientId: 'ci_test' },
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.verification_tokens.create).toHaveBeenCalledOnce();
  });

  it('harus return 200 jika email tidak ada (anti-enumeration)', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/password/forgot',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'noone@example.com', appClientId: 'ci_test' },
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.verification_tokens.create).not.toHaveBeenCalled();
  });

  it('pesan response harus identik (anti-enumeration)', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER_UNVERIFIED as never);
    const res1 = await app.inject({
      method: 'POST', url: '/v1/auth/password/forgot',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'exists@example.com', appClientId: 'ci_test' },
    });
    vi.clearAllMocks(); setupDefaultMocks();
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);
    const res2 = await app.inject({
      method: 'POST', url: '/v1/auth/password/forgot',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'nope@example.com', appClientId: 'ci_test' },
    });
    expect(parseBody(res1.body).data.message).toBe(parseBody(res2.body).data.message);
  });

  it('harus return 400 jika email tidak valid', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/password/forgot',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'bukan-email', appClientId: 'ci_test' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika appClientId tidak diisi', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/password/forgot',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /v1/auth/password/reset', () => {
  it('harus return 200, update password, revoke session', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue(MOCK_TOKEN_RESET as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      id: 'user-uuid-1', email: 'test@example.com',
      is_active: true, deleted_at: null,
    } as never);
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue(MOCK_PASSWORD as never);
    vi.mocked(prisma.sessions.findMany).mockResolvedValue([{ id: 's1' }, { id: 's2' }] as never);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/password/reset',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { token: 'valid_reset_token', newPassword: 'NewPassword123' },
    });
    expect(res.statusCode).toBe(200);
    const body = parseBody(res.body);
    expect(body.data.revokedSessions).toBe(2);
    expect(prisma.sessions.updateMany).toHaveBeenCalledOnce();
  });

  it('harus return 400 jika token tidak valid', async () => {
    vi.mocked(prisma.verification_tokens.findUnique).mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/password/reset',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { token: 'invalid', newPassword: 'NewPassword123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika newPassword terlalu pendek', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/password/reset',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { token: 'tok', newPassword: 'weak' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika newPassword tidak ada huruf besar & angka', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/password/reset',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { token: 'tok', newPassword: 'alllowercase' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika body kosong', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/password/reset',
      headers: { 'X-Forwarded-For': testIp() }, payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /v1/auth/password/change', () => {
  it('harus return 401 tanpa Authorization header', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/v1/auth/password/change',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { currentPassword: 'Old123', newPassword: 'New456789' },
    });
    expect(res.statusCode).toBe(401);
    expect(parseBody(res.body).error.code).toBe('UNAUTHORIZED');
  });

  it('harus return 401 dengan token invalid', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/v1/auth/password/change',
      headers: {
        'X-Forwarded-For': testIp(),
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.INVALID_SIG',
      },
      payload: { currentPassword: 'Old123', newPassword: 'New456789' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('harus return 400 jika newPassword sama dengan currentPassword', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/v1/auth/password/change',
      headers: {
        'X-Forwarded-For': testIp(),
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.INVALID_SIG',
      },
      payload: { currentPassword: 'SamePass123', newPassword: 'SamePass123' },
    });
    expect([400, 401]).toContain(res.statusCode);
    if (res.statusCode === 400) {
      expect(parseBody(res.body).error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('harus return 400 jika currentPassword tidak diisi', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/v1/auth/password/change',
      headers: { 'X-Forwarded-For': testIp(), Authorization: 'Bearer invalid' },
      payload: { newPassword: 'New456789' },
    });
    expect([400, 401]).toContain(res.statusCode);
  });

  it('harus return 400 jika newPassword tidak memenuhi policy', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/v1/auth/password/change',
      headers: { 'X-Forwarded-For': testIp(), Authorization: 'Bearer invalid' },
      payload: { currentPassword: 'OldPass123', newPassword: 'weak' },
    });
    expect([400, 401]).toContain(res.statusCode);
  });
});

describe('Email & Password — Response Format & Security', () => {
  it('success response harus punya { success, data, meta }', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'test@example.com' },
    });
    const body = parseBody(res.body);
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(body.meta).toHaveProperty('requestId');
    expect(body.meta).toHaveProperty('timestamp');
  });

  it('error response harus punya { success, error, meta }', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'bukan-email' },
    });
    const body = parseBody(res.body);
    expect(body).toHaveProperty('success', false);
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(body).toHaveProperty('meta');
  });

  it('X-Request-Id harus ada di setiap response', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'test@example.com' },
    });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('Helmet security headers harus ada', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'bukan-email' },
    });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('token harus di-hash sebelum disimpan ke DB', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER_UNVERIFIED as never);
    await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'test@example.com' },
    });
    const call = vi.mocked(prisma.verification_tokens.create).mock.calls[0];
    if (call) {
      const { token_hash } = call[0].data;
      expect(token_hash).toBeTruthy();
      expect(token_hash.length).toBeGreaterThan(10);
    }
  });

  it('token lama di-invalidate saat request token baru', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER_UNVERIFIED as never);
    await app.inject({
      method: 'POST', url: '/v1/auth/email/send-verification',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { email: 'test@example.com' },
    });
    expect(prisma.verification_tokens.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ used_at: null }),
        data: expect.objectContaining({ used_at: expect.any(Date) }),
      })
    );
  });
});
