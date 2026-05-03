"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuthenticate = optionalAuthenticate;
const jwt_1 = require("../lib/jwt");
const prisma_1 = __importDefault(require("../lib/prisma"));
const errors_1 = require("../shared/errors");
const constants_1 = require("../config/constants");
async function authenticate(request, _reply) {
    const token = (0, jwt_1.extractBearerToken)(request.headers.authorization);
    if (!token) {
        throw new errors_1.UnauthorizedError('Access token diperlukan.');
    }
    const payload = (0, jwt_1.verifyAccessToken)(token);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const session = await prisma_1.default.sessions.findUnique({
        where: { id: payload.sessionId },
        include: {
            users: {
                select: {
                    id: true,
                    email: true,
                    username: true,
                    display_name: true,
                    is_active: true,
                    is_banned: true,
                    ban_reason: true,
                    deleted_at: true,
                },
            },
        },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!session || session.status !== constants_1.SESSION_STATUS.ACTIVE) {
        throw new errors_1.UnauthorizedError('Session tidak valid atau sudah berakhir.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (new Date() > new Date(session.expires_at)) {
        throw new errors_1.UnauthorizedError('Session sudah expired.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const user = session.users;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (user.deleted_at) {
        throw new errors_1.UnauthorizedError('Akun tidak ditemukan.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (user.is_banned) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        throw new errors_1.AccountBannedError(user.ban_reason ?? undefined);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!user.is_active) {
        throw new errors_1.AccountInactiveError();
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const userRoles = await prisma_1.default.user_roles.findMany({
        where: {
            user_id: user.id,
            OR: [{ app_id: payload.appId }, { app_id: null }],
            AND: [
                {
                    OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
                },
            ],
        },
        include: {
            roles: {
                include: {
                    role_permissions: {
                        include: {
                            permissions: { select: { slug: true } },
                        },
                    },
                },
            },
        },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const roleSlugs = userRoles
        .map((ur) => String(ur.roles.slug));
    const roles = [...new Set(roleSlugs)];
    const permSlugs = userRoles.flatMap((ur) => ur.roles.role_permissions.map((rp) => String(rp.permissions.slug)));
    const permissions = [...new Set(permSlugs)];
    // Update last_active_at — fire and forget
    void prisma_1.default.sessions
        .update({ where: { id: session.id }, data: { last_active_at: new Date() } })
        .catch(() => undefined);
    const authUser = {
        id: String(user.id),
        email: user.email != null ? String(user.email) : null,
        username: user.username != null ? String(user.username) : null,
        displayName: user.display_name != null ? String(user.display_name) : null,
        isActive: Boolean(user.is_active),
        isBanned: Boolean(user.is_banned),
        sessionId: payload.sessionId,
        appId: payload.appId,
        roles,
        permissions,
    };
    request.authUser = authUser;
}
async function optionalAuthenticate(request, reply) {
    const token = (0, jwt_1.extractBearerToken)(request.headers.authorization);
    if (!token)
        return;
    try {
        await authenticate(request, reply);
    }
    catch {
        // Token invalid/expired → lanjut tanpa authUser
    }
}
//# sourceMappingURL=authenticate.js.map