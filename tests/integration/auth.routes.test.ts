import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import prisma from '@/lib/prisma';

let app: FastifyInstance;

// ── Fixtures ──────────────────────────────────────────────────
const MOCK_APP = {
  id: 'app-uuid-1',
  slug: 'default',
  client_id: 'ci_integrationtest',
  access_token_ttl: 900,
  refresh_token_ttl: 2592000,
  is_active: true,
  deleted_at: null,
};

// bcrypt hash untuk 'Password123' dengan rounds=12
// Dipakai agar real bcrypt.compare() berjalan di integration test
const REAL_BCRYPT_HASH = '$2b$12$0POS5pMz6OMAGI9wz2zChOBNH2aAUzHuHykSncyS7ewIsm6pc1Ly2';

const MOCK_USER = {
  id: 'user-uuid-int-1',
  email: 'integration@example.com',
  username: 'integrationuser',
  display_name: 'Integration User',
  avatar_url: null,
  is_active: true,
  is_banned: false,
  ban_reason: null,
  deleted_at: null,
  email_verified_at: new Date(),
  passwords: { password_hash: REAL_BCRYPT_HASH, must_change: false },
};

function setupDefaultMocks() {
  vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
  vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_roles.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.roles.findFirst).mockResolvedValue({ id: 'role-member-id' } as never);

  // $transaction — eksekusi callback langsung dengan prisma sebagai tx
  vi.mocked(prisma.$transaction).mockImplementation(
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
  vi.mocked(prisma.users.update).mockResolvedValue({} as never);
  vi.mocked(prisma.sessions.update).mockResolvedValue({} as never);
  vi.mocked(prisma.refresh_tokens.update).mockResolvedValue({} as never);
  vi.mocked(prisma.refresh_tokens.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.sessions.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.sessions.findMany).mockResolvedValue([] as never);
}

beforeAll(async () => {
  const { buildApp } = await import('../../src/app');
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// Helper: parse JSON body safely
// Counter untuk unique test IPs — mencegah rate limiting antar test
let _testIpCounter = 1;
function testIp() { return `10.0.0.${_testIpCounter++}`; }

function parseBody(raw: string) {
  try { return JSON.parse(raw); } catch { return {}; }
}

// ════════════════════════════════════════════════════════════════
describe('POST /v1/auth/register', () => {

  it('harus return 201 dengan data user baru', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: {
        appClientId: 'ci_integrationtest',
        email: 'newuser@example.com',
        password: 'Password123',
        displayName: 'New User',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = parseBody(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('newuser@example.com');
    expect(body.data.user.emailVerified).toBe(false);
    expect(body.data.message).toContain('Registrasi berhasil');
  });

  it('harus return 409 jika email sudah terdaftar', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({ id: 'existing', deleted_at: null } as never);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: {
        appClientId: 'ci_integrationtest',
        email: 'existing@example.com',
        password: 'Password123',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = parseBody(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('harus return 400 jika email tidak valid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: {
        appClientId: 'ci_integrationtest',
        email: 'bukan-email',
        password: 'Password123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = parseBody(res.body);
    expect(body.error?.code ?? body.error).toBeTruthy();
  });

  it('harus return 400 jika password terlalu pendek', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: 'ci_integrationtest', email: 'test@example.com', password: '123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika password tidak ada huruf besar dan angka', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: 'ci_integrationtest', email: 'test@example.com', password: 'weakpassword' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika appClientId kosong', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: '', email: 'test@example.com', password: 'Password123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika body kosong', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('success response harus ada meta.requestId dan meta.timestamp', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: 'ci_integrationtest', email: 'meta@example.com', password: 'Password123' },
    });

    const body = parseBody(res.body);
    expect(body.meta?.requestId).toBeDefined();
    expect(body.meta?.timestamp).toBeDefined();
  });

  it('harus return 404 jika appClientId tidak ditemukan', async () => {
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: 'ci_tidakada', email: 'x@example.com', password: 'Password123' },
    });

    expect(res.statusCode).toBe(404);
    const body = parseBody(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ════════════════════════════════════════════════════════════════
describe('POST /v1/auth/login', () => {

  it('harus return 200 dengan tokens dan user data', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER as never);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'X-Forwarded-For': testIp() },
      payload: {
        appClientId: 'ci_integrationtest',
        email: 'integration@example.com',
        password: 'Password123',
        deviceType: 'api',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = parseBody(res.body);
    expect(body.success).toBe(true);
    expect(body.data.tokens.accessToken).toBeDefined();
    expect(body.data.tokens.refreshToken).toBeDefined();
    expect(body.data.tokens.tokenType).toBe('Bearer');
    expect(body.data.tokens.expiresIn).toBe(900);
    expect(body.data.user.email).toBe('integration@example.com');
    expect(body.data.session.id).toBeDefined();
  });

  it('harus return 401 jika user tidak ditemukan', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'X-Forwarded-For': testIp() },
      payload: {
        appClientId: 'ci_integrationtest',
        email: 'notexist@example.com',
        password: 'Password123',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = parseBody(res.body);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('harus return 401 jika password salah', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER,
      passwords: {
        // Hash dari 'DifferentPassword' — tidak cocok dengan 'WrongPassword'
        password_hash: '$2b$12$wronghashvalueXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        must_change: false,
      },
    } as never);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'X-Forwarded-For': testIp() },
      payload: {
        appClientId: 'ci_integrationtest',
        email: 'integration@example.com',
        password: 'WrongPassword123',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('harus return 403 jika user di-ban', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({
      ...MOCK_USER,
      is_banned: true,
      ban_reason: 'Melanggar TOS',
    } as never);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'X-Forwarded-For': testIp() },
      payload: {
        appClientId: 'ci_integrationtest',
        email: 'integration@example.com',
        password: 'Password123',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = parseBody(res.body);
    expect(body.error.code).toBe('ACCOUNT_BANNED');
  });

  it('harus return 400 jika email tidak diisi', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: 'ci_integrationtest', password: 'Password123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika password tidak diisi', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: 'ci_integrationtest', email: 'test@test.com' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
describe('POST /v1/auth/logout', () => {

  it('harus return 401 jika tidak ada Authorization header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: 'some_token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('harus return 401 jika access token invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { Authorization: 'Bearer invalid_token_here' },
      payload: { refreshToken: 'some_token' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════
describe('POST /v1/auth/refresh', () => {

  it('harus return 400 jika refreshToken tidak diisi', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: 'ci_integrationtest' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika appClientId tidak diisi', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { refreshToken: 'some_token' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('harus return 401 jika refresh token tidak ditemukan di DB', async () => {
    vi.mocked(prisma.refresh_tokens.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { refreshToken: 'nonexistent_token', appClientId: 'ci_integrationtest' },
    });

    expect(res.statusCode).toBe(401);
    const body = parseBody(res.body);
    expect(body.error.code).toBe('TOKEN_INVALID');
  });

  it('harus return 401 jika refresh token sudah direvoke', async () => {
    vi.mocked(prisma.refresh_tokens.findUnique).mockResolvedValue({
      id: 'rt-1',
      session_id: 'sess-1',
      user_id: 'user-1',
      app_id: 'app-1',
      family: 'fam-1',
      token_hash: 'hash_nonexistent_token',
      used_at: null,
      expires_at: new Date(Date.now() + 9999999),
      revoked_at: new Date(), // sudah direvoke
    } as never);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { refreshToken: 'revoked_token', appClientId: 'ci_integrationtest' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════
describe('POST /v1/auth/revoke-all', () => {

  it('harus return 401 jika tidak ada Authorization header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/revoke-all',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════
describe('Auth Routes — Response Format & Headers', () => {

  it('success response dari register harus punya format { success, data, meta }', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: 'ci_integrationtest', email: 'fmt@example.com', password: 'Password123' },
    });

    const body = parseBody(res.body);
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(body.meta).toHaveProperty('timestamp');
    expect(body.meta).toHaveProperty('requestId');
  });

  it('error response dari AppError harus punya format { success, error, meta }', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue({ id: 'ex', deleted_at: null } as never);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: 'ci_integrationtest', email: 'dup@example.com', password: 'Password123' },
    });

    const body = parseBody(res.body);
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(body).toHaveProperty('meta');
  });

  it('response harus ada X-Request-Id header', async () => {
    vi.mocked(prisma.users.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { appClientId: 'ci_integrationtest', email: 'hdr@example.com', password: 'Password123' },
    });

    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('404 untuk route yang tidak ada harus punya format konsisten', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/auth/route-tidak-ada' });

    expect(res.statusCode).toBe(404);
    const body = parseBody(res.body);
    expect(body).toHaveProperty('success', false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
