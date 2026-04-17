import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { hashPassword, generateSecureToken, hashToken } from '@/lib/crypto';
import { signAccessToken } from '@/lib/jwt';
import { createLogger } from '@/lib/logger';
import { env } from '@/config/env';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from '@/shared/errors';
import { AUDIT_ACTIONS, SESSION_STATUS } from '@/config/constants';

import {
  OAUTH_PROVIDERS,
  isValidProvider,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchProviderUserInfo,
  encryptProviderToken,
} from './oauth.providers';
import { generateCodeVerifier, generateCodeChallenge, generateOAuthState } from '@/lib/pkce';
import type {
  OAuthProviderSlug,
  OAuthCallbackResult,
  OAuthLinkInitResult,
  OAuthUnlinkResult,
  AppRow,
  IdentityRow,
  OAuthStateRow,
} from './oauth.types';
import type { OAuthInitQuery, OAuthCallbackQuery, OAuthLinkBody, OAuthUnlinkParam } from './oauth.schema';

const log = createLogger('oauth.service');

// ════════════════════════════════════════════════════════════════
// INTERNAL HELPERS (shared dengan auth.service — direplikasi agar tetap loosely coupled)
// ════════════════════════════════════════════════════════════════

async function findActiveApp(clientId: string): Promise<AppRow> {
  const app = (await prisma.apps.findUnique({
    where: { client_id: clientId },
    select: {
      id: true,
      slug: true,
      client_id: true,
      access_token_ttl: true,
      refresh_token_ttl: true,
      is_active: true,
      deleted_at: true,
    },
  })) as AppRow | null;

  if (!app || !app.is_active || app.deleted_at) {
    throw new NotFoundError('Aplikasi');
  }
  return app;
}

async function loadRolesAndPermissions(
  userId: string,
  appId: string
): Promise<{ roles: string[]; permissions: string[] }> {
  const userRoles = (await prisma.user_roles.findMany({
    where: {
      user_id: userId,
      OR: [{ app_id: appId }, { app_id: null }],
      AND: [{ OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] }],
    },
    include: {
      roles: {
        include: {
          role_permissions: {
            include: { permissions: { select: { slug: true } } },
          },
        },
      },
    },
  })) as Array<{ roles: { slug: string; role_permissions: Array<{ permissions: { slug: string } }> } }>;

  const roles = [...new Set(userRoles.map((ur) => String(ur.roles.slug)))];
  const permissions = [
    ...new Set(userRoles.flatMap((ur) => ur.roles.role_permissions.map((rp) => String(rp.permissions.slug)))),
  ];
  return { roles, permissions };
}

async function createSession(
  userId: string,
  appId: string,
  ttlSeconds: number,
  meta: { ip: string; userAgent: string; provider: string }
): Promise<string> {
  const sessionId = uuidv4();
  await prisma.sessions.create({
    data: {
      id: sessionId,
      user_id: userId,
      app_id: appId,
      status: SESSION_STATUS.ACTIVE,
      device_name: `OAuth via ${meta.provider}`,
      device_type: 'browser',
      user_agent: meta.userAgent,
      ip_address: meta.ip,
      expires_at: new Date(Date.now() + ttlSeconds * 1000),
      last_active_at: new Date(),
    },
  });
  return sessionId;
}

async function createTokenPair(
  userId: string,
  sessionId: string,
  appId: string,
  app: AppRow
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const refreshTokenRaw = generateSecureToken(48);
  const tokenHash = hashToken(refreshTokenRaw);
  const tokenFamily = uuidv4();

  await prisma.refresh_tokens.create({
    data: {
      id: uuidv4(),
      session_id: sessionId,
      user_id: userId,
      app_id: appId,
      token_hash: tokenHash,
      family: tokenFamily,
      expires_at: new Date(Date.now() + app.refresh_token_ttl * 1000),
    },
  });

  const accessToken = signAccessToken({ sub: userId, sessionId, appId });
  return { accessToken, refreshToken: refreshTokenRaw, expiresIn: app.access_token_ttl };
}

function auditLog(data: {
  action: string;
  userId?: string;
  appId?: string;
  sessionId?: string;
  status?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): void {
  prisma.audit_logs
    .create({
      data: {
        id: uuidv4(),
        action: data.action,
        user_id: data.userId ?? null,
        app_id: data.appId ?? null,
        session_id: data.sessionId ?? null,
        status: data.status ?? 'success',
        ip_address: data.ip ?? null,
        user_agent: data.userAgent ?? null,
        metadata: data.metadata ?? {},
      },
    })
    .catch((e: unknown) => log.error({ err: e }, 'Failed to write audit log'));
}

// ════════════════════════════════════════════════════════════════
// 1. INITIATE — Buat authorization URL & simpan state di DB
// ════════════════════════════════════════════════════════════════

export async function initiateOAuth(
  provider: string,
  query: OAuthInitQuery,
  meta: { ip: string; existingUserId?: string }
): Promise<string> {
  if (!isValidProvider(provider)) {
    throw new BadRequestError(`Provider '${provider}' tidak didukung. Pilih: google, github.`);
  }

  const app = await findActiveApp(query.appClientId);

  // Cek apakah provider credentials sudah di-set
  const providerConfig = OAUTH_PROVIDERS[provider];
  if (!providerConfig) throw new BadRequestError('Provider tidak valid.');

  // Validasi credentials tersedia (skip di test env — credentials di-inject via env mock)
  if (env.NODE_ENV !== 'test') {
    if (provider === 'google' && (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)) {
      throw new BadRequestError('Google OAuth belum dikonfigurasi di server.');
    }
    if (provider === 'github' && (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)) {
      throw new BadRequestError('GitHub OAuth belum dikonfigurasi di server.');
    }
  }

  // Generate PKCE & state
  const state = generateOAuthState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Simpan state di DB (expire 10 menit)
  await prisma.oauth_states.create({
    data: {
      id: uuidv4(),
      state,
      provider: provider as OAuthProviderSlug,
      app_id: app.id,
      redirect_uri: query.redirectUri ?? env.FRONTEND_URL,
      code_verifier: codeVerifier,
      existing_user_id: meta.existingUserId ?? null,
      metadata: { appClientId: query.appClientId, ip: meta.ip },
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 menit
    },
  });

  const authUrl = buildAuthorizationUrl(provider, state, codeChallenge);
  log.info({ provider, appId: app.id, hasExistingUser: !!meta.existingUserId }, 'OAuth initiated');

  return authUrl;
}

// ════════════════════════════════════════════════════════════════
// 2. CALLBACK — Verifikasi state, exchange code, create/find user
// ════════════════════════════════════════════════════════════════

export async function handleOAuthCallback(
  provider: string,
  query: OAuthCallbackQuery,
  meta: { ip: string; userAgent: string }
): Promise<OAuthCallbackResult> {
  if (!isValidProvider(provider)) {
    throw new BadRequestError(`Provider '${provider}' tidak didukung.`);
  }

  // ── Handle provider error (user deny, dll) ────────────────
  if (query.error) {
    log.warn({ provider, error: query.error, desc: query.error_description }, 'OAuth provider error');
    throw new BadRequestError(
      query.error === 'access_denied'
        ? 'Akses ke akun ditolak oleh pengguna.'
        : `OAuth error: ${query.error_description ?? query.error}`
    );
  }

  // ── Verifikasi state (CSRF check) ─────────────────────────
  const storedState = (await prisma.oauth_states.findUnique({
    where: { state: query.state },
  })) as OAuthStateRow | null;

  if (!storedState) {
    log.warn({ state: query.state }, 'OAuth state not found — possible CSRF');
    throw new BadRequestError('OAuth state tidak valid. Kemungkinan CSRF attack atau session expired.');
  }

  if (storedState.provider !== provider) {
    throw new BadRequestError('Provider tidak cocok dengan state yang disimpan.');
  }

  if (new Date() > storedState.expires_at) {
    await prisma.oauth_states.delete({ where: { state: query.state } });
    throw new BadRequestError('OAuth session expired. Silakan coba login lagi.');
  }

  // Hapus state — single use
  await prisma.oauth_states.delete({ where: { state: query.state } });

  if (!storedState.code_verifier) {
    throw new BadRequestError('Code verifier tidak ditemukan. Flow tidak valid.');
  }

  // ── Token Exchange ────────────────────────────────────────
  const tokenResponse = await exchangeCodeForToken(
    provider as OAuthProviderSlug,
    query.code,
    storedState.code_verifier
  );

  // ── Fetch User Info dari Provider ─────────────────────────
  const providerUser = await fetchProviderUserInfo(
    provider as OAuthProviderSlug,
    tokenResponse.access_token
  );

  log.info(
    { provider, providerUserId: providerUser.providerUserId, email: providerUser.email },
    'Provider user info fetched'
  );

  // ── Get App Config ────────────────────────────────────────
  const app = (await prisma.apps.findUnique({
    where: { id: storedState.app_id },
    select: {
      id: true, slug: true, client_id: true,
      access_token_ttl: true, refresh_token_ttl: true,
      is_active: true, deleted_at: true,
    },
  })) as AppRow | null;

  if (!app || !app.is_active) throw new NotFoundError('Aplikasi');

  // ── Link Mode: user sudah login, ingin link provider baru ─
  if (storedState.existing_user_id) {
    return handleLinkCallback(
      provider as OAuthProviderSlug,
      storedState.existing_user_id,
      providerUser,
      tokenResponse,
      app,
      meta
    );
  }

  // ── Login/Register Mode ───────────────────────────────────
  return handleLoginOrRegisterCallback(
    provider as OAuthProviderSlug,
    providerUser,
    tokenResponse,
    app,
    meta
  );
}

// ── Sub-handler: login atau register via OAuth ────────────────
async function handleLoginOrRegisterCallback(
  provider: OAuthProviderSlug,
  providerUser: Awaited<ReturnType<typeof fetchProviderUserInfo>>,
  tokenResponse: Awaited<ReturnType<typeof exchangeCodeForToken>>,
  app: AppRow,
  meta: { ip: string; userAgent: string }
): Promise<OAuthCallbackResult> {
  // Cek apakah identity sudah ada
  const existingIdentity = (await prisma.identities.findUnique({
    where: {
      uq_identities_provider: {
        provider,
        provider_user_id: providerUser.providerUserId,
      },
    },
    select: { id: true, user_id: true },
  })) as { id: string; user_id: string } | null;

  let userId: string;
  let isNewUser = false;

  if (existingIdentity) {
    // ── User sudah pernah login via provider ini ──────────
    userId = existingIdentity.user_id;

    // Sync data terbaru dari provider
    await syncProviderData(existingIdentity.id, providerUser, tokenResponse);

    // Update last login
    void prisma.users.update({
      where: { id: userId },
      data: {
        last_login_at: new Date(),
        last_login_ip: meta.ip,
        login_count: { increment: 1 },
        // Sync avatar jika berubah
        ...(providerUser.avatarUrl ? { avatar_url: providerUser.avatarUrl } : {}),
      },
    }).catch((_e: unknown) => undefined);

  } else {
    // ── Identity belum ada — cek apakah email sudah terdaftar ─
    const existingUserByEmail = providerUser.email
      ? (await prisma.users.findUnique({
          where: { email: providerUser.email },
          select: { id: true, deleted_at: true },
        })) as { id: string; deleted_at: Date | null } | null
      : null;

    if (existingUserByEmail && !existingUserByEmail.deleted_at) {
      // Email sudah ada → link ke existing user
      userId = existingUserByEmail.id;
      await createIdentityRecord(userId, provider, providerUser, tokenResponse);
      log.info({ userId, provider, email: providerUser.email }, 'OAuth linked to existing email user');
    } else {
      // User baru → auto-register
      userId = await autoRegisterOAuthUser(provider, providerUser, app);
      isNewUser = true;
    }
  }

  // Buat session & token
  const sessionId = await createSession(userId, app.id, app.refresh_token_ttl, {
    ...meta,
    provider,
  });
  const { accessToken, refreshToken, expiresIn } = await createTokenPair(
    userId, sessionId, app.id, app
  );

  // Load roles & permissions
  const { roles, permissions } = await loadRolesAndPermissions(userId, app.id);

  // Ambil user data lengkap
  const user = (await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, username: true,
      display_name: true, avatar_url: true,
      email_verified_at: true,
    },
  })) as {
    id: string; email: string | null; username: string | null;
    display_name: string | null; avatar_url: string | null;
    email_verified_at: Date | null;
  };

  auditLog({
    action: isNewUser ? AUDIT_ACTIONS.USER_REGISTER : AUDIT_ACTIONS.USER_LOGIN,
    userId,
    appId: app.id,
    sessionId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { provider, isNewUser },
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn,
    isNewUser,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      emailVerified: !!user.email_verified_at,
      roles,
      permissions,
    },
    session: {
      id: sessionId,
      deviceName: `OAuth via ${provider}`,
      createdAt: new Date(),
    },
  };
}

// ── Sub-handler: link callback untuk existing user ────────────
async function handleLinkCallback(
  provider: OAuthProviderSlug,
  existingUserId: string,
  providerUser: Awaited<ReturnType<typeof fetchProviderUserInfo>>,
  tokenResponse: Awaited<ReturnType<typeof exchangeCodeForToken>>,
  app: AppRow,
  meta: { ip: string; userAgent: string }
): Promise<OAuthCallbackResult> {
  // Cek apakah provider ini sudah di-link ke user lain
  const alreadyLinked = (await prisma.identities.findUnique({
    where: {
      uq_identities_provider: {
        provider,
        provider_user_id: providerUser.providerUserId,
      },
    },
    select: { user_id: true },
  })) as { user_id: string } | null;

  if (alreadyLinked && alreadyLinked.user_id !== existingUserId) {
    throw new ConflictError(
      `Akun ${provider} ini sudah terhubung ke akun lain. Silakan gunakan akun ${provider} yang berbeda.`
    );
  }

  if (alreadyLinked && alreadyLinked.user_id === existingUserId) {
    throw new ConflictError(`Akun ${provider} ini sudah terhubung ke akun kamu.`);
  }

  // Link provider ke existing user
  await createIdentityRecord(existingUserId, provider, providerUser, tokenResponse);

  // Buat session baru
  const sessionId = await createSession(existingUserId, app.id, app.refresh_token_ttl, {
    ...meta,
    provider,
  });
  const { accessToken, refreshToken, expiresIn } = await createTokenPair(
    existingUserId, sessionId, app.id, app
  );
  const { roles, permissions } = await loadRolesAndPermissions(existingUserId, app.id);

  const user = (await prisma.users.findUnique({
    where: { id: existingUserId },
    select: {
      id: true, email: true, username: true,
      display_name: true, avatar_url: true, email_verified_at: true,
    },
  })) as {
    id: string; email: string | null; username: string | null;
    display_name: string | null; avatar_url: string | null;
    email_verified_at: Date | null;
  };

  auditLog({
    action: AUDIT_ACTIONS.OAUTH_LINKED,
    userId: existingUserId,
    appId: app.id,
    sessionId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { provider },
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn,
    isNewUser: false,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      emailVerified: !!user.email_verified_at,
      roles,
      permissions,
    },
    session: {
      id: sessionId,
      deviceName: `OAuth Link via ${provider}`,
      createdAt: new Date(),
    },
  };
}

// ── Auto-register user baru dari OAuth ───────────────────────
async function autoRegisterOAuthUser(
  provider: OAuthProviderSlug,
  providerUser: Awaited<ReturnType<typeof fetchProviderUserInfo>>,
  app: AppRow
): Promise<string> {
  const userId = uuidv4();
  const displayName = providerUser.displayName;

  // Generate random password hash (user tidak tahu password ini — login via OAuth saja)
  const randomPasswordHash = await hashPassword(generateSecureToken(24));

  // Cari role member
  const memberRole = (await prisma.roles.findFirst({
    where: { slug: 'member', OR: [{ app_id: app.id }, { app_id: null }] },
    select: { id: true },
  })) as { id: string } | null;

  await prisma.$transaction(async (tx: typeof prisma) => {
    // 1. Buat user
    await tx.users.create({
      data: {
        id: userId,
        email: providerUser.email,
        display_name: displayName,
        avatar_url: providerUser.avatarUrl,
        is_active: true,
        // Email verified jika provider memverifikasinya
        email_verified_at: providerUser.emailVerified && providerUser.email ? new Date() : null,
        locale: providerUser.locale ?? 'id',
      },
    });

    // 2. Buat password record (random, tidak diketahui user)
    await tx.passwords.create({
      data: { id: uuidv4(), user_id: userId, password_hash: randomPasswordHash },
    });

    // 3. Profile
    await tx.user_profiles.create({
      data: {
        id: uuidv4(),
        user_id: userId,
        first_name: providerUser.firstName,
        last_name: providerUser.lastName,
      },
    });

    // 4. Membership
    await tx.user_app_memberships.create({
      data: {
        id: uuidv4(),
        user_id: userId,
        app_id: app.id,
        status: 'active',
        joined_at: new Date(),
      },
    });

    // 5. Identity record
    await tx.identities.create({
      data: {
        id: uuidv4(),
        user_id: userId,
        provider,
        provider_user_id: providerUser.providerUserId,
        provider_email: providerUser.email,
        provider_data: providerUser.rawData,
        is_primary: true,
      },
    });

    // 6. Role member
    if (memberRole) {
      await tx.user_roles.create({
        data: {
          id: uuidv4(),
          user_id: userId,
          role_id: memberRole.id,
          app_id: app.id,
        },
      });
    }
  });

  log.info({ userId, provider, email: providerUser.email }, 'Auto-registered OAuth user');
  return userId;
}

// ── Buat identity record untuk existing user ──────────────────
async function createIdentityRecord(
  userId: string,
  provider: OAuthProviderSlug,
  providerUser: Awaited<ReturnType<typeof fetchProviderUserInfo>>,
  tokenResponse: Awaited<ReturnType<typeof exchangeCodeForToken>>
): Promise<void> {
  await prisma.identities.create({
    data: {
      id: uuidv4(),
      user_id: userId,
      provider,
      provider_user_id: providerUser.providerUserId,
      provider_email: providerUser.email,
      provider_access_token: encryptProviderToken(tokenResponse.access_token),
      provider_refresh_token: tokenResponse.refresh_token
        ? encryptProviderToken(tokenResponse.refresh_token)
        : null,
      provider_token_expires_at: tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null,
      provider_data: providerUser.rawData,
      is_primary: false,
    },
  });
}

// ── Sync data provider terbaru ke identity record ─────────────
async function syncProviderData(
  identityId: string,
  providerUser: Awaited<ReturnType<typeof fetchProviderUserInfo>>,
  tokenResponse: Awaited<ReturnType<typeof exchangeCodeForToken>>
): Promise<void> {
  await prisma.identities.update({
    where: { id: identityId },
    data: {
      provider_email: providerUser.email,
      provider_access_token: encryptProviderToken(tokenResponse.access_token),
      provider_refresh_token: tokenResponse.refresh_token
        ? encryptProviderToken(tokenResponse.refresh_token)
        : undefined,
      provider_token_expires_at: tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : undefined,
      provider_data: providerUser.rawData,
    },
  });
}

// ════════════════════════════════════════════════════════════════
// 3. LINK — Initiate link OAuth ke existing logged-in user
// ════════════════════════════════════════════════════════════════

export async function initiateLinkOAuth(
  body: OAuthLinkBody,
  userId: string,
  appClientId: string,
  meta: { ip: string }
): Promise<OAuthLinkInitResult> {
  const provider = body.provider;

  // Cek apakah sudah di-link
  const existing = (await prisma.identities.findFirst({
    where: { user_id: userId, provider },
    select: { id: true },
  })) as { id: string } | null;

  if (existing) {
    throw new ConflictError(`Akun ${provider} sudah terhubung ke akun kamu.`);
  }

  const authUrl = await initiateOAuth(
    provider,
    { appClientId, redirectUri: body.redirectUri },
    { ip: meta.ip, existingUserId: userId }
  );

  return {
    authorizationUrl: authUrl,
    message: `Redirect user ke URL ini untuk menghubungkan akun ${provider}.`,
  };
}

// ════════════════════════════════════════════════════════════════
// 4. UNLINK — Hapus linked OAuth dari user
// ════════════════════════════════════════════════════════════════

export async function unlinkOAuth(
  param: OAuthUnlinkParam,
  userId: string,
  meta: { ip: string; userAgent: string }
): Promise<OAuthUnlinkResult> {
  const provider = param.provider;

  // Cek identity ada
  const identity = (await prisma.identities.findFirst({
    where: { user_id: userId, provider },
    select: { id: true },
  })) as IdentityRow | null;

  if (!identity) {
    throw new NotFoundError(`Akun ${provider} tidak terhubung ke akun kamu.`);
  }

  // Cek total login methods — tidak boleh hapus satu-satunya
  const [identityCount, passwordRecord] = await Promise.all([
    prisma.identities.count({ where: { user_id: userId } }) as Promise<number>,
    prisma.passwords.findUnique({ where: { user_id: userId }, select: { id: true } }) as Promise<{ id: string } | null>,
  ]);

  const hasPassword = !!passwordRecord;
  const totalMethods = identityCount + (hasPassword ? 1 : 0);

  if (totalMethods <= 1) {
    throw new ForbiddenError(
      'Tidak bisa menghapus satu-satunya metode login. ' +
      'Tambahkan password atau hubungkan provider lain terlebih dahulu.',
      'LAST_LOGIN_METHOD' as never
    );
  }

  // Hapus identity
  await prisma.identities.deleteMany({ where: { user_id: userId, provider } });

  // Ambil sisa providers
  const remaining = (await prisma.identities.findMany({
    where: { user_id: userId },
    select: { provider: true },
  })) as Array<{ provider: string }>;

  const remainingProviders = remaining.map((i) => i.provider);
  if (hasPassword) remainingProviders.unshift('email');

  auditLog({
    action: AUDIT_ACTIONS.OAUTH_UNLINKED,
    userId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { provider, remainingProviders },
  });

  log.info({ userId, provider }, 'OAuth provider unlinked');

  return {
    message: `Akun ${provider} berhasil diputuskan dari akun kamu.`,
    remainingProviders,
  };
}

// ════════════════════════════════════════════════════════════════
// 5. GET LINKED PROVIDERS — Tampilkan semua provider yang terhubung
// ════════════════════════════════════════════════════════════════

export async function getLinkedProviders(
  userId: string
): Promise<{ provider: string; email: string | null; linkedAt: Date }[]> {
  const identities = (await prisma.identities.findMany({
    where: { user_id: userId },
    select: { provider: true, provider_email: true, created_at: true },
    orderBy: { created_at: 'asc' },
  })) as Array<{ provider: string; provider_email: string | null; created_at: Date }>;

  return identities.map((i) => ({
    provider: i.provider,
    email: i.provider_email,
    linkedAt: i.created_at,
  }));
}
