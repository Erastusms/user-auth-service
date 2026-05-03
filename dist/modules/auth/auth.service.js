"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.logout = logout;
exports.refresh = refresh;
exports.revokeAll = revokeAll;
const uuid_1 = require("uuid");
const prisma_1 = __importDefault(require("../../lib/prisma"));
const crypto_1 = require("../../lib/crypto");
const jwt_1 = require("../../lib/jwt");
const email_1 = require("../../lib/email");
const logger_1 = require("../../lib/logger");
const env_1 = require("../../config/env");
const errors_1 = require("../../shared/errors");
const constants_1 = require("../../config/constants");
const log = (0, logger_1.createLogger)('auth.service');
// ════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ════════════════════════════════════════════════════════════════
/** Ambil app berdasarkan client_id. Throw jika tidak ditemukan / inactive. */
async function findActiveApp(clientId) {
    const app = (await prisma_1.default.apps.findUnique({
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
    }));
    if (!app || !app.is_active || app.deleted_at) {
        throw new errors_1.NotFoundError('Aplikasi');
    }
    return app;
}
/** Load roles + permissions user untuk app tertentu. */
async function loadUserRolesAndPermissions(userId, appId) {
    const userRoles = (await prisma_1.default.user_roles.findMany({
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
    }));
    const roles = [...new Set(userRoles.map((ur) => String(ur.roles.slug)))];
    const permissions = [
        ...new Set(userRoles.flatMap((ur) => ur.roles.role_permissions.map((rp) => String(rp.permissions.slug)))),
    ];
    return { roles, permissions };
}
/** Buat session baru di DB. */
async function createSession(userId, appId, meta, ttlSeconds) {
    const sessionId = (0, uuid_1.v4)();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await prisma_1.default.sessions.create({
        data: {
            id: sessionId,
            user_id: userId,
            app_id: appId,
            status: constants_1.SESSION_STATUS.ACTIVE,
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
async function createTokenPair(userId, sessionId, appId, app, family) {
    // Generate refresh token raw (yang dikirim ke client)
    const refreshTokenRaw = (0, crypto_1.generateSecureToken)(48); // 96-char hex
    const tokenHash = (0, crypto_1.hashToken)(refreshTokenRaw);
    const tokenFamily = family ?? (0, uuid_1.v4)();
    const expiresAt = new Date(Date.now() + app.refresh_token_ttl * 1000);
    // Simpan hash di DB
    await prisma_1.default.refresh_tokens.create({
        data: {
            id: (0, uuid_1.v4)(),
            session_id: sessionId,
            user_id: userId,
            app_id: appId,
            token_hash: tokenHash,
            family: tokenFamily,
            expires_at: expiresAt,
        },
    });
    // Sign access token
    const accessToken = (0, jwt_1.signAccessToken)({
        sub: userId,
        sessionId,
        appId,
    });
    const tokenPair = {
        accessToken,
        refreshToken: refreshTokenRaw,
        tokenType: 'Bearer',
        expiresIn: app.access_token_ttl,
    };
    return { tokenPair, refreshTokenRaw };
}
/** Tulis audit log (fire-and-forget). */
function auditLog(data) {
    prisma_1.default.audit_logs
        .create({
        data: {
            id: (0, uuid_1.v4)(),
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
        .catch((e) => log.error({ err: e }, 'Failed to write audit log'));
}
// ════════════════════════════════════════════════════════════════
// PUBLIC SERVICE METHODS
// ════════════════════════════════════════════════════════════════
// ── Register ──────────────────────────────────────────────────
async function register(dto, meta) {
    const app = await findActiveApp(dto.appClientId);
    // Cek email sudah terdaftar
    const existingUser = await prisma_1.default.users.findUnique({
        where: { email: dto.email },
        select: { id: true, deleted_at: true },
    });
    if (existingUser && !existingUser.deleted_at) {
        auditLog({
            action: constants_1.AUDIT_ACTIONS.USER_REGISTER,
            appId: app.id,
            status: 'failure',
            ip: meta.ip,
            userAgent: meta.userAgent,
            metadata: { email: dto.email, reason: 'email_already_exists' },
        });
        throw new errors_1.ConflictError('Email sudah terdaftar.');
    }
    // Hash password
    const passwordHash = await (0, crypto_1.hashPassword)(dto.password);
    const userId = (0, uuid_1.v4)();
    const displayName = dto.displayName ?? dto.username ?? dto.email.split('@')[0];
    // Buat verification token
    const verificationTokenRaw = (0, crypto_1.generateUrlSafeToken)(32);
    const verificationTokenHash = (0, crypto_1.hashToken)(verificationTokenRaw);
    const verificationExpiresAt = new Date(Date.now() + env_1.env.EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000);
    // Cari role 'member' untuk app ini (atau global)
    const memberRole = (await prisma_1.default.roles.findFirst({
        where: {
            slug: 'member',
            OR: [{ app_id: app.id }, { app_id: null }],
        },
        select: { id: true },
    }));
    // ── Prisma Transaction ────────────────────────────────────────
    await prisma_1.default.$transaction(async (tx) => {
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
                id: (0, uuid_1.v4)(),
                user_id: userId,
                password_hash: passwordHash,
            },
        });
        // 3. Buat profile
        await tx.user_profiles.create({
            data: {
                id: (0, uuid_1.v4)(),
                user_id: userId,
            },
        });
        // 4. Buat membership di app ini
        await tx.user_app_memberships.create({
            data: {
                id: (0, uuid_1.v4)(),
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
                    id: (0, uuid_1.v4)(),
                    user_id: userId,
                    role_id: memberRole.id,
                    app_id: app.id,
                },
            });
        }
        // 6. Buat verification token
        await tx.verification_tokens.create({
            data: {
                id: (0, uuid_1.v4)(),
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
        void (0, email_1.sendVerificationEmail)(dto.email, displayName, verificationTokenRaw);
    });
    auditLog({
        action: constants_1.AUDIT_ACTIONS.USER_REGISTER,
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
async function login(dto, meta) {
    const app = await findActiveApp(dto.appClientId);
    // Cari user beserta password-nya
    const user = (await prisma_1.default.users.findUnique({
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
    }));
    // User tidak ditemukan atau sudah dihapus — jangan bocorkan info ini
    if (!user || user.deleted_at || !user.passwords) {
        auditLog({
            action: constants_1.AUDIT_ACTIONS.USER_LOGIN_FAILED,
            appId: app.id,
            status: 'failure',
            ip: meta.ip,
            userAgent: meta.userAgent,
            metadata: { email: dto.email, reason: 'user_not_found' },
        });
        throw new errors_1.InvalidCredentialsError();
    }
    // Verifikasi password
    const passwordMatch = await (0, crypto_1.verifyPassword)(dto.password, user.passwords.password_hash);
    if (!passwordMatch) {
        auditLog({
            action: constants_1.AUDIT_ACTIONS.USER_LOGIN_FAILED,
            userId: user.id,
            appId: app.id,
            status: 'failure',
            ip: meta.ip,
            userAgent: meta.userAgent,
            metadata: { reason: 'wrong_password' },
        });
        throw new errors_1.InvalidCredentialsError();
    }
    // Cek status akun
    if (user.is_banned) {
        throw new errors_1.AccountBannedError(user.ban_reason ?? undefined);
    }
    if (!user.is_active) {
        throw new errors_1.AccountInactiveError();
    }
    // Load roles & permissions
    const { roles, permissions } = await loadUserRolesAndPermissions(user.id, app.id);
    // Buat session
    const sessionId = await createSession(user.id, app.id, {
        ...meta,
        deviceName: dto.deviceName,
        deviceType: dto.deviceType,
    }, app.refresh_token_ttl);
    // Buat token pair
    const { tokenPair } = await createTokenPair(user.id, sessionId, app.id, app);
    // Update last_login stats (fire-and-forget)
    prisma_1.default.users
        .update({
        where: { id: user.id },
        data: {
            last_login_at: new Date(),
            last_login_ip: meta.ip,
            login_count: { increment: 1 },
        },
    })
        .catch((_err) => log.warn('Failed to update login stats'));
    auditLog({
        action: constants_1.AUDIT_ACTIONS.USER_LOGIN,
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
async function logout(dto, userId, sessionId, meta) {
    const tokenHash = (0, crypto_1.hashToken)(dto.refreshToken);
    // Cari refresh token di DB
    const refreshToken = (await prisma_1.default.refresh_tokens.findUnique({
        where: { token_hash: tokenHash },
        select: {
            id: true,
            session_id: true,
            user_id: true,
            app_id: true,
            revoked_at: true,
        },
    }));
    // Revoke refresh token (jika ditemukan dan milik user ini)
    if (refreshToken &&
        refreshToken.user_id === userId &&
        !refreshToken.revoked_at) {
        await prisma_1.default.refresh_tokens.update({
            where: { id: refreshToken.id },
            data: {
                revoked_at: new Date(),
                revoke_reason: 'user_logout',
            },
        });
    }
    // Revoke session
    await prisma_1.default.sessions.update({
        where: { id: sessionId },
        data: {
            status: constants_1.SESSION_STATUS.REVOKED,
            revoked_at: new Date(),
            revoke_reason: 'user_logout',
        },
    });
    auditLog({
        action: constants_1.AUDIT_ACTIONS.USER_LOGOUT,
        userId,
        sessionId,
        ip: meta.ip,
        userAgent: meta.userAgent,
    });
    log.info({ userId, sessionId }, 'User logged out');
}
// ── Refresh Token ─────────────────────────────────────────────
async function refresh(dto) {
    const app = await findActiveApp(dto.appClientId);
    // Hash token yang dikirim client untuk dicari di DB
    const tokenHash = (0, crypto_1.hashToken)(dto.refreshToken);
    const storedToken = (await prisma_1.default.refresh_tokens.findUnique({
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
    }));
    // Token tidak ditemukan
    if (!storedToken) {
        throw new errors_1.TokenInvalidError('Refresh token tidak valid.');
    }
    // Token sudah direvoke
    if (storedToken.revoked_at) {
        throw new errors_1.TokenInvalidError('Refresh token sudah tidak berlaku.');
    }
    // Token sudah expired
    if (new Date() > storedToken.expires_at) {
        throw new errors_1.TokenInvalidError('Refresh token sudah kadaluarsa.');
    }
    // ── REUSE ATTACK DETECTION ────────────────────────────────────
    // Jika token sudah pernah dipakai (used_at != null) tapi ada yang mencoba
    // pakai lagi → ini adalah reuse attack. Revoke seluruh family!
    if (storedToken.used_at) {
        log.warn({
            userId: storedToken.user_id,
            family: storedToken.family,
            tokenId: storedToken.id,
        }, 'Refresh token reuse detected — revoking entire family');
        // Revoke semua token dalam family yang sama
        await prisma_1.default.refresh_tokens.updateMany({
            where: { family: storedToken.family },
            data: {
                revoked_at: new Date(),
                revoke_reason: 'reuse_attack',
            },
        });
        // Revoke session terkait
        await prisma_1.default.sessions.update({
            where: { id: storedToken.session_id },
            data: {
                status: constants_1.SESSION_STATUS.REVOKED,
                revoked_at: new Date(),
                revoke_reason: 'refresh_token_reuse',
            },
        });
        auditLog({
            action: constants_1.AUDIT_ACTIONS.REFRESH_TOKEN_REUSE,
            userId: storedToken.user_id,
            appId: storedToken.app_id,
            sessionId: storedToken.session_id,
            status: 'failure',
            metadata: { family: storedToken.family },
        });
        throw new errors_1.UnauthorizedError('Aktivitas mencurigakan terdeteksi. Silakan login ulang.');
    }
    // Verifikasi session masih aktif
    const session = (await prisma_1.default.sessions.findUnique({
        where: { id: storedToken.session_id },
        select: {
            id: true,
            user_id: true,
            app_id: true,
            status: true,
            expires_at: true,
        },
    }));
    if (!session || session.status !== constants_1.SESSION_STATUS.ACTIVE) {
        throw new errors_1.UnauthorizedError('Session sudah tidak aktif. Silakan login ulang.');
    }
    if (new Date() > session.expires_at) {
        throw new errors_1.UnauthorizedError('Session sudah expired. Silakan login ulang.');
    }
    // ── TOKEN ROTATION ────────────────────────────────────────────
    // 1. Tandai token lama sebagai sudah dipakai
    const newTokenId = (0, uuid_1.v4)();
    await prisma_1.default.refresh_tokens.update({
        where: { id: storedToken.id },
        data: {
            used_at: new Date(),
            replaced_by: newTokenId,
        },
    });
    // 2. Buat refresh token baru dalam family yang sama
    const refreshTokenRaw = (0, crypto_1.generateSecureToken)(48);
    const newTokenHash = (0, crypto_1.hashToken)(refreshTokenRaw);
    const newExpiresAt = new Date(Date.now() + app.refresh_token_ttl * 1000);
    await prisma_1.default.refresh_tokens.create({
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
    const accessToken = (0, jwt_1.signAccessToken)({
        sub: storedToken.user_id,
        sessionId: storedToken.session_id,
        appId: app.id,
    });
    // Update session last_active_at
    void prisma_1.default.sessions
        .update({
        where: { id: storedToken.session_id },
        data: { last_active_at: new Date() },
    })
        .catch(() => undefined);
    auditLog({
        action: constants_1.AUDIT_ACTIONS.TOKEN_REFRESHED,
        userId: storedToken.user_id,
        appId: storedToken.app_id,
        sessionId: storedToken.session_id,
    });
    log.info({ userId: storedToken.user_id, sessionId: storedToken.session_id }, 'Token refreshed');
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
async function revokeAll(dto, userId, currentSessionId, meta) {
    // Bangun where clause untuk sessions yang akan direvoke
    const sessionWhere = {
        user_id: userId,
        status: constants_1.SESSION_STATUS.ACTIVE,
    };
    if (dto.exceptCurrentSession) {
        sessionWhere['id'] = { not: currentSessionId };
    }
    // Ambil semua session yang akan direvoke untuk audit trail
    const sessionsToRevoke = (await prisma_1.default.sessions.findMany({
        where: sessionWhere,
        select: { id: true },
    }));
    const sessionIds = sessionsToRevoke.map((s) => s.id);
    const revokedCount = sessionIds.length;
    if (revokedCount === 0) {
        return {
            revokedCount: 0,
            message: 'Tidak ada session aktif yang perlu direvoke.',
        };
    }
    // Revoke semua sessions
    await prisma_1.default.sessions.updateMany({
        where: { id: { in: sessionIds } },
        data: {
            status: constants_1.SESSION_STATUS.REVOKED,
            revoked_at: new Date(),
            revoke_reason: dto.exceptCurrentSession ? 'revoke_others' : 'revoke_all',
        },
    });
    // Revoke semua refresh tokens dari sessions yang direvoke
    await prisma_1.default.refresh_tokens.updateMany({
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
        action: constants_1.AUDIT_ACTIONS.TOKEN_REVOKE_ALL,
        userId,
        sessionId: currentSessionId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: {
            revokedCount,
            exceptCurrentSession: dto.exceptCurrentSession,
        },
    });
    log.info({ userId, revokedCount, exceptCurrentSession: dto.exceptCurrentSession }, 'All sessions revoked');
    return {
        revokedCount,
        message: `${revokedCount} session berhasil direvoke.`,
    };
}
//# sourceMappingURL=auth.service.js.map