import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock semua external dependencies ─────────────────────────
vi.mock('@/lib/crypto', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2b$12$mockhashedpassword'),
  generateSecureToken: vi.fn().mockReturnValue('mock_secure_token_48'),
  hashToken: vi.fn().mockImplementation((t: string) => `hash_${t}`),
  encrypt: vi.fn().mockReturnValue('encrypted_token'),
  decrypt: vi.fn().mockReturnValue('decrypted_token'),
}));

vi.mock('@/lib/jwt', () => ({
  signAccessToken: vi.fn().mockReturnValue('mock_access_token'),
}));

vi.mock('@/lib/pkce', () => ({
  generateCodeVerifier: vi.fn().mockReturnValue('mock_code_verifier_64chars'),
  generateCodeChallenge: vi.fn().mockReturnValue('mock_code_challenge'),
  generateOAuthState: vi.fn().mockReturnValue('mock_state_hex'),
}));

vi.mock('../../src/modules/oauth/oauth.providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/modules/oauth/oauth.providers')>();
  return {
    ...actual,
    isValidProvider: vi.fn().mockReturnValue(true),
    buildAuthorizationUrl: vi.fn().mockReturnValue('https://accounts.google.com/auth?state=mock'),
    exchangeCodeForToken: vi.fn().mockResolvedValue({
      access_token: 'provider_access_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'provider_refresh_token',
    }),
    fetchProviderUserInfo: vi.fn().mockResolvedValue({
      providerUserId: 'google_12345',
      email: 'oauthuser@gmail.com',
      emailVerified: true,
      displayName: 'OAuth User',
      firstName: 'OAuth',
      lastName: 'User',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar.jpg',
      locale: 'id',
      rawData: { sub: 'google_12345', email: 'oauthuser@gmail.com' },
    }),
    encryptProviderToken: vi.fn().mockReturnValue('encrypted_provider_token'),
  };
});

import * as oauthService from '../../src/modules/oauth/oauth.service';
import prisma from '@/lib/prisma';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from '../../src/shared/errors';

// ── Fixtures ──────────────────────────────────────────────────
const MOCK_APP = {
  id: 'app-uuid-1',
  slug: 'default',
  client_id: 'ci_test',
  access_token_ttl: 900,
  refresh_token_ttl: 2592000,
  is_active: true,
  deleted_at: null,
};

const MOCK_META = { ip: '127.0.0.1', userAgent: 'Vitest/Test' };

const MOCK_OAUTH_STATE = {
  id: 'state-uuid-1',
  state: 'mock_state_hex',
  provider: 'google',
  app_id: 'app-uuid-1',
  redirect_uri: 'http://localhost:5173',
  code_verifier: 'mock_code_verifier_64chars',
  existing_user_id: null,
  metadata: {},
  expires_at: new Date(Date.now() + 600_000), // valid
};

const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'oauthuser@gmail.com',
  username: null,
  display_name: 'OAuth User',
  avatar_url: 'https://avatar.jpg',
  email_verified_at: new Date(),
};

function setupCommonMocks() {
  vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
  vi.mocked(prisma.audit_logs.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_roles.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.roles.findFirst).mockResolvedValue({ id: 'role-member-id' } as never);
  vi.mocked(prisma.sessions.create).mockResolvedValue({} as never);
  vi.mocked(prisma.refresh_tokens.create).mockResolvedValue({} as never);
  vi.mocked(prisma.users.update).mockResolvedValue({} as never);

  vi.mocked(prisma.$transaction).mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)
  );
  vi.mocked(prisma.users.create).mockResolvedValue({} as never);
  vi.mocked(prisma.passwords.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_profiles.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_app_memberships.create).mockResolvedValue({} as never);
  vi.mocked(prisma.user_roles.create).mockResolvedValue({} as never);
  vi.mocked(prisma.identities.create).mockResolvedValue({} as never);
  vi.mocked(prisma.identities.update).mockResolvedValue({} as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupCommonMocks();
});

// ════════════════════════════════════════════════════════════════
describe('oauthService.initiateOAuth', () => {
  it('harus return authorization URL dan simpan state ke DB', async () => {
    vi.mocked(prisma.oauth_states.create).mockResolvedValue({} as never);

    const url = await oauthService.initiateOAuth(
      'google',
      { appClientId: 'ci_test' },
      { ip: '127.0.0.1' }
    );

    expect(typeof url).toBe('string');
    expect(url).toContain('state=');
    expect(prisma.oauth_states.create).toHaveBeenCalledOnce();

    const createCall = vi.mocked(prisma.oauth_states.create).mock.calls[0][0];
    expect(createCall.data.provider).toBe('google');
    expect(createCall.data.code_verifier).toBe('mock_code_verifier_64chars');
    expect(createCall.data.existing_user_id).toBeNull();
  });

  it('harus set existing_user_id jika user sudah login (link mode)', async () => {
    vi.mocked(prisma.oauth_states.create).mockResolvedValue({} as never);

    await oauthService.initiateOAuth(
      'github',
      { appClientId: 'ci_test' },
      { ip: '127.0.0.1', existingUserId: 'user-uuid-existing' }
    );

    const createCall = vi.mocked(prisma.oauth_states.create).mock.calls[0][0];
    expect(createCall.data.existing_user_id).toBe('user-uuid-existing');
  });

  it('harus throw BadRequestError jika provider tidak valid', async () => {
    const { isValidProvider } = await import('../../src/modules/oauth/oauth.providers');
    vi.mocked(isValidProvider).mockReturnValueOnce(false);

    await expect(
      oauthService.initiateOAuth('twitter', { appClientId: 'ci_test' }, { ip: '127.0.0.1' })
    ).rejects.toThrow(BadRequestError);
  });

  it('harus throw NotFoundError jika app tidak ditemukan', async () => {
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(null);

    await expect(
      oauthService.initiateOAuth('google', { appClientId: 'ci_invalid' }, { ip: '127.0.0.1' })
    ).rejects.toThrow(NotFoundError);
  });

  it('state yang disimpan harus expire dalam 10 menit', async () => {
    vi.mocked(prisma.oauth_states.create).mockResolvedValue({} as never);
    const before = new Date(Date.now() + 9 * 60 * 1000);
    const after = new Date(Date.now() + 11 * 60 * 1000);

    await oauthService.initiateOAuth('google', { appClientId: 'ci_test' }, { ip: '127.0.0.1' });

    const expiresAt = vi.mocked(prisma.oauth_states.create).mock.calls[0][0].data.expires_at as Date;
    expect(expiresAt.getTime()).toBeGreaterThan(before.getTime());
    expect(expiresAt.getTime()).toBeLessThan(after.getTime());
  });
});

// ════════════════════════════════════════════════════════════════
describe('oauthService.handleOAuthCallback — Login/Register path', () => {

  it('harus register user baru jika identity dan email belum ada', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue(MOCK_OAUTH_STATE as never);
    vi.mocked(prisma.oauth_states.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.identities.findUnique).mockResolvedValue(null); // identity belum ada
    vi.mocked(prisma.users.findUnique)
      .mockResolvedValueOnce(null) // user by email tidak ada
      .mockResolvedValueOnce(MOCK_USER as never); // user setelah dibuat

    const result = await oauthService.handleOAuthCallback('google', {
      code: 'auth_code_from_google',
      state: 'mock_state_hex',
    }, MOCK_META);

    expect(result.isNewUser).toBe(true);
    expect(result.accessToken).toBeDefined();
    expect(result.accessToken).toBe('mock_access_token');
    expect(prisma.$transaction).toHaveBeenCalledOnce(); // auto-register dalam transaction
  });

  it('harus login user existing jika identity sudah ada', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue(MOCK_OAUTH_STATE as never);
    vi.mocked(prisma.oauth_states.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.identities.findUnique).mockResolvedValue({
      id: 'identity-uuid-1',
      user_id: 'user-uuid-1',
    } as never);
    vi.mocked(prisma.identities.update).mockResolvedValue({} as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER as never);

    const result = await oauthService.handleOAuthCallback('google', {
      code: 'auth_code',
      state: 'mock_state_hex',
    }, MOCK_META);

    expect(result.isNewUser).toBe(false);
    expect(result.user.email).toBe('oauthuser@gmail.com');
    expect(prisma.identities.update).toHaveBeenCalledOnce(); // sync data
  });

  it('harus link ke existing user jika email sudah terdaftar', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue(MOCK_OAUTH_STATE as never);
    vi.mocked(prisma.oauth_states.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.identities.findUnique).mockResolvedValue(null); // identity belum ada
    vi.mocked(prisma.users.findUnique)
      .mockResolvedValueOnce({ id: 'user-uuid-existing', deleted_at: null } as never) // email match
      .mockResolvedValueOnce(MOCK_USER as never);
    vi.mocked(prisma.identities.create).mockResolvedValue({} as never);

    const result = await oauthService.handleOAuthCallback('google', {
      code: 'auth_code',
      state: 'mock_state_hex',
    }, MOCK_META);

    expect(result.isNewUser).toBe(false);
    expect(prisma.identities.create).toHaveBeenCalledOnce(); // link ke existing
    expect(prisma.$transaction).not.toHaveBeenCalled(); // bukan auto-register
  });

  it('harus throw BadRequestError jika state tidak ditemukan (CSRF)', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue(null);

    await expect(
      oauthService.handleOAuthCallback('google', {
        code: 'auth_code',
        state: 'state_yang_tidak_ada',
      }, MOCK_META)
    ).rejects.toThrow(BadRequestError);
  });

  it('harus throw BadRequestError jika state sudah expired', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue({
      ...MOCK_OAUTH_STATE,
      expires_at: new Date(Date.now() - 1000), // sudah expired
    } as never);
    vi.mocked(prisma.oauth_states.delete).mockResolvedValue({} as never);

    await expect(
      oauthService.handleOAuthCallback('google', {
        code: 'auth_code',
        state: 'mock_state_hex',
      }, MOCK_META)
    ).rejects.toThrow(BadRequestError);
  });

  it('harus throw BadRequestError jika provider error dari provider', async () => {
    await expect(
      oauthService.handleOAuthCallback('google', {
        code: 'auth_code',
        state: 'mock_state_hex',
        error: 'access_denied',
        error_description: 'User denied access',
      }, MOCK_META)
    ).rejects.toThrow(BadRequestError);
  });

  it('harus throw BadRequestError jika provider tidak valid', async () => {
    const { isValidProvider } = await import('../../src/modules/oauth/oauth.providers');
    vi.mocked(isValidProvider).mockReturnValueOnce(false);

    await expect(
      oauthService.handleOAuthCallback('twitter', {
        code: 'auth_code',
        state: 'mock_state_hex',
      }, MOCK_META)
    ).rejects.toThrow(BadRequestError);
  });

  it('harus hapus state dari DB setelah dipakai (single use)', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue({
      ...MOCK_OAUTH_STATE,
      expires_at: new Date(Date.now() - 1000),
    } as never);
    vi.mocked(prisma.oauth_states.delete).mockResolvedValue({} as never);

    try {
      await oauthService.handleOAuthCallback('google', {
        code: 'auth_code',
        state: 'mock_state_hex',
      }, MOCK_META);
    } catch {
      // expired — tidak apa
    }

    expect(prisma.oauth_states.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { state: 'mock_state_hex' } })
    );
  });
});

// ════════════════════════════════════════════════════════════════
describe('oauthService.handleOAuthCallback — Link mode', () => {
  it('harus link provider ke existing user jika existing_user_id ada di state', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue({
      ...MOCK_OAUTH_STATE,
      existing_user_id: 'user-uuid-existing', // link mode!
    } as never);
    vi.mocked(prisma.oauth_states.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.identities.findUnique).mockResolvedValue(null); // belum linked
    vi.mocked(prisma.identities.create).mockResolvedValue({} as never);
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);
    vi.mocked(prisma.users.findUnique).mockResolvedValue(MOCK_USER as never);

    const result = await oauthService.handleOAuthCallback('google', {
      code: 'auth_code',
      state: 'mock_state_hex',
    }, MOCK_META);

    expect(result.isNewUser).toBe(false);
    expect(prisma.identities.create).toHaveBeenCalledOnce();
  });

  it('harus throw ConflictError jika provider sudah di-link ke user lain', async () => {
    vi.mocked(prisma.oauth_states.findUnique).mockResolvedValue({
      ...MOCK_OAUTH_STATE,
      existing_user_id: 'user-uuid-existing',
    } as never);
    vi.mocked(prisma.oauth_states.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.identities.findUnique).mockResolvedValue({
      user_id: 'user-uuid-different', // linked ke user lain!
    } as never);
    vi.mocked(prisma.apps.findUnique).mockResolvedValue(MOCK_APP as never);

    await expect(
      oauthService.handleOAuthCallback('google', {
        code: 'auth_code',
        state: 'mock_state_hex',
      }, MOCK_META)
    ).rejects.toThrow(ConflictError);
  });
});

// ════════════════════════════════════════════════════════════════
describe('oauthService.unlinkOAuth', () => {
  it('harus berhasil unlink jika ada multiple login methods', async () => {
    vi.mocked(prisma.identities.findFirst).mockResolvedValue({ id: 'identity-1' } as never);
    vi.mocked(prisma.identities.count).mockResolvedValue(2 as never); // google + github
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue({ id: 'pass-1' } as never);
    vi.mocked(prisma.identities.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.identities.findMany).mockResolvedValue([
      { provider: 'github' },
    ] as never);

    const result = await oauthService.unlinkOAuth(
      { provider: 'google' },
      'user-uuid-1',
      MOCK_META
    );

    expect(result.message).toContain('google');
    expect(result.remainingProviders).toContain('email'); // punya password
    expect(result.remainingProviders).toContain('github');
    expect(prisma.identities.deleteMany).toHaveBeenCalledOnce();
  });

  it('harus throw NotFoundError jika provider tidak terhubung', async () => {
    vi.mocked(prisma.identities.findFirst).mockResolvedValue(null);

    await expect(
      oauthService.unlinkOAuth({ provider: 'google' }, 'user-uuid-1', MOCK_META)
    ).rejects.toThrow(NotFoundError);
  });

  it('harus throw ForbiddenError jika hanya ada satu metode login', async () => {
    vi.mocked(prisma.identities.findFirst).mockResolvedValue({ id: 'identity-1' } as never);
    vi.mocked(prisma.identities.count).mockResolvedValue(1 as never); // hanya google
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue(null); // tidak punya password

    await expect(
      oauthService.unlinkOAuth({ provider: 'google' }, 'user-uuid-1', MOCK_META)
    ).rejects.toThrow(ForbiddenError);
  });

  it('boleh unlink jika ada identity lain meskipun tidak punya password', async () => {
    vi.mocked(prisma.identities.findFirst).mockResolvedValue({ id: 'identity-1' } as never);
    vi.mocked(prisma.identities.count).mockResolvedValue(2 as never); // google + github
    vi.mocked(prisma.passwords.findUnique).mockResolvedValue(null); // tidak punya password
    vi.mocked(prisma.identities.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.identities.findMany).mockResolvedValue([{ provider: 'github' }] as never);

    const result = await oauthService.unlinkOAuth(
      { provider: 'google' }, 'user-uuid-1', MOCK_META
    );

    expect(result.remainingProviders).not.toContain('email'); // tidak punya password
    expect(result.remainingProviders).toContain('github');
  });
});

// ════════════════════════════════════════════════════════════════
describe('oauthService.initiateLinkOAuth', () => {
  it('harus return authorization URL untuk link provider baru', async () => {
    vi.mocked(prisma.identities.findFirst).mockResolvedValue(null); // belum linked
    vi.mocked(prisma.oauth_states.create).mockResolvedValue({} as never);

    const result = await oauthService.initiateLinkOAuth(
      { provider: 'google' },
      'user-uuid-1',
      'ci_test',
      { ip: '127.0.0.1' }
    );

    expect(result.authorizationUrl).toContain('state=');
    expect(result.message).toContain('google');
  });

  it('harus throw ConflictError jika provider sudah di-link', async () => {
    vi.mocked(prisma.identities.findFirst).mockResolvedValue({ id: 'existing' } as never);

    await expect(
      oauthService.initiateLinkOAuth(
        { provider: 'google' },
        'user-uuid-1',
        'ci_test',
        { ip: '127.0.0.1' }
      )
    ).rejects.toThrow(ConflictError);
  });
});

// ════════════════════════════════════════════════════════════════
describe('oauthService.getLinkedProviders', () => {
  it('harus return list semua provider yang terhubung', async () => {
    vi.mocked(prisma.identities.findMany).mockResolvedValue([
      { provider: 'google', provider_email: 'user@gmail.com', created_at: new Date() },
      { provider: 'github', provider_email: 'user@users.noreply.github.com', created_at: new Date() },
    ] as never);

    const providers = await oauthService.getLinkedProviders('user-uuid-1');

    expect(providers).toHaveLength(2);
    expect(providers[0].provider).toBe('google');
    expect(providers[1].provider).toBe('github');
  });

  it('harus return array kosong jika tidak ada provider yang terhubung', async () => {
    vi.mocked(prisma.identities.findMany).mockResolvedValue([] as never);

    const providers = await oauthService.getLinkedProviders('user-uuid-1');
    expect(providers).toHaveLength(0);
  });
});
