/**
 * Prisma Seed Script
 * Jalankan dengan: npm run db:seed
 *
 * Seed ini membuat:
 * - 1 default app
 * - System roles global (super_admin, system)
 * - Default roles untuk default app (owner, admin, member, viewer)
 * - Default permissions
 * - 1 super admin user (hanya untuk development)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── 1. Default App ──────────────────────────────────────────
  const defaultApp = await prisma.apps.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      id: uuidv4(),
      name: 'Default App',
      slug: 'default',
      description: 'Default application for development and testing',
      allowed_callback_urls: ['http://localhost:3001/auth/callback'],
      allowed_origins: ['http://localhost:3001', 'http://localhost:5173'],
      access_token_ttl: 900,
      refresh_token_ttl: 2592000,
    },
  });
  console.log(
    `✅ App: ${defaultApp.name} (client_id: ${defaultApp.client_id})`,
  );

  // ── 2. Global System Roles (app_id = null) ──────────────────
  // const superAdminRole = await prisma.roles.upsert({
  //   where: {
  //     uq_roles_app_slug: {
  //       app_id: null as unknown as string,
  //       slug: 'super_admin',
  //     },
  //   },
  //   update: {},
  //   create: {
  //     id: uuidv4(),
  //     app_id: null,
  //     name: 'Super Admin',
  //     slug: 'super_admin',
  //     description: 'Full access to everything across all apps',
  //     is_system: true,
  //   },
  // });
  const existing = await prisma.roles.findFirst({
    where: {
      app_id: null,
      slug: 'super_admin',
    },
  });

  const superAdminRole = existing
    ? existing
    : await prisma.roles.create({
        data: {
          id: uuidv4(),
          app_id: null,
          name: 'Super Admin',
          slug: 'super_admin',
          description: 'Full access to everything across all apps',
          is_system: true,
        },
      });

  // const systemRole = await prisma.roles.upsert({
  //   where: {
  //     uq_roles_app_slug: { app_id: null as unknown as string, slug: 'system' },
  //   },
  //   update: {},
  //   create: {
  //     id: uuidv4(),
  //     app_id: null,
  //     name: 'System',
  //     slug: 'system',
  //     description: 'Internal system role for automated processes',
  //     is_system: true,
  //   },
  // });

  const existingSystemRole = await prisma.roles.findFirst({
    where: {
      app_id: null,
      slug: 'system',
    },
  });

  const systemRole = existingSystemRole
    ? existingSystemRole
    : await prisma.roles.create({
        data: {
          id: uuidv4(),
          app_id: null,
          name: 'System',
          slug: 'system',
          description: 'Internal system role for automated processes',
          is_system: true,
        },
      });

  console.log(
    `✅ Global roles created: ${superAdminRole.slug}, ${systemRole.slug}`,
  );

  // ── 3. App-Specific Default Roles ───────────────────────────
  const appRoles = [
    {
      slug: 'owner',
      name: 'Owner',
      description: 'Full control of the app',
      is_system: true,
    },
    {
      slug: 'admin',
      name: 'Admin',
      description: 'Administrative access',
      is_system: true,
    },
    {
      slug: 'member',
      name: 'Member',
      description: 'Standard member access',
      is_system: true,
    },
    {
      slug: 'viewer',
      name: 'Viewer',
      description: 'Read-only access',
      is_system: true,
    },
  ];

  const createdRoles: Record<string, { id: string }> = {};

  for (const roleData of appRoles) {
    const role = await prisma.roles.upsert({
      where: {
        uq_roles_app_slug: { app_id: defaultApp.id, slug: roleData.slug },
      },
      update: {},
      create: {
        id: uuidv4(),
        app_id: defaultApp.id,
        ...roleData,
      },
    });
    createdRoles[roleData.slug] = { id: role.id };
    console.log(`✅ Role created: ${role.slug} (app: ${defaultApp.slug})`);
  }

  // ── 4. Default Permissions ───────────────────────────────────
  const permissionGroups = [
    // Users
    {
      slug: 'users:read',
      name: 'Baca User',
      group: 'Users',
      desc: 'Lihat daftar dan detail user',
    },
    {
      slug: 'users:write',
      name: 'Edit User',
      group: 'Users',
      desc: 'Buat dan update data user',
    },
    {
      slug: 'users:delete',
      name: 'Hapus User',
      group: 'Users',
      desc: 'Hapus user dari sistem',
    },
    {
      slug: 'users:ban',
      name: 'Ban User',
      group: 'Users',
      desc: 'Ban dan unban user',
    },
    // Roles
    {
      slug: 'roles:read',
      name: 'Baca Role',
      group: 'Roles',
      desc: 'Lihat daftar roles',
    },
    {
      slug: 'roles:write',
      name: 'Kelola Role',
      group: 'Roles',
      desc: 'Buat, edit, dan assign roles',
    },
    // Apps
    {
      slug: 'apps:read',
      name: 'Baca App',
      group: 'Apps',
      desc: 'Lihat konfigurasi aplikasi',
    },
    {
      slug: 'apps:write',
      name: 'Kelola App',
      group: 'Apps',
      desc: 'Buat dan edit aplikasi',
    },
    // Audit
    {
      slug: 'audit:read',
      name: 'Baca Audit',
      group: 'Audit',
      desc: 'Lihat audit logs',
    },
  ];

  const createdPermissions: Record<string, { id: string }> = {};

  for (const permData of permissionGroups) {
    const perm = await prisma.permissions.upsert({
      where: {
        uq_permissions_app_slug: { app_id: defaultApp.id, slug: permData.slug },
      },
      update: {},
      create: {
        id: uuidv4(),
        app_id: defaultApp.id,
        name: permData.name,
        slug: permData.slug,
        description: permData.desc,
        group_name: permData.group,
      },
    });
    createdPermissions[permData.slug] = { id: perm.id };
  }
  console.log(`✅ ${permissionGroups.length} permissions created`);

  // ── 5. Assign Permissions ke Roles ──────────────────────────
  const rolePermissionMap: Record<string, string[]> = {
    owner: Object.keys(createdPermissions), // Semua permission
    admin: [
      'users:read',
      'users:write',
      'users:ban',
      'roles:read',
      'roles:write',
      'apps:read',
      'audit:read',
    ],
    member: ['users:read'],
    viewer: ['users:read'],
  };

  for (const [roleSlug, permSlugs] of Object.entries(rolePermissionMap)) {
    const roleId = createdRoles[roleSlug]?.id;
    if (!roleId) continue;

    for (const permSlug of permSlugs) {
      const permId = createdPermissions[permSlug]?.id;
      if (!permId) continue;

      await prisma.role_permissions.upsert({
        where: {
          role_id_permission_id: { role_id: roleId, permission_id: permId },
        },
        update: {},
        create: { role_id: roleId, permission_id: permId },
      });
    }
    console.log(`✅ Permissions assigned to role: ${roleSlug}`);
  }

  // ── 6. Super Admin User (DEV ONLY) ──────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const ADMIN_EMAIL = 'admin@example.com';
    const ADMIN_PASSWORD = 'Admin123!'; // GANTI DI PRODUCTION!

    const existingUser = await prisma.users.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (!existingUser) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      const userId = uuidv4();

      const adminUser = await prisma.users.create({
        data: {
          id: userId,
          email: ADMIN_EMAIL,
          username: 'superadmin',
          display_name: 'Super Admin',
          is_active: true,
          email_verified_at: new Date(),
          locale: 'id',
          timezone: 'Asia/Jakarta',
          // Create password
          passwords: {
            create: {
              id: uuidv4(),
              password_hash: passwordHash,
            },
          },
          // Create profile
          user_profiles: {
            create: {
              id: uuidv4(),
              first_name: 'Super',
              last_name: 'Admin',
            },
          },
          // App membership
          user_app_memberships: {
            create: {
              id: uuidv4(),
              app_id: defaultApp.id,
              status: 'active',
              joined_at: new Date(),
            },
          },
        },
      });

      // Assign global super_admin role
      await prisma.user_roles.create({
        data: {
          id: uuidv4(),
          user_id: adminUser.id,
          role_id: superAdminRole.id,
          app_id: null,
        },
      });

      console.log(
        `✅ Super admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`,
      );
      console.log(`   ⚠️  GANTI PASSWORD INI SEBELUM DEPLOY KE PRODUCTION!`);
    } else {
      console.log(`ℹ️  Super admin user sudah ada: ${ADMIN_EMAIL}`);
    }
  }

  console.log('\n✅ Seed completed successfully!');
  console.log(`\n📋 Summary:`);
  console.log(`   App client_id: ${defaultApp.client_id}`);
  console.log(`   App client_secret: ${defaultApp.client_secret}`);
  console.log(`   ⚠️  Simpan client_secret di atas untuk testing!`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
