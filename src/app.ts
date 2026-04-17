import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { env, isDev } from '@/config/env';
import logger from '@/lib/logger';

// Plugins
import { helmetPlugin, corsPlugin, rateLimitPlugin } from '@/plugins/security';
import { errorHandlerPlugin } from '@/plugins/errorHandler';
import { requestPlugin } from '@/plugins/request';

// Routes
import { healthRoutes } from '@/modules/health/health.routes';
import { authRoutes } from '@/modules/auth/auth.routes';

// ── App Factory ───────────────────────────────────────────────
// Menggunakan factory pattern agar mudah di-test (buat instance baru per test).
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    // Request ID otomatis di-generate oleh Fastify
    genReqId: () => {
      const { v4: uuidv4 } = require('uuid');
      return uuidv4();
    },

    // Logger terintegrasi Pino
    logger: {
      level: env.LOG_LEVEL,
      ...(isDev || env.LOG_FORMAT === 'pretty'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
    },

    // Trust proxy headers (X-Forwarded-For) untuk IP rate limiting yang benar
    // Set ke jumlah proxy di depan app (1 untuk satu nginx/load balancer)
    trustProxy: env.NODE_ENV === 'production' ? 1 : false,

    // Ignore trailing slash: /users/ == /users
    ignoreTrailingSlash: true,

    // Case insensitive routes
    caseSensitive: false,

    // Custom 400 handler saat Fastify gagal parse body
    bodyLimit: 1_048_576, // 1MB max body
  });

  // ── Register Plugins (urutan penting!) ────────────────────────

  // 1. Sensible — adds useful utilities dan sensible defaults
  await app.register(sensible);

  // 2. Security headers (Helmet) — harus sebelum routes
  await app.register(helmetPlugin);

  // 3. CORS — harus sebelum routes
  await app.register(corsPlugin);

  // 4. Rate Limiter — global
  await app.register(rateLimitPlugin);

  // 5. Request ID + HTTP logging hooks
  await app.register(requestPlugin);

  // 6. Error handler — mendaftarkan setErrorHandler dan setNotFoundHandler
  await app.register(errorHandlerPlugin);

  // ── Register Routes ───────────────────────────────────────────
  // Health check routes (no prefix)
  await app.register(healthRoutes);

  // API v1 routes (dengan prefix /v1)
  await app.register(
    async (v1App) => {
      // Health check juga di /v1/health
      await v1App.register(healthRoutes);

      // Auth routes — Phase 2
      await v1App.register(authRoutes, { prefix: '/auth' });

      // User routes — akan ditambahkan di Phase 7
      // await v1App.register(userRoutes, { prefix: '/users' });

      // App management routes — akan ditambahkan di Phase 8
      // await v1App.register(appRoutes, { prefix: '/apps' });

      // Role routes — akan ditambahkan di Phase 8
      // await v1App.register(roleRoutes, { prefix: '/roles' });

      // Permission routes — akan ditambahkan di Phase 8
      // await v1App.register(permissionRoutes, { prefix: '/permissions' });
    },
    { prefix: `/${env.API_VERSION}` }
  );

  // ── Ready Log ─────────────────────────────────────────────────
  app.addHook('onReady', () => {
    logger.info(
      {
        env: env.NODE_ENV,
        version: env.API_VERSION,
        port: env.PORT,
        rateLimitMax: env.RATE_LIMIT_MAX,
      },
      'App ready'
    );
  });

  return app;
}
