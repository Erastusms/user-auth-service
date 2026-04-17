/**
 * Vitest Global Test Setup
 * Set semua env vars SEBELUM import apapun — termasuk sebelum dotenv jalan.
 * Ini mencegah konflik dengan file .env yang mungkin ada.
 */

import { vi, beforeAll, afterAll } from 'vitest';

// ── Override semua env vars SEBELUM module apapun di-import ──
// Harus di top-level sebelum import lain
Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3001',
  HOST: '0.0.0.0',
  API_VERSION: 'v1',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/user_multi_app_test',
  DATABASE_POOL_MIN: '2',
  DATABASE_POOL_MAX: '10',
  JWT_ALGORITHM: 'HS256',
  JWT_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ENCRYPTION_KEY: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3001',
  RATE_LIMIT_MAX: '1000',
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_AUTH_MAX: '100',
  RATE_LIMIT_AUTH_WINDOW_MS: '60000',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_SECURE: 'false',
  SMTP_USER: '',
  SMTP_PASS: '',
  EMAIL_FROM: 'test@example.com',
  EMAIL_FROM_NAME: 'Test',
  APP_BASE_URL: 'http://localhost:3001',
  FRONTEND_URL: 'http://localhost:5173',
  EMAIL_VERIFICATION_TTL_MINUTES: '1440',
  PASSWORD_RESET_TTL_MINUTES: '60',
  MAGIC_LINK_TTL_MINUTES: '15',
  MFA_TOTP_ISSUER: 'TestApp',
  MFA_BACKUP_CODES_COUNT: '10',
  LOG_LEVEL: 'error',
  LOG_FORMAT: 'json',
  GOOGLE_CLIENT_ID: 'test_google_client_id',
  GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
  GOOGLE_CLIENT_SECRET: '',
  GOOGLE_REDIRECT_URI: 'http://localhost:3001/v1/auth/oauth/google/callback',
  GITHUB_CLIENT_ID: 'test_github_client_id',
  GITHUB_CLIENT_SECRET: 'test_github_client_secret',
  GITHUB_CLIENT_SECRET: '',
  GITHUB_REDIRECT_URI: 'http://localhost:3001/v1/auth/oauth/github/callback',
  MICROSOFT_CLIENT_ID: '',
  MICROSOFT_CLIENT_SECRET: '',
  MICROSOFT_REDIRECT_URI: 'http://localhost:3001/v1/auth/oauth/microsoft/callback',
});

// ── Mock Prisma (unit tests tidak butuh DB nyata) ─────────────
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    users: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
    user_profiles: {
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    passwords: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    identities: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    sessions: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    refresh_tokens: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    verification_tokens: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user_roles: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    mfa_configs: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    mfa_backup_codes: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    audit_logs: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    apps: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    roles: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
    },
    user_app_memberships: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
    oauth_states: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    identities: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    permissions: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  return { default: mockPrisma, prisma: mockPrisma };
});

beforeAll(() => {
  // Global setup selesai
});

afterAll(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
