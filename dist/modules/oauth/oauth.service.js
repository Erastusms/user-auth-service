"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateOAuth = initiateOAuth;
exports.handleOAuthCallback = handleOAuthCallback;
exports.initiateLinkOAuth = initiateLinkOAuth;
exports.unlinkOAuth = unlinkOAuth;
exports.getLinkedProviders = getLinkedProviders;
const uuid_1 = require("uuid");
const prisma_1 = __importDefault(require("../../lib/prisma"));
const crypto_1 = require("../../lib/crypto");
const jwt_1 = require("../../lib/jwt");
const logger_1 = require("../../lib/logger");
const env_1 = require("../../config/env");
const errors_1 = require("../../shared/errors");
const constants_1 = require("../../config/constants");
const oauth_providers_1 = require("./oauth.providers");
const pkce_1 = require("../../lib/pkce");
const log = (0, logger_1.createLogger)('oauth.service');
// ════════════════════════════════════════════════════════════════
// INTERNAL HELPERS (shared dengan auth.service — direplikasi agar tetap loosely coupled)
// ════════════════════════════════════════════════════════════════
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
async function loadRolesAndPermissions(userId, appId) {
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
async function createSession(userId, appId, ttlSeconds, meta) {
    const sessionId = (0, uuid_1.v4)();
    await prisma_1.default.sessions.create({
        data: {
            id: sessionId,
            user_id: userId,
            app_id: appId,
            status: constants_1.SESSION_STATUS.ACTIVE,
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
async function createTokenPair(userId, sessionId, appId, app) {
    const refreshTokenRaw = (0, crypto_1.generateSecureToken)(48);
    const tokenHash = (0, crypto_1.hashToken)(refreshTokenRaw);
    const tokenFamily = (0, uuid_1.v4)();
    await prisma_1.default.refresh_tokens.create({
        data: {
            id: (0, uuid_1.v4)(),
            session_id: sessionId,
            user_id: userId,
            app_id: appId,
            token_hash: tokenHash,
            family: tokenFamily,
            expires_at: new Date(Date.now() + app.refresh_token_ttl * 1000),
        },
    });
    const accessToken = (0, jwt_1.signAccessToken)({ sub: userId, sessionId, appId });
    return {
        accessToken,
        refreshToken: refreshTokenRaw,
        expiresIn: app.access_token_ttl,
    };
}
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
            ip_address: data.ip ?? null,
            user_agent: data.userAgent ?? null,
            metadata: data.metadata
                ? JSON.parse(JSON.stringify(data.metadata))
                : null,
        },
    })
        .catch((e) => log.error({ err: e }, 'Failed to write audit log'));
}
// ════════════════════════════════════════════════════════════════
// 1. INITIATE — Buat authorization URL & simpan state di DB
// ════════════════════════════════════════════════════════════════
async function initiateOAuth(provider, query, meta) {
    if (!(0, oauth_providers_1.isValidProvider)(provider)) {
        throw new errors_1.BadRequestError(`Provider '${provider}' tidak didukung. Pilih: google, github.`);
    }
    const app = await findActiveApp(query.appClientId);
    // Cek apakah provider credentials sudah di-set
    const providerConfig = oauth_providers_1.OAUTH_PROVIDERS[provider];
    if (!providerConfig)
        throw new errors_1.BadRequestError('Provider tidak valid.');
    // Validasi credentials tersedia (skip di test env — credentials di-inject via env mock)
    if (env_1.env.NODE_ENV !== 'test') {
        if (provider === 'google' &&
            (!env_1.env.GOOGLE_CLIENT_ID || !env_1.env.GOOGLE_CLIENT_SECRET)) {
            throw new errors_1.BadRequestError('Google OAuth belum dikonfigurasi di server.');
        }
        if (provider === 'github' &&
            (!env_1.env.GITHUB_CLIENT_ID || !env_1.env.GITHUB_CLIENT_SECRET)) {
            throw new errors_1.BadRequestError('GitHub OAuth belum dikonfigurasi di server.');
        }
    }
    // Generate PKCE & state
    const state = (0, pkce_1.generateOAuthState)();
    const codeVerifier = (0, pkce_1.generateCodeVerifier)();
    const codeChallenge = (0, pkce_1.generateCodeChallenge)(codeVerifier);
    // Simpan state di DB (expire 10 menit)
    await prisma_1.default.oauth_states.create({
        data: {
            id: (0, uuid_1.v4)(),
            state,
            provider: provider,
            app_id: app.id,
            redirect_uri: query.redirectUri ?? env_1.env.FRONTEND_URL,
            code_verifier: codeVerifier,
            existing_user_id: meta.existingUserId ?? null,
            metadata: { appClientId: query.appClientId, ip: meta.ip },
            expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 menit
        },
    });
    const authUrl = (0, oauth_providers_1.buildAuthorizationUrl)(provider, state, codeChallenge);
    log.info({ provider, appId: app.id, hasExistingUser: !!meta.existingUserId }, 'OAuth initiated');
    return authUrl;
}
// ════════════════════════════════════════════════════════════════
// 2. CALLBACK — Verifikasi state, exchange code, create/find user
// ════════════════════════════════════════════════════════════════
async function handleOAuthCallback(provider, query, meta) {
    if (!(0, oauth_providers_1.isValidProvider)(provider)) {
        throw new errors_1.BadRequestError(`Provider '${provider}' tidak didukung.`);
    }
    // ── Handle provider error (user deny, dll) ────────────────
    if (query.error) {
        log.warn({ provider, error: query.error, desc: query.error_description }, 'OAuth provider error');
        throw new errors_1.BadRequestError(query.error === 'access_denied'
            ? 'Akses ke akun ditolak oleh pengguna.'
            : `OAuth error: ${query.error_description ?? query.error}`);
    }
    // ── Verifikasi state (CSRF check) ─────────────────────────
    const storedState = (await prisma_1.default.oauth_states.findUnique({
        where: { state: query.state },
    }));
    if (!storedState) {
        log.warn({ state: query.state }, 'OAuth state not found — possible CSRF');
        throw new errors_1.BadRequestError('OAuth state tidak valid. Kemungkinan CSRF attack atau session expired.');
    }
    if (storedState.provider !== provider) {
        throw new errors_1.BadRequestError('Provider tidak cocok dengan state yang disimpan.');
    }
    if (new Date() > storedState.expires_at) {
        await prisma_1.default.oauth_states.delete({ where: { state: query.state } });
        throw new errors_1.BadRequestError('OAuth session expired. Silakan coba login lagi.');
    }
    // Hapus state — single use
    await prisma_1.default.oauth_states.delete({ where: { state: query.state } });
    if (!storedState.code_verifier) {
        throw new errors_1.BadRequestError('Code verifier tidak ditemukan. Flow tidak valid.');
    }
    // ── Token Exchange ────────────────────────────────────────
    const tokenResponse = await (0, oauth_providers_1.exchangeCodeForToken)(provider, query.code, storedState.code_verifier);
    // ── Fetch User Info dari Provider ─────────────────────────
    const providerUser = await (0, oauth_providers_1.fetchProviderUserInfo)(provider, tokenResponse.access_token);
    log.info({
        provider,
        providerUserId: providerUser.providerUserId,
        email: providerUser.email,
    }, 'Provider user info fetched');
    // ── Get App Config ────────────────────────────────────────
    const app = (await prisma_1.default.apps.findUnique({
        where: { id: storedState.app_id },
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
    if (!app || !app.is_active)
        throw new errors_1.NotFoundError('Aplikasi');
    // ── Link Mode: user sudah login, ingin link provider baru ─
    if (storedState.existing_user_id) {
        return handleLinkCallback(provider, storedState.existing_user_id, providerUser, tokenResponse, app, meta);
    }
    // ── Login/Register Mode ───────────────────────────────────
    return handleLoginOrRegisterCallback(provider, providerUser, tokenResponse, app, meta);
}
// ── Sub-handler: login atau register via OAuth ────────────────
async function handleLoginOrRegisterCallback(provider, providerUser, tokenResponse, app, meta) {
    // Cek apakah identity sudah ada
    const existingIdentity = (await prisma_1.default.identities.findUnique({
        where: {
            uq_identities_provider: {
                provider,
                provider_user_id: providerUser.providerUserId,
            },
        },
        select: { id: true, user_id: true },
    }));
    let userId;
    let isNewUser = false;
    if (existingIdentity) {
        // ── User sudah pernah login via provider ini ──────────
        userId = existingIdentity.user_id;
        // Sync data terbaru dari provider
        await syncProviderData(existingIdentity.id, providerUser, tokenResponse);
        // Update last login
        void prisma_1.default.users
            .update({
            where: { id: userId },
            data: {
                last_login_at: new Date(),
                last_login_ip: meta.ip,
                login_count: { increment: 1 },
                // Sync avatar jika berubah
                ...(providerUser.avatarUrl
                    ? { avatar_url: providerUser.avatarUrl }
                    : {}),
            },
        })
            .catch((_e) => undefined);
    }
    else {
        // ── Identity belum ada — cek apakah email sudah terdaftar ─
        const existingUserByEmail = providerUser.email
            ? (await prisma_1.default.users.findUnique({
                where: { email: providerUser.email },
                select: { id: true, deleted_at: true },
            }))
            : null;
        if (existingUserByEmail && !existingUserByEmail.deleted_at) {
            // Email sudah ada → link ke existing user
            userId = existingUserByEmail.id;
            await createIdentityRecord(userId, provider, providerUser, tokenResponse);
            log.info({ userId, provider, email: providerUser.email }, 'OAuth linked to existing email user');
        }
        else {
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
    const { accessToken, refreshToken, expiresIn } = await createTokenPair(userId, sessionId, app.id, app);
    // Load roles & permissions
    const { roles, permissions } = await loadRolesAndPermissions(userId, app.id);
    // Ambil user data lengkap
    const user = (await prisma_1.default.users.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            username: true,
            display_name: true,
            avatar_url: true,
            email_verified_at: true,
        },
    }));
    auditLog({
        action: isNewUser ? constants_1.AUDIT_ACTIONS.USER_REGISTER : constants_1.AUDIT_ACTIONS.USER_LOGIN,
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
async function handleLinkCallback(provider, existingUserId, providerUser, tokenResponse, app, meta) {
    // Cek apakah provider ini sudah di-link ke user lain
    const alreadyLinked = (await prisma_1.default.identities.findUnique({
        where: {
            uq_identities_provider: {
                provider,
                provider_user_id: providerUser.providerUserId,
            },
        },
        select: { user_id: true },
    }));
    if (alreadyLinked && alreadyLinked.user_id !== existingUserId) {
        throw new errors_1.ConflictError(`Akun ${provider} ini sudah terhubung ke akun lain. Silakan gunakan akun ${provider} yang berbeda.`);
    }
    if (alreadyLinked && alreadyLinked.user_id === existingUserId) {
        throw new errors_1.ConflictError(`Akun ${provider} ini sudah terhubung ke akun kamu.`);
    }
    // Link provider ke existing user
    await createIdentityRecord(existingUserId, provider, providerUser, tokenResponse);
    // Buat session baru
    const sessionId = await createSession(existingUserId, app.id, app.refresh_token_ttl, {
        ...meta,
        provider,
    });
    const { accessToken, refreshToken, expiresIn } = await createTokenPair(existingUserId, sessionId, app.id, app);
    const { roles, permissions } = await loadRolesAndPermissions(existingUserId, app.id);
    const user = (await prisma_1.default.users.findUnique({
        where: { id: existingUserId },
        select: {
            id: true,
            email: true,
            username: true,
            display_name: true,
            avatar_url: true,
            email_verified_at: true,
        },
    }));
    auditLog({
        action: constants_1.AUDIT_ACTIONS.OAUTH_LINKED,
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
async function autoRegisterOAuthUser(provider, providerUser, app) {
    const userId = (0, uuid_1.v4)();
    const displayName = providerUser.displayName;
    // Generate random password hash (user tidak tahu password ini — login via OAuth saja)
    const randomPasswordHash = await (0, crypto_1.hashPassword)((0, crypto_1.generateSecureToken)(24));
    // Cari role member
    const memberRole = (await prisma_1.default.roles.findFirst({
        where: { slug: 'member', OR: [{ app_id: app.id }, { app_id: null }] },
        select: { id: true },
    }));
    await prisma_1.default.$transaction(async (tx) => {
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
            data: {
                id: (0, uuid_1.v4)(),
                user_id: userId,
                password_hash: randomPasswordHash,
            },
        });
        // 3. Profile
        await tx.user_profiles.create({
            data: {
                id: (0, uuid_1.v4)(),
                user_id: userId,
                first_name: providerUser.firstName,
                last_name: providerUser.lastName,
            },
        });
        // 4. Membership
        await tx.user_app_memberships.create({
            data: {
                id: (0, uuid_1.v4)(),
                user_id: userId,
                app_id: app.id,
                status: 'active',
                joined_at: new Date(),
            },
        });
        // 5. Identity record
        await tx.identities.create({
            data: {
                id: (0, uuid_1.v4)(),
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
                    id: (0, uuid_1.v4)(),
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
async function createIdentityRecord(userId, provider, providerUser, tokenResponse) {
    await prisma_1.default.identities.create({
        data: {
            id: (0, uuid_1.v4)(),
            user_id: userId,
            provider,
            provider_user_id: providerUser.providerUserId,
            provider_email: providerUser.email,
            provider_access_token: (0, oauth_providers_1.encryptProviderToken)(tokenResponse.access_token),
            provider_refresh_token: tokenResponse.refresh_token
                ? (0, oauth_providers_1.encryptProviderToken)(tokenResponse.refresh_token)
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
async function syncProviderData(identityId, providerUser, tokenResponse) {
    await prisma_1.default.identities.update({
        where: { id: identityId },
        data: {
            provider_email: providerUser.email,
            provider_access_token: (0, oauth_providers_1.encryptProviderToken)(tokenResponse.access_token),
            provider_refresh_token: tokenResponse.refresh_token
                ? (0, oauth_providers_1.encryptProviderToken)(tokenResponse.refresh_token)
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
async function initiateLinkOAuth(body, userId, appClientId, meta) {
    const provider = body.provider;
    // Cek apakah sudah di-link
    const existing = (await prisma_1.default.identities.findFirst({
        where: { user_id: userId, provider },
        select: { id: true },
    }));
    if (existing) {
        throw new errors_1.ConflictError(`Akun ${provider} sudah terhubung ke akun kamu.`);
    }
    const authUrl = await initiateOAuth(provider, { appClientId, redirectUri: body.redirectUri }, { ip: meta.ip, existingUserId: userId });
    return {
        authorizationUrl: authUrl,
        message: `Redirect user ke URL ini untuk menghubungkan akun ${provider}.`,
    };
}
// ════════════════════════════════════════════════════════════════
// 4. UNLINK — Hapus linked OAuth dari user
// ════════════════════════════════════════════════════════════════
async function unlinkOAuth(param, userId, meta) {
    const provider = param.provider;
    // Cek identity ada
    const identity = (await prisma_1.default.identities.findFirst({
        where: { user_id: userId, provider },
        select: { id: true },
    }));
    if (!identity) {
        throw new errors_1.NotFoundError(`Akun ${provider} tidak terhubung ke akun kamu.`);
    }
    // Cek total login methods — tidak boleh hapus satu-satunya
    const [identityCount, passwordRecord] = await Promise.all([
        prisma_1.default.identities.count({ where: { user_id: userId } }),
        prisma_1.default.passwords.findUnique({
            where: { user_id: userId },
            select: { id: true },
        }),
    ]);
    const hasPassword = !!passwordRecord;
    const totalMethods = identityCount + (hasPassword ? 1 : 0);
    if (totalMethods <= 1) {
        throw new errors_1.ForbiddenError('Tidak bisa menghapus satu-satunya metode login. ' +
            'Tambahkan password atau hubungkan provider lain terlebih dahulu.', 'LAST_LOGIN_METHOD');
    }
    // Hapus identity
    await prisma_1.default.identities.deleteMany({ where: { user_id: userId, provider } });
    // Ambil sisa providers
    const remaining = (await prisma_1.default.identities.findMany({
        where: { user_id: userId },
        select: { provider: true },
    }));
    const remainingProviders = remaining.map((i) => i.provider);
    if (hasPassword)
        remainingProviders.unshift('email');
    auditLog({
        action: constants_1.AUDIT_ACTIONS.OAUTH_UNLINKED,
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
async function getLinkedProviders(userId) {
    const identities = (await prisma_1.default.identities.findMany({
        where: { user_id: userId },
        select: { provider: true, provider_email: true, created_at: true },
        orderBy: { created_at: 'asc' },
    }));
    return identities.map((i) => ({
        provider: i.provider,
        email: i.provider_email,
        linkedAt: i.created_at,
    }));
}
//# sourceMappingURL=oauth.service.js.map