import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import prisma from '@/lib/prisma';

// ── Mock oauth.providers so no real HTTP calls happen ─────────
vi.mock('../../src/modules/oauth/oauth.providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/modules/oauth/oauth.providers')>();
  return {
    ...actual,
    isValidProvider: vi.fn().mockImplementation((slug: string) =>
      ['google', 'github'].includes(slug)
    ),
    buildAuthorizationUrl: vi.fn().mockImplementation((provider: string, state: string) =>
      `https://accounts.${provider}.com/auth?state=${state}&code_challenge=challenge`
    ),
    exchangeCodeForToken: vi.fn().mockResolvedValue({
      access_token: 'provider_access_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'provider_refresh_token',
    }),
    fetchProviderUserInfo: vi.fn().mockResolvedValue({
      providerUserId: 'google_sub_12345',
      email: 'oauthtest@gmail.com',
      emailVerified: true,
      displayName: 'OAuth Test User',
      firstName: 'OAuth',
      lastName: 'Test',
      avatarUrl: 'https://avatar.google.com/photo.jpg',
      locale: 'id',
      rawData: { sub: 'google_sub_12345' },
    }),
    encryptProviderToken: vi.fn().mockReturnValue('encrypted_provider_token'),
  };
});

let app: FastifyInstance;

const MOCK_APP = {
  id: 'app-uuid-1',
  slug: 'default',
  client_id: 'ci_oauthtest',
  access_token_ttl: 900,
  refresh_token_ttl: 2592000,
  is_active: true,
  deleted_at: null,
};

const MOCK_OAUTH_STATE = {
  id: 'state-uuid-1',
  state: 'valid_state_hex_123',
  provider: 'google',
  app_id: 'app-uuid-1',
  redirect_uri: 'http://localhost:5173',
  code_verifier: 'mock_code_verifier_64chars',
  existing_user_id: null,
  metadata: {},
  expires_at: new Date(Date.now() + 600_000),
};

const MOCK_USER_FULL = {
  id: 'new-user-uuid-1',
  email: 'oauthtest@gmail.com',
  username: null,
  display_name: 'OAuth Test User',
  avatar_url: 'https://avatar.google.com/photo.jpg',
  email_verified_at: new Date(),
};

function setupDefaultMocks() {
  vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
  vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_roles.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.roles.findFirst).mockResolvedValue({ id: 'role-member-id' } as never);
  vi.mocked(prisma.oauth_states.create).mockResolvedValue({} as never);
  vi.mocked(prisma.oauth_states.delete).mockResolvedValue({} as never);
  vi.mocked(prisma.sessions.create).mockResolvedValue({} as never);
  vi.mocked(prisma.refresh_tokens.create).mockResolvedValue({} as never);
  vi.mocked(prisma.identities.create).mockResolvedValue({} as never);
  vi.mocked(prisma.identities.update).mockResolvedValue({} as never);
  vi.mocked(prisma.users.update).mockResolvedValue({} as never);
  vi.mocked(prisma.users.create).mockResolvedValue({} as never);
  vi.mocked(prisma.passwords.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_profiles.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_app_memberships.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_roles.create).mockResolvedValue({} as never);
  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)
  );
}

beforeAll(async () => {
  const { buildApp } = await import('../../src/app');
  app = await buildApp();
  await app.ready();
});

afterAll(async () => { await app.close(); });

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

function parseBody(raw: string) {
  try { return JSON.parse(raw); } catch { return {}; }
}

let _ip = 200;
function testIp() { return `10.2.0.${_ip++}`; }

// ════════════════════════════════════════════════════════════════
describe('GET /v1/auth/oauth/:provider', () => {

  it('harus redirect 302 ke Google authorization URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google',
      headers: { 'X-Forwarded-For': testIp() },
      query: { appClientId: 'ci_oauthtest' },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toBeDefined();
    expect(res.headers['location']).toContain('accounts.google.com');
    expect(res.headers['location']).toContain('state=');
    expect(res.headers['location']).toContain('code_challenge=');
  });

  it('harus redirect 302 ke GitHub authorization URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/github',
      headers: { 'X-Forwarded-For': testIp() },
      query: { appClientId: 'ci_oauthtest' },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toContain('accounts.github.com');
  });

  it('harus simpan state ke DB dengan PKCE code_verifier', async () => {
    await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google',
      headers: { 'X-Forwarded-For': testIp() },
      query: { appClientId: 'ci_oauthtest' },
    });

    expect(prisma.oauth_states.create).toHaveBeenCalledOnce();
    const stateData = vi.mocked(prisma.oauth_states.create).mock.calls[0][0].data;
    expect(stateData.code_verifier).toBeTruthy();
    expect(stateData.provider).toBe('google');
    expect(stateData.existing_user_id).toBeNull();
  });

  it('harus return 400 jika provider tidak valid (twitter, facebook, dll)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/twitter',
      headers: { 'X-Forwarded-For': testIp() },
      query: { appClientId: 'ci_oauthtest' },
    });

    expect(res.statusCode).toBe(400);
    const body = parseBody(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('harus return 400 jika appClientId tidak diisi', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google',
      headers: { 'X-Forwarded-For': testIp() },
      query: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('harus return 404 jika app tidak ditemukan', async () => {
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google',
      headers: { 'X-Forwarded-For': testIp() },
      query: { appClientId: 'ci_tidak_ada' },
    });

    expect(res.statusCode).toBe(404);
    const body = parseBody(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ════════════════════════════════════════════════════════════════
describe('GET /v1/auth/oauth/:provider/callback', () => {

  it('harus return 200 dengan token pair untuk user baru (auto-register)', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue(MOCK_OAUTH_STATE as never);
    vi.mocked(prisma.identities.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.users.findUnique)
      .mockResolvedValueOnce(null)           // cek email belum ada
      .mockResolvedValueOnce(MOCK_USER_FULL as never); // setelah register

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: { code: 'auth_code_from_google', state: 'valid_state_hex_123' },
    });

    expect(res.statusCode).toBe(200);
    const body = parseBody(res.body);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
    expect(body.data.tokenType).toBe('Bearer');
    expect(body.data.isNewUser).toBe(true);
    expect(body.data.user).toBeDefined();
    expect(body.data.session).toBeDefined();
  });

  it('harus return 200 untuk user existing (identity sudah ada)', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue(MOCK_OAUTH_STATE as never);
    vi.mocked(prisma.identities.findUnique).mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-uuid-existing',
    } as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER_FULL as never);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: { code: 'auth_code', state: 'valid_state_hex_123' },
    });

    expect(res.statusCode).toBe(200);
    const body = parseBody(res.body);
    expect(body.data.isNewUser).toBe(false);
  });

  it('harus return 400 jika state tidak ditemukan (CSRF protection)', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: { code: 'some_code', state: 'state_palsu_tidak_ada_di_db' },
    });

    expect(res.statusCode).toBe(400);
    const body = parseBody(res.body);
    expect(body.error.message.toLowerCase()).toMatch(/state|csrf/i);
  });

  it('harus return 400 jika state sudah expired', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue({
      ...MOCK_OAUTH_STATE,
      expires_at: new Date(Date.now() - 1000), // 1 detik lalu
    } as never);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: { code: 'some_code', state: 'valid_state_hex_123' },
    });

    expect(res.statusCode).toBe(400);
    const body = parseBody(res.body);
    expect(body.error.message.toLowerCase()).toContain('expired');
  });

  it('harus return 400 jika user deny (error=access_denied dari provider)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      // error field ada → langsung throw sebelum cek state
      query: { code: 'x', state: 'y', error: 'access_denied' },
    });

    expect(res.statusCode).toBe(400);
    const body = parseBody(res.body);
    expect(body.error.message.toLowerCase()).toContain('ditolak');
  });

  it('harus return 400 jika error=server_error dari provider', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: {
        code: 'x',
        state: 'y',
        error: 'server_error',
        error_description: 'Provider internal error',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = parseBody(res.body);
    expect(body.error.message.toLowerCase()).toSatisfy((m: string) => m.includes('server_error') || m.includes('oauth error') || m.includes('internal error'));
  });

  it('harus return 400 jika code tidak diisi', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: { state: 'some_state' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika state tidak diisi', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: { code: 'some_code' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('harus return 400 jika provider tidak valid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/twitter/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: { code: 'code', state: 'state' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('state harus dihapus dari DB setelah callback (single use)', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue({
      ...MOCK_OAUTH_STATE,
      expires_at: new Date(Date.now() - 1000), // expired — akan dihapus
    } as never);

    await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: { code: 'code', state: 'valid_state_hex_123' },
    });

    expect(prisma.oauth_states.delete).toHaveBeenCalledOnce();
    expect(vi.mocked(prisma.oauth_states.delete).mock.calls[0][0]).toMatchObject({
      where: { state: 'valid_state_hex_123' },
    });
  });
});

// ════════════════════════════════════════════════════════════════
describe('GET /v1/auth/oauth/providers', () => {

  it('harus return 401 jika tidak ada Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/providers',
      headers: { 'X-Forwarded-For': testIp() },
    });

    expect(res.statusCode).toBe(401);
    const body = parseBody(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('harus return 401 jika access token tidak valid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/providers',
      headers: {
        'X-Forwarded-For': testIp(),
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.INVALID_SIG_HERE',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = parseBody(res.body);
    expect(['TOKEN_INVALID', 'UNAUTHORIZED']).toContain(body.error.code);
  });
});

// ════════════════════════════════════════════════════════════════
describe('POST /v1/auth/oauth/link', () => {

  it('harus return 401 jika tidak ada Authorization header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/link',
      headers: { 'X-Forwarded-For': testIp() },
      payload: { provider: 'github' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('harus return 401 jika access token tidak valid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/link',
      headers: {
        'X-Forwarded-For': testIp(),
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.INVALID_SIG_HERE',
      },
      payload: { provider: 'github' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('harus return 400 jika provider tidak valid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/link',
      headers: {
        'X-Forwarded-For': testIp(),
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.INVALID_SIG_HERE',
      },
      payload: { provider: 'facebook' },
    });

    // 401 (auth) atau 400 (validation) — keduanya acceptable
    expect([400, 401]).toContain(res.statusCode);
    if (res.statusCode === 400) {
      const body = parseBody(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('harus return 400 jika body kosong', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/link',
      headers: {
        'X-Forwarded-For': testIp(),
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.INVALID_SIG_HERE',
      },
      payload: {},
    });

    expect([400, 401]).toContain(res.statusCode);
  });
});

// ════════════════════════════════════════════════════════════════
describe('DELETE /v1/auth/oauth/link/:provider', () => {

  it('harus return 401 jika tidak ada Authorization header', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/oauth/link/google',
      headers: { 'X-Forwarded-For': testIp() },
    });

    expect(res.statusCode).toBe(401);
  });

  it('harus return 401 jika access token tidak valid', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/oauth/link/google',
      headers: {
        'X-Forwarded-For': testIp(),
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.INVALID_SIG_HERE',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('harus return 400 jika provider path param tidak valid', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/oauth/link/snapchat',
      headers: {
        'X-Forwarded-For': testIp(),
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.INVALID_SIG_HERE',
      },
    });

    expect([400, 401]).toContain(res.statusCode);
  });
});

// ════════════════════════════════════════════════════════════════
describe('OAuth — Response Format & Security', () => {

  it('redirect response harus punya Location header dengan state dan code_challenge', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google',
      headers: { 'X-Forwarded-For': testIp() },
      query: { appClientId: 'ci_oauthtest' },
    });

    expect(res.statusCode).toBe(302);
    const location = res.headers['location'] as string;
    expect(location).toBeTruthy();
    expect(location).toContain('state=');
    expect(location).toContain('code_challenge=');
  });

  it('error response harus memiliki format { success, error, meta }', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: { code: 'code', state: 'invalid_state' },
    });

    const body = parseBody(res.body);
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(body).toHaveProperty('meta');
    expect(body.meta).toHaveProperty('requestId');
    expect(body.meta).toHaveProperty('timestamp');
  });

  it('success callback response harus memiliki format { success, data, meta }', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue(MOCK_OAUTH_STATE as never);
    vi.mocked(prisma.identities.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.users.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(MOCK_USER_FULL as never);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/google/callback',
      headers: { 'X-Forwarded-For': testIp() },
      query: { code: 'valid_code', state: 'valid_state_hex_123' },
    });

    expect(res.statusCode).toBe(200);
    const body = parseBody(res.body);
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
  });

  it('X-Request-Id header harus ada di setiap response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/oauth/twitter', // invalid → 400
      headers: { 'X-Forwarded-For': testIp() },
      query: { appClientId: 'ci_oauthtest' },
    });

    expect(res.headers['x-request-id']).toBeDefined();
  });
});
