import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '@/shared/errors';
import { SYSTEM_ROLES } from '@/config/constants';

// ── Require Auth Guard ────────────────────────────────────────
// Pastikan request sudah terautentikasi (authUser ada).
export function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): void {
  if (!request.authUser) {
    throw new UnauthorizedError('Autentikasi diperlukan.');
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
export function authorize(...requiredPermissions: string[]) {
  return function authorizeHook(
    request: FastifyRequest,
    _reply: FastifyReply
  ): void {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedError('Autentikasi diperlukan.');
    }

    // Super admin bypass semua permission checks
    if (user.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      return;
    }

    const userPerms = user.permissions;

    const hasPermission = requiredPermissions.some((required) => {
      // Exact match
      if (userPerms.includes(required)) return true;

      // Wildcard match: jika user punya "products:*", izinkan "products:read"
      const [resource] = required.split(':');
      if (userPerms.includes(`${resource}:*`)) return true;

      // Global wildcard
      if (userPerms.includes('*')) return true;

      return false;
    });

    if (!hasPermission) {
      throw new ForbiddenError(
        `Akses ditolak. Permission yang dibutuhkan: ${requiredPermissions.join(' atau ')}.`
      );
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
export function requireRole(...requiredRoles: string[]) {
  return function roleHook(
    request: FastifyRequest,
    _reply: FastifyReply
  ): void {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedError('Autentikasi diperlukan.');
    }

    // Super admin bypass semua role checks
    if (user.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      return;
    }

    const hasRole = requiredRoles.some((role) =>
      user.roles.includes(role)
    );

    if (!hasRole) {
      throw new ForbiddenError(
        `Akses ditolak. Role yang dibutuhkan: ${requiredRoles.join(' atau ')}.`
      );
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
export function requireSelfOrAdmin(paramName = 'id') {
  return function selfOrAdminHook(
    request: FastifyRequest,
    _reply: FastifyReply
  ): void {
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedError('Autentikasi diperlukan.');
    }

    // Admin bypass
    if (
      user.roles.includes(SYSTEM_ROLES.SUPER_ADMIN) ||
      user.roles.includes(SYSTEM_ROLES.ADMIN) ||
      user.roles.includes(SYSTEM_ROLES.OWNER)
    ) {
      return;
    }

    const params = request.params as Record<string, string>;
    const targetId = params[paramName];

    if (user.id !== targetId) {
      throw new ForbiddenError('Anda hanya bisa mengakses data milik sendiri.');
    }
  };
}
