"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
require("module-alias/register");
const fastify_1 = __importDefault(require("fastify"));
const sensible_1 = __importDefault(require("@fastify/sensible"));
const env_1 = require("./config/env");
const logger_1 = __importDefault(require("./lib/logger"));
// Plugins
const security_1 = require("./plugins/security");
const errorHandler_1 = require("./plugins/errorHandler");
const request_1 = require("./plugins/request");
// Routes
const health_routes_1 = require("./modules/health/health.routes");
const auth_routes_1 = require("./modules/auth/auth.routes");
const oauth_routes_1 = require("./modules/oauth/oauth.routes");
const email_routes_1 = require("./modules/email/email.routes");
// ── App Factory ───────────────────────────────────────────────
// Menggunakan factory pattern agar mudah di-test (buat instance baru per test).
async function buildApp() {
    const app = (0, fastify_1.default)({
        // Request ID otomatis di-generate oleh Fastify
        genReqId: () => {
            const { v4: uuidv4 } = require('uuid');
            return uuidv4();
        },
        // Logger terintegrasi Pino
        logger: {
            level: env_1.env.LOG_LEVEL,
            ...(env_1.isDev || env_1.env.LOG_FORMAT === 'pretty'
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
        trustProxy: env_1.env.NODE_ENV === 'production' ? 1 : false,
        // Ignore trailing slash: /users/ == /users
        ignoreTrailingSlash: true,
        // Case insensitive routes
        caseSensitive: false,
        // Custom 400 handler saat Fastify gagal parse body
        bodyLimit: 1_048_576, // 1MB max body
    });
    // ── Register Plugins (urutan penting!) ────────────────────────
    // 1. Sensible — adds useful utilities dan sensible defaults
    await app.register(sensible_1.default);
    // 2. Security headers (Helmet) — harus sebelum routes
    await app.register(security_1.helmetPlugin);
    // 3. CORS — harus sebelum routes
    await app.register(security_1.corsPlugin);
    // 4. Rate Limiter — global
    if (env_1.env.NODE_ENV === 'production') {
        await app.register(security_1.rateLimitPlugin);
    }
    // 5. Request ID + HTTP logging hooks
    await app.register(request_1.requestPlugin);
    // 6. Error handler — mendaftarkan setErrorHandler dan setNotFoundHandler
    await app.register(errorHandler_1.errorHandlerPlugin);
    // ── Register Routes ───────────────────────────────────────────
    // Health check routes (no prefix)
    await app.register(health_routes_1.healthRoutes);
    // API v1 routes (dengan prefix /v1)
    await app.register(async (v1App) => {
        // Health check juga di /v1/health
        await v1App.register(health_routes_1.healthRoutes);
        // Auth routes — Phase 2
        await v1App.register(auth_routes_1.authRoutes, { prefix: '/auth' });
        // OAuth routes — Phase 3
        await v1App.register(oauth_routes_1.oauthRoutes, { prefix: '/auth/oauth' });
        // Email & Password routes — Phase 4
        await v1App.register(email_routes_1.emailRoutes, { prefix: '/auth' });
        // User routes — akan ditambahkan di Phase 7
        // await v1App.register(userRoutes, { prefix: '/users' });
        // App management routes — akan ditambahkan di Phase 8
        // await v1App.register(appRoutes, { prefix: '/apps' });
        // Role routes — akan ditambahkan di Phase 8
        // await v1App.register(roleRoutes, { prefix: '/roles' });
        // Permission routes — akan ditambahkan di Phase 8
        // await v1App.register(permissionRoutes, { prefix: '/permissions' });
    }, { prefix: `/${env_1.env.API_VERSION}` });
    // ── Ready Log ─────────────────────────────────────────────────
    app.addHook('onReady', () => {
        logger_1.default.info({
            env: env_1.env.NODE_ENV,
            version: env_1.env.API_VERSION,
            port: env_1.env.PORT,
            rateLimitMax: env_1.env.RATE_LIMIT_MAX,
        }, 'App ready');
        console.log(app.printRoutes());
    });
    return app;
}
//# sourceMappingURL=app.js.map