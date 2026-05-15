import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import {
  hashPassword,
  generateClientId,
  generateClientSecret,
} from '@/lib/crypto';
import { createLogger } from '@/lib/logger';
import { ConflictError } from '@/shared/errors';
import { AUDIT_ACTIONS } from '@/config/constants';
import type { RegisterAppDto } from './apps.schema';
import type {
  RegisterAppResult,
  AppCreatedRow,
  RoleCreatedRow,
} from './apps.types';

const log = createLogger('apps.service');

// ════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ════════════════════════════════════════════════════════════════

/** Tulis audit log (fire-and-forget). */
function auditLog(data: {
  action: string;
  userId?: string;
  appId?: string;
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
    .catch((e: unknown) => log.error({ err: e }, 'Failed to write audit log'));
}

// ════════════════════════════════════════════════════════════════
// PUBLIC SERVICE METHODS
// ════════════════════════════════════════════════════════════════

// ── Register App ──────────────────────────────────────────────
export async function registerApp(
  dto: RegisterAppDto,
  meta: { ip: string; userAgent: string },
): Promise<RegisterAppResult> {
  // ── Cek slug sudah dipakai ─────────────────────────────────
  const existingApp = await prisma.apps.findUnique({
    where: { slug: dto.slug },
    select: { id: true, deleted_at: true },
  });

  if (existingApp && !existingApp.deleted_at) {
    throw new ConflictError(
      `Slug '${dto.slug}' sudah digunakan oleh aplikasi lain.`,
    );
  }

  // ── Cek apakah email admin sudah terdaftar ────────────────
  const existingUser = (await prisma.users.findUnique({
    where: { email: dto.adminEmail },
    select: {
      id: true,
      email: true,
      display_name: true,
      is_active: true,
      is_banned: true,
      deleted_at: true,
    },
  })) as {
    id: string;
    email: string;
    display_name: string | null;
    is_active: boolean;
    is_banned: boolean;
    deleted_at: Date | null;
  } | null;

  // Jika user sudah ada tapi di-ban atau dihapus → tolak
  if (existingUser) {
    if (existingUser.deleted_at) {
      throw new ConflictError(
        'Akun dengan email tersebut sudah dihapus. Gunakan email lain.',
      );
    }
    if (existingUser.is_banned) {
      throw new ConflictError(
        'Akun dengan email tersebut tidak dapat digunakan.',
      );
    }
  }

  // ── Persiapan data ────────────────────────────────────────
  const appId = uuidv4();
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();
  const adminDisplayName =
    dto.adminDisplayName ??
    existingUser?.display_name ??
    dto.adminEmail.split('@')[0];

  let adminUserId: string;
  let isNewUser: boolean;

  if (existingUser) {
    adminUserId = existingUser.id;
    isNewUser = false;
  } else {
    adminUserId = uuidv4();
    isNewUser = true;
  }

  // Hash password hanya jika user baru
  const passwordHash = isNewUser ? await hashPassword(dto.adminPassword) : null;

  // ── Validasi slug role tidak duplikat antar input ─────────
  const roleSlugsInput = dto.roles.map((r) => r.slug);
  const uniqueRoleSlugs = new Set(roleSlugsInput);
  if (uniqueRoleSlugs.size !== roleSlugsInput.length) {
    throw new ConflictError('Terdapat duplikat slug role pada input.');
  }

  // ── Prisma Transaction ─────────────────────────────────────
  let createdApp: AppCreatedRow;
  let createdRoles: RoleCreatedRow[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
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
    })) as AppCreatedRow;

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
          id: uuidv4(),
          user_id: adminUserId,
          password_hash: passwordHash,
        },
      });

      await tx.user_profiles.create({
        data: {
          id: uuidv4(),
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
        id: uuidv4(),
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
    createdRoles = (await Promise.all(
      dto.roles.map((role) =>
        tx.roles.create({
          data: {
            id: uuidv4(),
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
        }),
      ),
    )) as RoleCreatedRow[];

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
          id: uuidv4(),
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
        id: uuidv4(),
        user_id: adminUserId,
        role_id: ownerRole.id,
        app_id: appId,
      },
      update: {},
    });
  });

  auditLog({
    action: AUDIT_ACTIONS.APP_REGISTERED,
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

  log.info(
    { appId, clientId, adminUserId, slug: dto.slug },
    'App registered successfully',
  );

  return {
    app: {
      id: createdApp!.id,
      name: createdApp!.name,
      slug: createdApp!.slug,
      description: createdApp!.description,
      clientId: createdApp!.client_id,
      clientSecret: createdApp!.client_secret, // hanya dikembalikan sekali
      accessTokenTtl: createdApp!.access_token_ttl,
      refreshTokenTtl: createdApp!.refresh_token_ttl,
      allowedCallbackUrls: Array.isArray(createdApp!.allowed_callback_urls)
        ? (createdApp!.allowed_callback_urls as string[])
        : [],
      allowedLogoutUrls: Array.isArray(createdApp!.allowed_logout_urls)
        ? (createdApp!.allowed_logout_urls as string[])
        : [],
      allowedOrigins: Array.isArray(createdApp!.allowed_origins)
        ? (createdApp!.allowed_origins as string[])
        : [],
      allowedWebOrigins: Array.isArray(createdApp!.allowed_web_origins)
        ? (createdApp!.allowed_web_origins as string[])
        : [],
      isActive: createdApp!.is_active,
      createdAt: createdApp!.created_at,
    },
    admin: {
      id: adminUserId,
      email: dto.adminEmail,
      displayName: adminDisplayName,
      isNewUser,
    },
    roles: createdRoles!,
    message:
      'Aplikasi berhasil didaftarkan. Simpan clientSecret Anda dengan aman, karena tidak akan ditampilkan kembali.',
  };
}
