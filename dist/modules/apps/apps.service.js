"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerApp = registerApp;
const uuid_1 = require("uuid");
const prisma_1 = __importDefault(require("../../lib/prisma"));
const crypto_1 = require("../../lib/crypto");
const logger_1 = require("../../lib/logger");
const errors_1 = require("../../shared/errors");
const constants_1 = require("../../config/constants");
const log = (0, logger_1.createLogger)('apps.service');
// ════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ════════════════════════════════════════════════════════════════
/** Tulis audit log (fire-and-forget). */
function auditLog(data) {
    prisma_1.default.audit_logs
        .create({
        data: {
            id: (0, uuid_1.v4)(),
            action: data.action,
            user_id: data.userId ?? null,
            app_id: data.appId ?? null,
            session_id: null,
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
// ── Register App ──────────────────────────────────────────────
async function registerApp(dto, meta) {
    // ── Cek slug sudah dipakai ─────────────────────────────────
    const existingApp = await prisma_1.default.apps.findUnique({
        where: { slug: dto.slug },
        select: { id: true, deleted_at: true },
    });
    if (existingApp && !existingApp.deleted_at) {
        throw new errors_1.ConflictError(`Slug '${dto.slug}' sudah digunakan oleh aplikasi lain.`);
    }
    // ── Cek apakah email admin sudah terdaftar ────────────────
    const existingUser = (await prisma_1.default.users.findUnique({
        where: { email: dto.adminEmail },
        select: {
            id: true,
            email: true,
            display_name: true,
            is_active: true,
            is_banned: true,
            deleted_at: true,
        },
    }));
    // Jika user sudah ada tapi di-ban atau dihapus → tolak
    if (existingUser) {
        if (existingUser.deleted_at) {
            throw new errors_1.ConflictError('Akun dengan email tersebut sudah dihapus. Gunakan email lain.');
        }
        if (existingUser.is_banned) {
            throw new errors_1.ConflictError('Akun dengan email tersebut tidak dapat digunakan.');
        }
    }
    // ── Persiapan data ────────────────────────────────────────
    const appId = (0, uuid_1.v4)();
    const clientId = (0, crypto_1.generateClientId)();
    const clientSecret = (0, crypto_1.generateClientSecret)();
    const adminDisplayName = dto.adminDisplayName ??
        existingUser?.display_name ??
        dto.adminEmail.split('@')[0];
    let adminUserId;
    let isNewUser;
    if (existingUser) {
        adminUserId = existingUser.id;
        isNewUser = false;
    }
    else {
        adminUserId = (0, uuid_1.v4)();
        isNewUser = true;
    }
    // Hash password hanya jika user baru
    const passwordHash = isNewUser ? await (0, crypto_1.hashPassword)(dto.adminPassword) : null;
    // ── Validasi slug role tidak duplikat antar input ─────────
    const roleSlugsInput = dto.roles.map((r) => r.slug);
    const uniqueRoleSlugs = new Set(roleSlugsInput);
    if (uniqueRoleSlugs.size !== roleSlugsInput.length) {
        throw new errors_1.ConflictError('Terdapat duplikat slug role pada input.');
    }
    // ── Prisma Transaction ─────────────────────────────────────
    let createdApp;
    let createdRoles;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma_1.default.$transaction(async (tx) => {
        // 1. Buat aplikasi
        createdApp = (await tx.apps.create({
            data: {
                id: appId,
                name: dto.name,
                slug: dto.slug,
                description: dto.description ?? null,
                client_id: clientId,
                client_secret: clientSecret,
                allowed_callback_urls: dto.allowedCallbackUrls,
                allowed_logout_urls: dto.allowedLogoutUrls,
                allowed_origins: dto.allowedOrigins,
                allowed_web_origins: dto.allowedWebOrigins,
                access_token_ttl: dto.accessTokenTtl,
                refresh_token_ttl: dto.refreshTokenTtl,
                is_active: true,
            },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                client_id: true,
                client_secret: true,
                access_token_ttl: true,
                refresh_token_ttl: true,
                allowed_callback_urls: true,
                allowed_logout_urls: true,
                allowed_origins: true,
                allowed_web_origins: true,
                is_active: true,
                created_at: true,
            },
        }));
        // 2. Buat user admin jika belum ada
        if (isNewUser && passwordHash) {
            await tx.users.create({
                data: {
                    id: adminUserId,
                    email: dto.adminEmail,
                    display_name: adminDisplayName,
                    is_active: true,
                    locale: 'id',
                },
            });
            await tx.passwords.create({
                data: {
                    id: (0, uuid_1.v4)(),
                    user_id: adminUserId,
                    password_hash: passwordHash,
                },
            });
            await tx.user_profiles.create({
                data: {
                    id: (0, uuid_1.v4)(),
                    user_id: adminUserId,
                },
            });
        }
        // 3. Buat atau ambil role 'owner' (system role untuk app ini)
        const ownerRole = await tx.roles.upsert({
            where: {
                uq_roles_app_slug: {
                    app_id: appId,
                    slug: 'owner',
                },
            },
            create: {
                id: (0, uuid_1.v4)(),
                app_id: appId,
                name: 'Owner',
                slug: 'owner',
                description: 'Pemilik aplikasi dengan akses penuh.',
                is_system: true,
            },
            update: {},
            select: { id: true },
        });
        // 4. Buat role-role yang diminta dari payload
        createdRoles = (await Promise.all(dto.roles.map((role) => tx.roles.create({
            data: {
                id: (0, uuid_1.v4)(),
                app_id: appId,
                name: role.name,
                slug: role.slug,
                description: role.description ?? null,
                is_system: false,
            },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
            },
        }))));
        // 5. Tambahkan admin sebagai member app (cek apakah sudah ada dulu)
        const existingMembership = await tx.user_app_memberships.findUnique({
            where: {
                uq_membership_user_app: {
                    user_id: adminUserId,
                    app_id: appId,
                },
            },
            select: { id: true },
        });
        if (!existingMembership) {
            await tx.user_app_memberships.create({
                data: {
                    id: (0, uuid_1.v4)(),
                    user_id: adminUserId,
                    app_id: appId,
                    status: 'active',
                    joined_at: new Date(),
                },
            });
        }
        // 6. Assign role 'owner' ke admin untuk app ini
        await tx.user_roles.upsert({
            where: {
                uq_user_roles: {
                    user_id: adminUserId,
                    role_id: ownerRole.id,
                    app_id: appId,
                },
            },
            create: {
                id: (0, uuid_1.v4)(),
                user_id: adminUserId,
                role_id: ownerRole.id,
                app_id: appId,
            },
            update: {},
        });
    });
    auditLog({
        action: constants_1.AUDIT_ACTIONS.APP_REGISTERED,
        userId: adminUserId,
        appId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        resourceType: 'app',
        resourceId: appId,
        metadata: {
            slug: dto.slug,
            adminEmail: dto.adminEmail,
            rolesCount: dto.roles.length,
            isNewAdmin: isNewUser,
        },
    });
    log.info({ appId, clientId, adminUserId, slug: dto.slug }, 'App registered successfully');
    return {
        app: {
            id: createdApp.id,
            name: createdApp.name,
            slug: createdApp.slug,
            description: createdApp.description,
            clientId: createdApp.client_id,
            clientSecret: createdApp.client_secret, // hanya dikembalikan sekali
            accessTokenTtl: createdApp.access_token_ttl,
            refreshTokenTtl: createdApp.refresh_token_ttl,
            allowedCallbackUrls: Array.isArray(createdApp.allowed_callback_urls)
                ? createdApp.allowed_callback_urls
                : [],
            allowedLogoutUrls: Array.isArray(createdApp.allowed_logout_urls)
                ? createdApp.allowed_logout_urls
                : [],
            allowedOrigins: Array.isArray(createdApp.allowed_origins)
                ? createdApp.allowed_origins
                : [],
            allowedWebOrigins: Array.isArray(createdApp.allowed_web_origins)
                ? createdApp.allowed_web_origins
                : [],
            isActive: createdApp.is_active,
            createdAt: createdApp.created_at,
        },
        admin: {
            id: adminUserId,
            email: dto.adminEmail,
            displayName: adminDisplayName,
            isNewUser,
        },
        roles: createdRoles,
        message: 'Aplikasi berhasil didaftarkan. Simpan clientSecret Anda dengan aman, karena tidak akan ditampilkan kembali.',
    };
}
//# sourceMappingURL=apps.service.js.map