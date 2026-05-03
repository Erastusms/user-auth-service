"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.authorize = authorize;
exports.requireRole = requireRole;
exports.requireSelfOrAdmin = requireSelfOrAdmin;
const errors_1 = require("../shared/errors");
const constants_1 = require("../config/constants");
// ── Require Auth Guard ────────────────────────────────────────
// Pastikan request sudah terautentikasi (authUser ada).
function requireAuth(request, _reply) {
    if (!request.authUser) {
        throw new errors_1.UnauthorizedError('Autentikasi diperlukan.');
    }
}
// ── Permission-Based Authorization ───────────────────────────
// Cek apakah user punya salah satu dari permission yang dibutuhkan.
// Format permission: "resource:action" atau "resource:*"
//
// Pemakaian:
//   preHandler: [authenticate, authorize('users:read')]
//   preHandler: [authenticate, authorize(['users:read', 'users:write'])]
//
function authorize(...requiredPermissions) {
    return function authorizeHook(request, _reply) {
        const user = request.authUser;
        if (!user) {
            throw new errors_1.UnauthorizedError('Autentikasi diperlukan.');
        }
        // Super admin bypass semua permission checks
        if (user.roles.includes(constants_1.SYSTEM_ROLES.SUPER_ADMIN)) {
            return;
        }
        const userPerms = user.permissions;
        const hasPermission = requiredPermissions.some((required) => {
            // Exact match
            if (userPerms.includes(required))
                return true;
            // Wildcard match: jika user punya "products:*", izinkan "products:read"
            const [resource] = required.split(':');
            if (userPerms.includes(`${resource}:*`))
                return true;
            // Global wildcard
            if (userPerms.includes('*'))
                return true;
            return false;
        });
        if (!hasPermission) {
            throw new errors_1.ForbiddenError(`Akses ditolak. Permission yang dibutuhkan: ${requiredPermissions.join(' atau ')}.`);
        }
    };
}
// ── Role-Based Authorization ──────────────────────────────────
// Cek apakah user punya salah satu dari role yang dibutuhkan.
//
// Pemakaian:
//   preHandler: [authenticate, requireRole('admin')]
//   preHandler: [authenticate, requireRole(['admin', 'owner'])]
//
function requireRole(...requiredRoles) {
    return function roleHook(request, _reply) {
        const user = request.authUser;
        if (!user) {
            throw new errors_1.UnauthorizedError('Autentikasi diperlukan.');
        }
        // Super admin bypass semua role checks
        if (user.roles.includes(constants_1.SYSTEM_ROLES.SUPER_ADMIN)) {
            return;
        }
        const hasRole = requiredRoles.some((role) => user.roles.includes(role));
        if (!hasRole) {
            throw new errors_1.ForbiddenError(`Akses ditolak. Role yang dibutuhkan: ${requiredRoles.join(' atau ')}.`);
        }
    };
}
// ── Self or Admin ─────────────────────────────────────────────
// Izinkan akses jika: user mengakses data dirinya sendiri,
// ATAU user adalah admin/super_admin.
//
// Pemakaian:
//   preHandler: [authenticate, requireSelfOrAdmin('id')]
//   // 'id' adalah nama param di URL, contoh: /users/:id
//
function requireSelfOrAdmin(paramName = 'id') {
    return function selfOrAdminHook(request, _reply) {
        const user = request.authUser;
        if (!user) {
            throw new errors_1.UnauthorizedError('Autentikasi diperlukan.');
        }
        // Admin bypass
        if (user.roles.includes(constants_1.SYSTEM_ROLES.SUPER_ADMIN) ||
            user.roles.includes(constants_1.SYSTEM_ROLES.ADMIN) ||
            user.roles.includes(constants_1.SYSTEM_ROLES.OWNER)) {
            return;
        }
        const params = request.params;
        const targetId = params[paramName];
        if (user.id !== targetId) {
            throw new errors_1.ForbiddenError('Anda hanya bisa mengakses data milik sendiri.');
        }
    };
}
//# sourceMappingURL=authorize.js.map