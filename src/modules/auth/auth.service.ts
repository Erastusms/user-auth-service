import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateSecureToken,
  generateUrlSafeToken,
} from '@/lib/crypto';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/lib/jwt';
import { sendVerificationEmail } from '@/lib/email';
import { createLogger } from '@/lib/logger';
import { env } from '@/config/env';
import {
  ConflictError,
  NotFoundError,
  InvalidCredentialsError,
  TokenInvalidError,
  UnauthorizedError,
  AccountBannedError,
  AccountInactiveError,
} from '@/shared/errors';
import { AUDIT_ACTIONS, SESSION_STATUS } from '@/config/constants';
import type {
  RegisterDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  RevokeAllDto,
} from './auth.schema';
import type {
  RequestMeta,
  RegisterResult,
  LoginResult,
  RefreshResult,
  RevokeAllResult,
  TokenPair,
  AppRow,
  UserRow,
  UserRoleRow,
  RefreshTokenRow,
  SessionRow,
} from './auth.types';

const log = createLogger('auth.service');

// ════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ════════════════════════════════════════════════════════════════

/** Ambil app berdasarkan client_id. Throw jika tidak ditemukan / inactive. */
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

/** Load roles + permissions user untuk app tertentu. */
async function loadUserRolesAndPermissions(
  userId: string,
  appId: string,
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
  })) as UserRoleRow[];

  const roles = [...new Set(userRoles.map((ur) => String(ur.roles.slug)))];
  const permissions = [
    ...new Set(
      userRoles.flatMap((ur) =>
        ur.roles.role_permissions.map((rp) => String(rp.permissions.slug)),
      ),
    ),
  ];

  return { roles, permissions };
}

/** Buat session baru di DB. */
async function createSession(
  userId: string,
  appId: string,
  meta: RequestMeta,
  ttlSeconds: number,
): Promise<string> {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await prisma.sessions.create({
    data: {
      id: sessionId,
      user_id: userId,
      app_id: appId,
      status: SESSION_STATUS.ACTIVE,
      device_name: meta.deviceName ?? 'Unknown Device',
      device_type: meta.deviceType ?? 'browser',
      user_agent: meta.userAgent,
      ip_address: meta.ip,
      expires_at: expiresAt,
      last_active_at: new Date(),
    },
  });

  return sessionId;
}

/**
 * Buat pasangan access token + refresh token.
 * Refresh token: random bytes → kirim ke client, simpan SHA-256 hash di DB.
 * Family: UUID untuk melacak rotation chain (reuse attack detection).
 */
async function createTokenPair(
  userId: string,
  sessionId: string,
  appId: string,
  app: AppRow,
  family?: string, // kalau tidak ada → buat family baru
): Promise<{ tokenPair: TokenPair; refreshTokenRaw: string }> {
  // Generate refresh token raw (yang dikirim ke client)
  const refreshTokenRaw = generateSecureToken(48); // 96-char hex
  const tokenHash = hashToken(refreshTokenRaw);
  const tokenFamily = family ?? uuidv4();
  const expiresAt = new Date(Date.now() + app.refresh_token_ttl * 1000);

  // Simpan hash di DB
  await prisma.refresh_tokens.create({
    data: {
      id: uuidv4(),
      session_id: sessionId,
      user_id: userId,
      app_id: appId,
      token_hash: tokenHash,
      family: tokenFamily,
      expires_at: expiresAt,
    },
  });

  // Sign access token
  const accessToken = signAccessToken({
    sub: userId,
    sessionId,
    appId,
  });

  const tokenPair: TokenPair = {
    accessToken,
    refreshToken: refreshTokenRaw,
    tokenType: 'Bearer',
    expiresIn: app.access_token_ttl,
  };

  return { tokenPair, refreshTokenRaw };
}

/** Tulis audit log (fire-and-forget). */
function auditLog(data: {
  action: string;
  userId?: string;
  appId?: string;
  sessionId?: string;
  status?: string;
  ip?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
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
        error_message: data.errorMessage ?? null,
        ip_address: data.ip ?? null,
        user_agent: data.userAgent ?? null,
        resource_type: data.resourceType ?? null,
        resource_id: data.resourceId ?? null,
        metadata: data.metadata
          ? JSON.parse(JSON.stringify(data.metadata))
          : null,
      },
    })
    .catch((e: unknown) => log.error({ err: e }, 'Failed to write audit log'));
}

// ════════════════════════════════════════════════════════════════
// PUBLIC SERVICE METHODS
// ════════════════════════════════════════════════════════════════

// ── Register ──────────────────────────────────────────────────
export async function register(
  dto: RegisterDto,
  meta: RequestMeta,
): Promise<RegisterResult> {
  const app = await findActiveApp(dto.appClientId);

  // Cek email sudah terdaftar
  const existingUser = await prisma.users.findUnique({
    where: { email: dto.email },
    select: { id: true, deleted_at: true },
  });

  if (existingUser && !existingUser.deleted_at) {
    auditLog({
      action: AUDIT_ACTIONS.USER_REGISTER,
      appId: app.id,
      status: 'failure',
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { email: dto.email, reason: 'email_already_exists' },
    });
    throw new ConflictError('Email sudah terdaftar.');
  }

  // Hash password
  const passwordHash = await hashPassword(dto.password);

  const userId = uuidv4();
  const displayName =
    dto.displayName ?? dto.username ?? dto.email.split('@')[0];

  // Buat verification token
  const verificationTokenRaw = generateUrlSafeToken(32);
  const verificationTokenHash = hashToken(verificationTokenRaw);
  const verificationExpiresAt = new Date(
    Date.now() + env.EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
  );

  // Cari role 'member' untuk app ini (atau global)
  const memberRole = (await prisma.roles.findFirst({
    where: {
      slug: 'member',
      OR: [{ app_id: app.id }, { app_id: null }],
    },
    select: { id: true },
  })) as { id: string } | null;

  // ── Prisma Transaction ────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    // 1. Buat user
    await tx.users.create({
      data: {
        id: userId,
        email: dto.email,
        username: dto.username ?? null,
        display_name: displayName,
        is_active: true,
        locale: dto.locale,
      },
    });

    // 2. Buat password record
    await tx.passwords.create({
      data: {
        id: uuidv4(),
        user_id: userId,
        password_hash: passwordHash,
      },
    });

    // 3. Buat profile
    await tx.user_profiles.create({
      data: {
        id: uuidv4(),
        user_id: userId,
      },
    });

    // 4. Buat membership di app ini
    await tx.user_app_memberships.create({
      data: {
        id: uuidv4(),
        user_id: userId,
        app_id: app.id,
        status: 'active',
        joined_at: new Date(),
      },
    });

    // 5. Assign role 'member' jika ada
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

    // 6. Buat verification token
    await tx.verification_tokens.create({
      data: {
        id: uuidv4(),
        user_id: userId,
        type: 'email_verification',
        token_hash: verificationTokenHash,
        target: dto.email,
        requested_from_ip: meta.ip,
        expires_at: verificationExpiresAt,
      },
    });
  });

  // Kirim verification email (async, tidak blocking response)
  setImmediate(() => {
    void sendVerificationEmail(dto.email, displayName, verificationTokenRaw);
  });

  auditLog({
    action: AUDIT_ACTIONS.USER_REGISTER,
    userId,
    appId: app.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { email: dto.email },
  });

  log.info({ userId, email: dto.email, appId: app.id }, 'User registered');

  return {
    user: {
      id: userId,
      email: dto.email,
      username: dto.username ?? null,
      displayName,
      emailVerified: false,
      createdAt: new Date(),
    },
    message: 'Registrasi berhasil. Cek email kamu untuk verifikasi akun.',
  };
}

// ── Login ─────────────────────────────────────────────────────
export async function login(
  dto: LoginDto,
  meta: RequestMeta,
): Promise<LoginResult> {
  const app = await findActiveApp(dto.appClientId);

  // Cari user beserta password-nya
  const user = (await prisma.users.findUnique({
    where: { email: dto.email },
    select: {
      id: true,
      email: true,
      username: true,
      display_name: true,
      avatar_url: true,
      is_active: true,
      is_banned: true,
      ban_reason: true,
      deleted_at: true,
      email_verified_at: true,
      passwords: { select: { password_hash: true, must_change: true } },
    },
  })) as
    | (UserRow & {
        passwords: { password_hash: string; must_change: boolean } | null;
      })
    | null;

  // User tidak ditemukan atau sudah dihapus — jangan bocorkan info ini
  if (!user || user.deleted_at || !user.passwords) {
    auditLog({
      action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
      appId: app.id,
      status: 'failure',
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { email: dto.email, reason: 'user_not_found' },
    });
    throw new InvalidCredentialsError();
  }

  // Verifikasi password
  const passwordMatch = await verifyPassword(
    dto.password,
    user.passwords.password_hash,
  );

  if (!passwordMatch) {
    auditLog({
      action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
      userId: user.id,
      appId: app.id,
      status: 'failure',
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { reason: 'wrong_password' },
    });
    throw new InvalidCredentialsError();
  }

  // Cek status akun
  if (user.is_banned) {
    throw new AccountBannedError(user.ban_reason ?? undefined);
  }

  if (!user.is_active) {
    throw new AccountInactiveError();
  }

  // Load roles & permissions
  const { roles, permissions } = await loadUserRolesAndPermissions(
    user.id,
    app.id,
  );

  // Buat session
  const sessionId = await createSession(
    user.id,
    app.id,
    {
      ...meta,
      deviceName: dto.deviceName,
      deviceType: dto.deviceType,
    },
    app.refresh_token_ttl,
  );

  // Buat token pair
  const { tokenPair } = await createTokenPair(user.id, sessionId, app.id, app);

  // Update last_login stats (fire-and-forget)
  prisma.users
    .update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        last_login_ip: meta.ip,
        login_count: { increment: 1 },
      },
    })
    .catch((_err: unknown) => log.warn('Failed to update login stats'));

  auditLog({
    action: AUDIT_ACTIONS.USER_LOGIN,
    userId: user.id,
    appId: app.id,
    sessionId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { deviceType: dto.deviceType },
  });

  log.info({ userId: user.id, appId: app.id, sessionId }, 'User logged in');

  return {
    tokens: tokenPair,
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
      deviceName: dto.deviceName ?? 'Unknown Device',
      createdAt: new Date(),
    },
  };
}

// ── Logout ────────────────────────────────────────────────────
export async function logout(
  dto: LogoutDto,
  userId: string,
  sessionId: string,
  meta: RequestMeta,
): Promise<void> {
  const tokenHash = hashToken(dto.refreshToken);

  // Cari refresh token di DB
  const refreshToken = (await prisma.refresh_tokens.findUnique({
    where: { token_hash: tokenHash },
    select: {
      id: true,
      session_id: true,
      user_id: true,
      app_id: true,
      revoked_at: true,
    },
  })) as {
    id: string;
    session_id: string;
    user_id: string;
    app_id: string;
    revoked_at: Date | null;
  } | null;

  // Revoke refresh token (jika ditemukan dan milik user ini)
  if (
    refreshToken &&
    refreshToken.user_id === userId &&
    !refreshToken.revoked_at
  ) {
    await prisma.refresh_tokens.update({
      where: { id: refreshToken.id },
      data: {
        revoked_at: new Date(),
        revoke_reason: 'user_logout',
      },
    });
  }

  // Revoke session
  await prisma.sessions.update({
    where: { id: sessionId },
    data: {
      status: SESSION_STATUS.REVOKED,
      revoked_at: new Date(),
      revoke_reason: 'user_logout',
    },
  });

  auditLog({
    action: AUDIT_ACTIONS.USER_LOGOUT,
    userId,
    sessionId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  log.info({ userId, sessionId }, 'User logged out');
}

// ── Refresh Token ─────────────────────────────────────────────
export async function refresh(dto: RefreshDto): Promise<RefreshResult> {
  const app = await findActiveApp(dto.appClientId);

  // Hash token yang dikirim client untuk dicari di DB
  const tokenHash = hashToken(dto.refreshToken);

  const storedToken = (await prisma.refresh_tokens.findUnique({
    where: { token_hash: tokenHash },
    select: {
      id: true,
      session_id: true,
      user_id: true,
      app_id: true,
      family: true,
      used_at: true,
      expires_at: true,
      revoked_at: true,
    },
  })) as RefreshTokenRow | null;

  // Token tidak ditemukan
  if (!storedToken) {
    throw new TokenInvalidError('Refresh token tidak valid.');
  }

  // Token sudah direvoke
  if (storedToken.revoked_at) {
    throw new TokenInvalidError('Refresh token sudah tidak berlaku.');
  }

  // Token sudah expired
  if (new Date() > storedToken.expires_at) {
    throw new TokenInvalidError('Refresh token sudah kadaluarsa.');
  }

  // ── REUSE ATTACK DETECTION ────────────────────────────────────
  // Jika token sudah pernah dipakai (used_at != null) tapi ada yang mencoba
  // pakai lagi → ini adalah reuse attack. Revoke seluruh family!
  if (storedToken.used_at) {
    log.warn(
      {
        userId: storedToken.user_id,
        family: storedToken.family,
        tokenId: storedToken.id,
      },
      'Refresh token reuse detected — revoking entire family',
    );

    // Revoke semua token dalam family yang sama
    await prisma.refresh_tokens.updateMany({
      where: { family: storedToken.family },
      data: {
        revoked_at: new Date(),
        revoke_reason: 'reuse_attack',
      },
    });

    // Revoke session terkait
    await prisma.sessions.update({
      where: { id: storedToken.session_id },
      data: {
        status: SESSION_STATUS.REVOKED,
        revoked_at: new Date(),
        revoke_reason: 'refresh_token_reuse',
      },
    });

    auditLog({
      action: AUDIT_ACTIONS.REFRESH_TOKEN_REUSE,
      userId: storedToken.user_id,
      appId: storedToken.app_id,
      sessionId: storedToken.session_id,
      status: 'failure',
      metadata: { family: storedToken.family },
    });

    throw new UnauthorizedError(
      'Aktivitas mencurigakan terdeteksi. Silakan login ulang.',
    );
  }

  // Verifikasi session masih aktif
  const session = (await prisma.sessions.findUnique({
    where: { id: storedToken.session_id },
    select: {
      id: true,
      user_id: true,
      app_id: true,
      status: true,
      expires_at: true,
    },
  })) as SessionRow | null;

  if (!session || session.status !== SESSION_STATUS.ACTIVE) {
    throw new UnauthorizedError(
      'Session sudah tidak aktif. Silakan login ulang.',
    );
  }

  if (new Date() > session.expires_at) {
    throw new UnauthorizedError('Session sudah expired. Silakan login ulang.');
  }

  // ── TOKEN ROTATION ────────────────────────────────────────────
  // 1. Tandai token lama sebagai sudah dipakai
  const newTokenId = uuidv4();
  await prisma.refresh_tokens.update({
    where: { id: storedToken.id },
    data: {
      used_at: new Date(),
      replaced_by: newTokenId,
    },
  });

  // 2. Buat refresh token baru dalam family yang sama
  const refreshTokenRaw = generateSecureToken(48);
  const newTokenHash = hashToken(refreshTokenRaw);
  const newExpiresAt = new Date(Date.now() + app.refresh_token_ttl * 1000);

  await prisma.refresh_tokens.create({
    data: {
      id: newTokenId,
      session_id: storedToken.session_id,
      user_id: storedToken.user_id,
      app_id: app.id,
      token_hash: newTokenHash,
      family: storedToken.family, // Tetap dalam family yang sama
      expires_at: newExpiresAt,
    },
  });

  // 3. Sign access token baru
  const accessToken = signAccessToken({
    sub: storedToken.user_id,
    sessionId: storedToken.session_id,
    appId: app.id,
  });

  // Update session last_active_at
  void prisma.sessions
    .update({
      where: { id: storedToken.session_id },
      data: { last_active_at: new Date() },
    })
    .catch(() => undefined);

  auditLog({
    action: AUDIT_ACTIONS.TOKEN_REFRESHED,
    userId: storedToken.user_id,
    appId: storedToken.app_id,
    sessionId: storedToken.session_id,
  });

  log.info(
    { userId: storedToken.user_id, sessionId: storedToken.session_id },
    'Token refreshed',
  );

  return {
    tokens: {
      accessToken,
      refreshToken: refreshTokenRaw,
      tokenType: 'Bearer',
      expiresIn: app.access_token_ttl,
    },
  };
}

// ── Revoke All Sessions ───────────────────────────────────────
export async function revokeAll(
  dto: RevokeAllDto,
  userId: string,
  currentSessionId: string,
  meta: RequestMeta,
): Promise<RevokeAllResult> {
  // Bangun where clause untuk sessions yang akan direvoke
  const sessionWhere: Record<string, unknown> = {
    user_id: userId,
    status: SESSION_STATUS.ACTIVE,
  };

  if (dto.exceptCurrentSession) {
    sessionWhere['id'] = { not: currentSessionId };
  }

  // Ambil semua session yang akan direvoke untuk audit trail
  const sessionsToRevoke = (await prisma.sessions.findMany({
    where: sessionWhere,
    select: { id: true },
  })) as Array<{ id: string }>;

  const sessionIds = sessionsToRevoke.map((s) => s.id);
  const revokedCount = sessionIds.length;

  if (revokedCount === 0) {
    return {
      revokedCount: 0,
      message: 'Tidak ada session aktif yang perlu direvoke.',
    };
  }

  // Revoke semua sessions
  await prisma.sessions.updateMany({
    where: { id: { in: sessionIds } },
    data: {
      status: SESSION_STATUS.REVOKED,
      revoked_at: new Date(),
      revoke_reason: dto.exceptCurrentSession ? 'revoke_others' : 'revoke_all',
    },
  });

  // Revoke semua refresh tokens dari sessions yang direvoke
  await prisma.refresh_tokens.updateMany({
    where: {
      session_id: { in: sessionIds },
      revoked_at: null,
    },
    data: {
      revoked_at: new Date(),
      revoke_reason: 'session_revoked',
    },
  });

  auditLog({
    action: AUDIT_ACTIONS.TOKEN_REVOKE_ALL,
    userId,
    sessionId: currentSessionId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: {
      revokedCount,
      exceptCurrentSession: dto.exceptCurrentSession,
    },
  });

  log.info(
    { userId, revokedCount, exceptCurrentSession: dto.exceptCurrentSession },
    'All sessions revoked',
  );

  return {
    revokedCount,
    message: `${revokedCount} session berhasil direvoke.`,
  };
}
