import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, extractBearerToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import {
  UnauthorizedError,
  AccountBannedError,
  AccountInactiveError,
} from '@/shared/errors';
import { SESSION_STATUS } from '@/config/constants';
import type { AuthUser } from '@/types';

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    throw new UnauthorizedError('Access token diperlukan.');
  }

  const payload = verifyAccessToken(token);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const session = await prisma.sessions.findUnique({
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
  if (!session || session.status !== SESSION_STATUS.ACTIVE) {
    throw new UnauthorizedError('Session tidak valid atau sudah berakhir.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (new Date() > new Date(session.expires_at)) {
    throw new UnauthorizedError('Session sudah expired.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const user = session.users;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (user.deleted_at) {
    throw new UnauthorizedError('Akun tidak ditemukan.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (user.is_banned) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    throw new AccountBannedError(user.ban_reason ?? undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (!user.is_active) {
    throw new AccountInactiveError();
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const userRoles = await prisma.user_roles.findMany({
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
  const roleSlugs: string[] = (userRoles as Array<{ roles: { slug: unknown } }>)
    .map((ur) => String(ur.roles.slug));
  const roles: string[] = [...new Set(roleSlugs)];

  const permSlugs: string[] = (
    userRoles as Array<{
      roles: { role_permissions: Array<{ permissions: { slug: unknown } }> };
    }>
  ).flatMap((ur) =>
    ur.roles.role_permissions.map((rp) => String(rp.permissions.slug))
  );
  const permissions: string[] = [...new Set(permSlugs)];

  // Update last_active_at — fire and forget
  void prisma.sessions
    .update({ where: { id: session.id }, data: { last_active_at: new Date() } })
    .catch(() => undefined);

  const authUser: AuthUser = {
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

export async function optionalAuthenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) return;

  try {
    await authenticate(request, reply);
  } catch {
    // Token invalid/expired → lanjut tanpa authUser
  }
}
