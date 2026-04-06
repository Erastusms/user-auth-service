import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env, corsOrigins } from '@/config/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('security');

// ── Helmet — Security Headers ─────────────────────────────────
export async function helmetPlugin(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Disable X-Powered-By
    hidePoweredBy: true,
    // Prevent MIME sniffing
    noSniff: true,
    // XSS Protection
    xssFilter: true,
    // HSTS (hanya aktif di production)
    hsts:
      env.NODE_ENV === 'production'
        ? {
            maxAge: 31536000, // 1 tahun
            includeSubDomains: true,
            preload: true,
          }
        : false,
    // Referrer Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Permissions Policy
    permittedCrossDomainPolicies: false,
    crossOriginEmbedderPolicy: false, // Disable agar tidak block assets
  });

  log.info('Helmet security headers registered');
}

// ── CORS ──────────────────────────────────────────────────────
export async function corsPlugin(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: (origin, callback) => {
      // Allow no-origin (server-to-server, Postman, curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        callback(null, true);
      } else {
        log.warn({ origin }, 'CORS rejected origin');
        callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS policy.`), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-App-Client-Id',
      'X-Request-Id',
      'X-Forwarded-For',
    ],
    exposedHeaders: ['X-Request-Id', 'X-Rate-Limit-Remaining'],
    credentials: true,   // Izinkan cookies & Authorization header
    maxAge: 86400,       // Pre-flight cache 24 jam
    preflight: true,
  });

  log.info({ origins: corsOrigins }, 'CORS registered');
}

// ── Rate Limiter ──────────────────────────────────────────────
export async function rateLimitPlugin(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: true, // Terapkan ke semua routes secara default
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    // Key: per IP (bisa di-override per route)
    keyGenerator: (request) => {
      return (
        request.headers['x-forwarded-for'] as string ??
        request.headers['x-real-ip'] as string ??
        request.ip
      );
    },
    // Response saat rate limit tercapai
    errorResponseBuilder: (_request, context) => {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Terlalu banyak request. Coba lagi dalam ${Math.ceil(context.ttl / 1000)} detik.`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil(context.ttl / 1000),
        },
      };
    },
    // Header yang dikirim ke client
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    // Skip rate limit untuk health check
    skipOnError: false,
    allowList: [],
  });

  log.info(
    {
      max: env.RATE_LIMIT_MAX,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    },
    'Rate limiter registered'
  );
}

// ── Auth Rate Limit Config (untuk dipakai per-route) ─────────
// Contoh pemakaian di route:
//   fastify.post('/login', {
//     config: { rateLimit: authRateLimitConfig },
//   }, handler)
//
export const authRateLimitConfig = {
  max: env.RATE_LIMIT_AUTH_MAX,
  timeWindow: env.RATE_LIMIT_AUTH_WINDOW_MS,
  keyGenerator: (request: { headers: Record<string, string | undefined>; ip: string }) => {
    const ip =
      request.headers['x-forwarded-for'] ??
      request.headers['x-real-ip'] ??
      request.ip;
    return `auth:${ip}`;
  },
};
