"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimitConfig = exports.rateLimitPlugin = exports.corsPlugin = exports.helmetPlugin = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createLogger)('security');
// ── Helmet — Security Headers ─────────────────────────────────
exports.helmetPlugin = (0, fastify_plugin_1.default)(async function helmetPlugin(app) {
    await app.register(helmet_1.default, {
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
        hsts: env_1.env.NODE_ENV === 'production'
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
});
// ── CORS ──────────────────────────────────────────────────────
exports.corsPlugin = (0, fastify_plugin_1.default)(async function corsPlugin(app) {
    await app.register(cors_1.default, {
        origin: (origin, callback) => {
            // Allow no-origin (server-to-server, Postman, curl)
            if (!origin) {
                callback(null, true);
                return;
            }
            if (env_1.corsOrigins.includes(origin) || env_1.corsOrigins.includes('*')) {
                callback(null, true);
            }
            else {
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
        credentials: true, // Izinkan cookies & Authorization header
        maxAge: 86400, // Pre-flight cache 24 jam
        preflight: true,
    });
    log.info({ origins: env_1.corsOrigins }, 'CORS registered');
});
// ── Rate Limiter ──────────────────────────────────────────────
exports.rateLimitPlugin = (0, fastify_plugin_1.default)(async function rateLimitPlugin(app) {
    await app.register(rate_limit_1.default, {
        global: true, // Terapkan ke semua routes secara default
        max: env_1.env.RATE_LIMIT_MAX,
        timeWindow: env_1.env.RATE_LIMIT_WINDOW_MS,
        // Key: per IP (bisa di-override per route)
        keyGenerator: (request) => {
            return (request.headers['x-forwarded-for'] ??
                request.headers['x-real-ip'] ??
                request.ip);
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
    log.info({
        max: env_1.env.RATE_LIMIT_MAX,
        windowMs: env_1.env.RATE_LIMIT_WINDOW_MS,
    }, 'Rate limiter registered');
});
// ── Auth Rate Limit Config (untuk dipakai per-route) ─────────
// Contoh pemakaian di route:
//   fastify.post('/login', {
//     config: { rateLimit: authRateLimitConfig },
//   }, handler)
//
exports.authRateLimitConfig = {
    max: env_1.env.RATE_LIMIT_AUTH_MAX,
    timeWindow: env_1.env.RATE_LIMIT_AUTH_WINDOW_MS,
    keyGenerator: (request) => {
        const ip = request.headers['x-forwarded-for'] ??
            request.headers['x-real-ip'] ??
            request.ip;
        return `auth:${ip}`;
    },
};
//# sourceMappingURL=security.js.map