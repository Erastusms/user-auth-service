"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOrigins = exports.isTest = exports.isProd = exports.isDev = exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
// Hanya load .env di development & production.
// Saat test, setup.ts yang set semua env vars langsung.
if (process.env.NODE_ENV !== 'test') {
    (0, dotenv_1.config)({ path: path_1.default.resolve(process.cwd(), '.env') });
}
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    HOST: zod_1.z.string().default('0.0.0.0'),
    API_VERSION: zod_1.z.string().default('v1'),
    DATABASE_URL: zod_1.z.string().url('DATABASE_URL harus berupa URL yang valid'),
    DATABASE_POOL_MIN: zod_1.z.coerce.number().int().nonnegative().default(2),
    DATABASE_POOL_MAX: zod_1.z.coerce.number().int().positive().default(10),
    JWT_ALGORITHM: zod_1.z.enum(['HS256', 'RS256']).default('HS256'),
    JWT_SECRET: zod_1.z.string().optional(),
    JWT_PRIVATE_KEY: zod_1.z.string().optional(),
    JWT_PUBLIC_KEY: zod_1.z.string().optional(),
    JWT_ACCESS_TOKEN_TTL: zod_1.z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TOKEN_TTL: zod_1.z.coerce.number().int().positive().default(2592000),
    ENCRYPTION_KEY: zod_1.z
        .string()
        .length(64, 'ENCRYPTION_KEY harus tepat 64 hex chars (32 bytes)'),
    CORS_ALLOWED_ORIGINS: zod_1.z.string().default('http://localhost:3001'),
    RATE_LIMIT_MAX: zod_1.z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_AUTH_MAX: zod_1.z.coerce.number().int().positive().default(10),
    RATE_LIMIT_AUTH_WINDOW_MS: zod_1.z.coerce.number().int().positive().default(60000),
    SMTP_HOST: zod_1.z.string().default('smtp.mailtrap.io'),
    SMTP_PORT: zod_1.z.coerce.number().int().positive().default(587),
    SMTP_SECURE: zod_1.z
        .preprocess((v) => v === 'true' || v === true, zod_1.z.boolean())
        .default(false),
    SMTP_USER: zod_1.z.string().default(''),
    SMTP_PASS: zod_1.z.string().default(''),
    EMAIL_FROM: zod_1.z.string().default('noreply@example.com'),
    EMAIL_FROM_NAME: zod_1.z.string().default('Auth Service'),
    GOOGLE_CLIENT_ID: zod_1.z.string().default(''),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().default(''),
    GOOGLE_REDIRECT_URI: zod_1.z
        .string()
        .default('http://localhost:3000/v1/auth/oauth/google/callback'),
    GITHUB_CLIENT_ID: zod_1.z.string().default(''),
    GITHUB_CLIENT_SECRET: zod_1.z.string().default(''),
    GITHUB_REDIRECT_URI: zod_1.z
        .string()
        .default('http://localhost:3000/v1/auth/oauth/github/callback'),
    MICROSOFT_CLIENT_ID: zod_1.z.string().default(''),
    MICROSOFT_CLIENT_SECRET: zod_1.z.string().default(''),
    MICROSOFT_REDIRECT_URI: zod_1.z
        .string()
        .default('http://localhost:3000/v1/auth/oauth/microsoft/callback'),
    APP_BASE_URL: zod_1.z.string().url().default('http://localhost:3000'),
    FRONTEND_URL: zod_1.z.string().url().default('http://localhost:5173'),
    EMAIL_VERIFICATION_TTL_MINUTES: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .default(1440),
    PASSWORD_RESET_TTL_MINUTES: zod_1.z.coerce.number().int().positive().default(60),
    MAGIC_LINK_TTL_MINUTES: zod_1.z.coerce.number().int().positive().default(15),
    MFA_TOTP_ISSUER: zod_1.z.string().default('AuthService'),
    MFA_BACKUP_CODES_COUNT: zod_1.z.coerce.number().int().positive().default(10),
    LOG_LEVEL: zod_1.z
        .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
        .default('info'),
    LOG_FORMAT: zod_1.z.enum(['json', 'pretty']).default('json'),
});
const _parsed = envSchema.safeParse(process.env);
if (!_parsed.success) {
    const errors = _parsed.error.issues
        .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
        .join('\n');
    console.error('❌ Environment validation gagal:\n' + errors);
    process.exit(1);
}
exports.env = _parsed.data;
exports.isDev = exports.env.NODE_ENV === 'development';
exports.isProd = exports.env.NODE_ENV === 'production';
exports.isTest = exports.env.NODE_ENV === 'test';
exports.corsOrigins = exports.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
//# sourceMappingURL=env.js.map