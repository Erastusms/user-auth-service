// Prisma client — menggunakan dynamic require agar tidak error
// saat @prisma/client belum di-generate (sebelum prisma generate dijalankan).
// Setelah `npm run db:generate`, PrismaClient tersedia normal.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PrismaClientClass: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PrismaClientClass = require('@prisma/client').PrismaClient;
} catch {
  // Prisma belum di-generate — buat dummy untuk TS compile
  PrismaClientClass = class MockPrismaClient {
    async $connect() { return; }
    async $disconnect() { return; }
    async $queryRaw() { return []; }
  };
}

import { isDev } from '@/config/env';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: InstanceType<typeof PrismaClientClass> | undefined;
}

function createPrismaClient() {
  return new PrismaClientClass({
    log: isDev
      ? [
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
      : [
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ],
  });
}

const prisma: InstanceType<typeof PrismaClientClass> =
  global.__prisma ?? createPrismaClient();

if (isDev) {
  global.__prisma = prisma;
}

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
export { prisma };
