import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateUrlSafeToken,
} from '@/lib/crypto';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '@/lib/email';
import { createLogger } from '@/lib/logger';
import { env } from '@/config/env';
import {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  InvalidCredentialsError,
  AccountBannedError,
  AccountInactiveError,
  ConflictError,
} from '@/shared/errors';
import {
  AUDIT_ACTIONS,
  TOKEN_TYPES,
  SESSION_STATUS,
  PASSWORD_POLICY,
} from '@/config/constants';
import type {
  SendVerificationDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './email.schema';
import type {
  SendVerificationResult,
  VerifyEmailResult,
  ForgotPasswordResult,
  ResetPasswordResult,
  ChangePasswordResult,
  UserRow,
  PasswordRow,
  VerificationTokenRow,
} from './email.types';

const log = createLogger('email.service');

// ── Audit log (fire-and-forget) ───────────────────────────────
function auditLog(data: {
  action: string;
  userId?: string;
  appId?: string;
  status?: string;
  ip?: string;
  userAgent?: string;
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
        session_id: null,
        status: data.status ?? 'success',
        error_message: data.errorMessage ?? null,
        ip_address: data.ip ?? null,
        user_agent: data.userAgent ?? null,
        resource_type: 'user',
        resource_id: data.userId ?? null,
        metadata: data.metadata ?? {},
      },
    })
    .catch((e: unknown) => log.error({ err: e }, 'Failed to write audit log'));
}

// ── Find active user by email ─────────────────────────────────
async function findActiveUserByEmail(email: string): Promise<UserRow | null> {
  return prisma.users.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      display_name: true,
      is_active: true,
      is_banned: true,
      ban_reason: true,
      deleted_at: true,
      email_verified_at: true,
    },
  }) as Promise<UserRow | null>;
}

// ── Create & store verification token ────────────────────────
async function createVerificationToken(
  userId: string,
  type: string,
  target: string,
  ttlMinutes: number,
  ip?: string
): Promise<string> {
  // Invalidate existing unused tokens of same type for same user
  await prisma.verification_tokens.updateMany({
    where: {
      user_id: userId,
      type,
      used_at: null,
    },
    data: { used_at: new Date() }, // mark old tokens as consumed
  });

  const tokenRaw = generateUrlSafeToken(32);
  const tokenHash = hashToken(tokenRaw);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.verification_tokens.create({
    data: {
      id: uuidv4(),
      user_id: userId,
      type,
      token_hash: tokenHash,
      target,
      requested_from_ip: ip ?? null,
      expires_at: expiresAt,
    },
  });

  return tokenRaw;
}

// ── Consume & validate a verification token ───────────────────
async function consumeToken(
  tokenRaw: string,
  type: string
): Promise<VerificationTokenRow> {
  const tokenHash = hashToken(tokenRaw);

  const stored = (await prisma.verification_tokens.findUnique({
    where: { token_hash: tokenHash },
    select: {
      id: true,
      user_id: true,
      type: true,
      token_hash: true,
      target: true,
      expires_at: true,
      used_at: true,
    },
  })) as VerificationTokenRow | null;

  if (!stored) {
    throw new BadRequestError('Token tidak valid atau sudah digunakan.');
  }

  if (stored.type !== type) {
    throw new BadRequestError('Tipe token tidak sesuai.');
  }

  if (stored.used_at) {
    throw new BadRequestError('Token sudah pernah digunakan.');
  }

  if (new Date() > stored.expires_at) {
    throw new BadRequestError('Token sudah kadaluarsa. Silakan minta token baru.');
  }

  // Mark as used
  await prisma.verification_tokens.update({
    where: { id: stored.id },
    data: { used_at: new Date() },
  });

  return stored;
}

// ════════════════════════════════════════════════════════════════
// 1. SEND EMAIL VERIFICATION
// ════════════════════════════════════════════════════════════════

export async function sendEmailVerification(
  dto: SendVerificationDto,
  meta: { ip?: string; userAgent?: string }
): Promise<SendVerificationResult> {
  const user = await findActiveUserByEmail(dto.email);

  // Tidak bocorkan apakah email terdaftar atau tidak
  if (!user || user.deleted_at) {
    log.info({ email: dto.email }, 'sendEmailVerification: email not found, silently ignored');
    return { message: 'Jika email terdaftar, link verifikasi telah dikirim.' };
  }

  if (user.email_verified_at) {
    throw new ConflictError('Email ini sudah terverifikasi.');
  }

  if (user.is_banned) throw new AccountBannedError(user.ban_reason ?? undefined);
  if (!user.is_active) throw new AccountInactiveError();

  const tokenRaw = await createVerificationToken(
    user.id,
    TOKEN_TYPES.EMAIL_VERIFICATION,
    dto.email,
    env.EMAIL_VERIFICATION_TTL_MINUTES,
    meta.ip
  );

  const displayName = user.display_name ?? user.username ?? dto.email.split('@')[0];

  // Fire-and-forget — jangan block response menunggu email terkirim
  setImmediate(() => {
    void sendVerificationEmail(dto.email, displayName, tokenRaw);
  });

  auditLog({
    action: 'email.verification_sent',
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { email: dto.email },
  });

  log.info({ userId: user.id, email: dto.email }, 'Verification email queued');

  return { message: 'Email verifikasi telah dikirim. Cek inbox dan folder spam kamu.' };
}

// ════════════════════════════════════════════════════════════════
// 2. VERIFY EMAIL
// ════════════════════════════════════════════════════════════════

export async function verifyEmail(
  dto: VerifyEmailDto,
  meta: { ip?: string; userAgent?: string }
): Promise<VerifyEmailResult> {
  const tokenRecord = await consumeToken(dto.token, TOKEN_TYPES.EMAIL_VERIFICATION);

  // Cek user masih ada & aktif
  const user = (await prisma.users.findUnique({
    where: { id: tokenRecord.user_id },
    select: {
      id: true,
      email: true,
      is_active: true,
      deleted_at: true,
      email_verified_at: true,
    },
  })) as { id: string; email: string | null; is_active: boolean; deleted_at: Date | null; email_verified_at: Date | null } | null;

  if (!user || user.deleted_at) {
    throw new NotFoundError('User');
  }

  if (user.email_verified_at) {
    // Idempotent: sudah verified, beri response sukses tetap
    return {
      message: 'Email sudah terverifikasi sebelumnya.',
      user: {
        id: user.id,
        email: user.email ?? '',
        emailVerified: true,
      },
    };
  }

  // Mark email as verified
  await prisma.users.update({
    where: { id: user.id },
    data: { email_verified_at: new Date() },
  });

  auditLog({
    action: AUDIT_ACTIONS.EMAIL_VERIFIED,
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { email: user.email },
  });

  log.info({ userId: user.id, email: user.email }, 'Email verified');

  return {
    message: 'Email berhasil diverifikasi.',
    user: {
      id: user.id,
      email: user.email ?? '',
      emailVerified: true,
    },
  };
}

// ════════════════════════════════════════════════════════════════
// 3. FORGOT PASSWORD
// ════════════════════════════════════════════════════════════════

export async function forgotPassword(
  dto: ForgotPasswordDto,
  meta: { ip?: string; userAgent?: string }
): Promise<ForgotPasswordResult> {
  // Validasi appClientId — app harus ada & aktif
  const app = (await prisma.apps.findUnique({
    where: { client_id: dto.appClientId },
    select: { id: true, is_active: true, deleted_at: true },
  })) as { id: string; is_active: boolean; deleted_at: Date | null } | null;

  // Selalu return pesan yang sama (anti email-enumeration)
  const genericResponse: ForgotPasswordResult = {
    message: 'Jika email terdaftar, link reset password telah dikirim.',
  };

  if (!app || !app.is_active || app.deleted_at) {
    log.warn({ appClientId: dto.appClientId }, 'forgotPassword: app not found');
    return genericResponse;
  }

  const user = await findActiveUserByEmail(dto.email);

  if (!user || user.deleted_at || user.is_banned || !user.is_active) {
    // Tidak bocorkan info — tetap return generic message
    log.info({ email: dto.email }, 'forgotPassword: user not found or inactive, silently ignored');
    return genericResponse;
  }

  const tokenRaw = await createVerificationToken(
    user.id,
    TOKEN_TYPES.PASSWORD_RESET,
    dto.email,
    env.PASSWORD_RESET_TTL_MINUTES,
    meta.ip
  );

  const displayName = user.display_name ?? user.username ?? dto.email.split('@')[0];

  setImmediate(() => {
    void sendPasswordResetEmail(dto.email, displayName, tokenRaw);
  });

  auditLog({
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
    userId: user.id,
    appId: app.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { email: dto.email },
  });

  log.info({ userId: user.id, email: dto.email }, 'Password reset email queued');

  return genericResponse;
}

// ════════════════════════════════════════════════════════════════
// 4. RESET PASSWORD
// ════════════════════════════════════════════════════════════════

export async function resetPassword(
  dto: ResetPasswordDto,
  meta: { ip?: string; userAgent?: string }
): Promise<ResetPasswordResult> {
  const tokenRecord = await consumeToken(dto.token, TOKEN_TYPES.PASSWORD_RESET);

  const user = (await prisma.users.findUnique({
    where: { id: tokenRecord.user_id },
    select: { id: true, email: true, is_active: true, deleted_at: true },
  })) as { id: string; email: string | null; is_active: boolean; deleted_at: Date | null } | null;

  if (!user || user.deleted_at) throw new NotFoundError('User');
  if (!user.is_active) throw new AccountInactiveError();

  // Cek password history — tidak boleh sama dengan N password terakhir
  const passwordRecord = (await prisma.passwords.findUnique({
    where: { user_id: user.id },
    select: { id: true, password_hash: true, previous_hashes: true },
  })) as PasswordRow | null;

  if (passwordRecord) {
    // Cek current password
    const matchesCurrent = await verifyPassword(dto.newPassword, passwordRecord.password_hash);
    if (matchesCurrent) {
      throw new BadRequestError(
        'Password baru tidak boleh sama dengan password saat ini.'
      );
    }

    // Cek password history
    const history = Array.isArray(passwordRecord.previous_hashes)
      ? (passwordRecord.previous_hashes as string[])
      : [];

    const recentHistory = history.slice(-PASSWORD_POLICY.HISTORY_COUNT);
    for (const oldHash of recentHistory) {
      const matchesOld = await verifyPassword(dto.newPassword, oldHash);
      if (matchesOld) {
        throw new BadRequestError(
          `Password baru tidak boleh sama dengan ${PASSWORD_POLICY.HISTORY_COUNT} password terakhir.`
        );
      }
    }
  }

  const newHash = await hashPassword(dto.newPassword);

  // Update atau buat password record
  if (passwordRecord) {
    const history = Array.isArray(passwordRecord.previous_hashes)
      ? (passwordRecord.previous_hashes as string[])
      : [];

    await prisma.passwords.update({
      where: { user_id: user.id },
      data: {
        password_hash: newHash,
        previous_hashes: [...history, passwordRecord.password_hash].slice(
          -PASSWORD_POLICY.HISTORY_COUNT
        ),
        must_change: false,
        changed_at: new Date(),
      },
    });
  } else {
    await prisma.passwords.create({
      data: {
        id: uuidv4(),
        user_id: user.id,
        password_hash: newHash,
        previous_hashes: [],
      },
    });
  }

  // Revoke semua session aktif setelah reset password
  const sessions = (await prisma.sessions.findMany({
    where: { user_id: user.id, status: SESSION_STATUS.ACTIVE },
    select: { id: true },
  })) as Array<{ id: string }>;

  const sessionIds = sessions.map((s) => s.id);

  if (sessionIds.length > 0) {
    await prisma.sessions.updateMany({
      where: { id: { in: sessionIds } },
      data: {
        status: SESSION_STATUS.REVOKED,
        revoked_at: new Date(),
        revoke_reason: 'password_reset',
      },
    });

    await prisma.refresh_tokens.updateMany({
      where: { session_id: { in: sessionIds }, revoked_at: null },
      data: { revoked_at: new Date(), revoke_reason: 'password_reset' },
    });
  }

  auditLog({
    action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { email: user.email, revokedSessions: sessionIds.length },
  });

  log.info(
    { userId: user.id, revokedSessions: sessionIds.length },
    'Password reset completed'
  );

  return {
    message: 'Password berhasil direset. Silakan login dengan password baru.',
    revokedSessions: sessionIds.length,
  };
}

// ════════════════════════════════════════════════════════════════
// 5. CHANGE PASSWORD (authenticated)
// ════════════════════════════════════════════════════════════════

export async function changePassword(
  dto: ChangePasswordDto,
  userId: string,
  currentSessionId: string,
  meta: { ip?: string; userAgent?: string }
): Promise<ChangePasswordResult> {
  // Ambil password record
  const passwordRecord = (await prisma.passwords.findUnique({
    where: { user_id: userId },
    select: { id: true, password_hash: true, previous_hashes: true },
  })) as PasswordRow | null;

  if (!passwordRecord) {
    // User login via OAuth dan belum punya password
    throw new BadRequestError(
      'Akun kamu belum memiliki password. Gunakan fitur "Set Password" untuk membuat password.'
    );
  }

  // Verifikasi password saat ini
  const isCurrentValid = await verifyPassword(
    dto.currentPassword,
    passwordRecord.password_hash
  );

  if (!isCurrentValid) {
    auditLog({
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      userId,
      status: 'failure',
      ip: meta.ip,
      userAgent: meta.userAgent,
      errorMessage: 'Current password mismatch',
    });
    throw new InvalidCredentialsError('Password saat ini tidak sesuai.');
  }

  // Cek history password
  const history = Array.isArray(passwordRecord.previous_hashes)
    ? (passwordRecord.previous_hashes as string[])
    : [];

  const recentHistory = history.slice(-PASSWORD_POLICY.HISTORY_COUNT);
  for (const oldHash of recentHistory) {
    const matchesOld = await verifyPassword(dto.newPassword, oldHash);
    if (matchesOld) {
      throw new BadRequestError(
        `Password baru tidak boleh sama dengan ${PASSWORD_POLICY.HISTORY_COUNT} password terakhir.`
      );
    }
  }

  const newHash = await hashPassword(dto.newPassword);

  await prisma.passwords.update({
    where: { user_id: userId },
    data: {
      password_hash: newHash,
      previous_hashes: [...history, passwordRecord.password_hash].slice(
        -PASSWORD_POLICY.HISTORY_COUNT
      ),
      must_change: false,
      changed_at: new Date(),
    },
  });

  // Revoke sessions lain (kecuali yang sedang aktif) jika diminta
  if (dto.revokeOtherSessions) {
    const otherSessions = (await prisma.sessions.findMany({
      where: {
        user_id: userId,
        status: SESSION_STATUS.ACTIVE,
        id: { not: currentSessionId },
      },
      select: { id: true },
    })) as Array<{ id: true }>;

    const otherSessionIds = otherSessions.map((s) => String(s.id));

    if (otherSessionIds.length > 0) {
      await prisma.sessions.updateMany({
        where: { id: { in: otherSessionIds } },
        data: {
          status: SESSION_STATUS.REVOKED,
          revoked_at: new Date(),
          revoke_reason: 'password_changed',
        },
      });

      await prisma.refresh_tokens.updateMany({
        where: { session_id: { in: otherSessionIds }, revoked_at: null },
        data: { revoked_at: new Date(), revoke_reason: 'password_changed' },
      });
    }
  }

  auditLog({
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    userId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { revokeOtherSessions: dto.revokeOtherSessions },
  });

  log.info({ userId, revokeOtherSessions: dto.revokeOtherSessions }, 'Password changed');

  return { message: 'Password berhasil diubah.' };
}
