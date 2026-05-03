"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const validate_1 = require("../../middlewares/validate");
const authenticate_1 = require("../../middlewares/authenticate");
const security_1 = require("../../plugins/security");
const auth_schema_1 = require("./auth.schema");
const auth_controller_1 = require("./auth.controller");
// Helper: rate-limit keyGenerator yang kompatibel dengan Fastify types
function ipKey(prefix) {
    return (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip);
        return `${prefix}:${ip}`;
    };
}
async function authRoutes(app) {
    // ── POST /auth/register ───────────────────────────────────
    app.post('/register', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 15 * 60 * 1000,
                keyGenerator: ipKey('register'),
            },
        },
        preHandler: [(0, validate_1.validate)({ body: auth_schema_1.RegisterSchema })],
        handler: auth_controller_1.registerHandler,
    });
    // ── POST /auth/login ──────────────────────────────────────
    app.post('/login', {
        config: {
            rateLimit: {
                ...security_1.authRateLimitConfig,
                keyGenerator: ipKey('login'),
            },
        },
        preHandler: [(0, validate_1.validate)({ body: auth_schema_1.LoginSchema })],
        handler: auth_controller_1.loginHandler,
    });
    // ── POST /auth/logout ─────────────────────────────────────
    app.post('/logout', {
        preHandler: [authenticate_1.authenticate, (0, validate_1.validate)({ body: auth_schema_1.LogoutSchema })],
        handler: auth_controller_1.logoutHandler,
    });
    // ── POST /auth/refresh ────────────────────────────────────
    app.post('/refresh', {
        config: {
            rateLimit: {
                max: 30,
                timeWindow: 60 * 1000,
                keyGenerator: ipKey('refresh'),
            },
        },
        preHandler: [(0, validate_1.validate)({ body: auth_schema_1.RefreshSchema })],
        handler: auth_controller_1.refreshHandler,
    });
    // ── POST /auth/revoke-all ─────────────────────────────────
    app.post('/revoke-all', {
        preHandler: [authenticate_1.authenticate, (0, validate_1.validate)({ body: auth_schema_1.RevokeAllSchema })],
        handler: auth_controller_1.revokeAllHandler,
    });
}
//# sourceMappingURL=auth.routes.js.map