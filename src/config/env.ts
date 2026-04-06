import { z } from 'zod';
import { config } from 'dotenv';
import path from 'path';

// Hanya load .env di development & production.
// Saat test, setup.ts yang set semua env vars langsung.
if (process.env.NODE_ENV !== 'test') {
  config({ path: path.resolve(process.cwd(), '.env') });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_VERSION: z.string().default('v1'),

  DATABASE_URL: z.string().url('DATABASE_URL harus berupa URL yang valid'),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  JWT_ALGORITHM: z.enum(['HS256', 'RS256']).default('HS256'),
  JWT_SECRET: z.string().optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(2592000),

  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY harus tepat 64 hex chars (32 bytes)'),

  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3001'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(60000),

  SMTP_HOST: z.string().default('smtp.mailtrap.io'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('noreply@example.com'),
  EMAIL_FROM_NAME: z.string().default('Auth Service'),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:3000/v1/auth/oauth/google/callback'),

  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_REDIRECT_URI: z.string().default('http://localhost:3000/v1/auth/oauth/github/callback'),

  MICROSOFT_CLIENT_ID: z.string().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().default(''),
  MICROSOFT_REDIRECT_URI: z.string().default('http://localhost:3000/v1/auth/oauth/microsoft/callback'),

  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().positive().default(1440),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  MAGIC_LINK_TTL_MINUTES: z.coerce.number().int().positive().default(15),

  MFA_TOTP_ISSUER: z.string().default('AuthService'),
  MFA_BACKUP_CODES_COUNT: z.coerce.number().int().positive().default(10),

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  const errors = _parsed.error.issues
    .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
    .join('\n');
  console.error('❌ Environment validation gagal:\n' + errors);
  process.exit(1);
}

export const env = _parsed.data;

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const corsOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());

export type Env = z.infer<typeof envSchema>;
