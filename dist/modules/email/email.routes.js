"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailRoutes = emailRoutes;
const validate_1 = require("../../middlewares/validate");
const authenticate_1 = require("../../middlewares/authenticate");
const email_schema_1 = require("./email.schema");
const email_controller_1 = require("./email.controller");
function ipKey(prefix) {
    return (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip);
        return `${prefix}:${ip}`;
    };
}
async function emailRoutes(app) {
    // ── POST /auth/email/send-verification ─────────────────────
    // Rate limit ketat: 3 per 10 menit per IP (cegah email spam)
    app.post('/email/send-verification', {
        config: {
            rateLimit: {
                max: 3,
                timeWindow: 10 * 60 * 1000,
                keyGenerator: ipKey('send-verify'),
            },
        },
        preHandler: [(0, validate_1.validate)({ body: email_schema_1.SendVerificationSchema })],
        handler: email_controller_1.sendVerificationHandler,
    });
    // ── POST /auth/email/verify ─────────────────────────────────
    // Publik — dipanggil dari link di email
    app.post('/email/verify', {
        config: {
            rateLimit: {
                max: 10,
                timeWindow: 60 * 1000,
                keyGenerator: ipKey('verify-email'),
            },
        },
        preHandler: [(0, validate_1.validate)({ body: email_schema_1.VerifyEmailSchema })],
        handler: email_controller_1.verifyEmailHandler,
    });
    // ── POST /auth/password/forgot ──────────────────────────────
    // Rate limit ketat: 3 per 15 menit per IP
    app.post('/password/forgot', {
        config: {
            rateLimit: {
                max: 3,
                timeWindow: 15 * 60 * 1000,
                keyGenerator: ipKey('forgot-pass'),
            },
        },
        preHandler: [(0, validate_1.validate)({ body: email_schema_1.ForgotPasswordSchema })],
        handler: email_controller_1.forgotPasswordHandler,
    });
    // ── POST /auth/password/reset ───────────────────────────────
    // Publik — dipanggil dari link di email
    app.post('/password/reset', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 15 * 60 * 1000,
                keyGenerator: ipKey('reset-pass'),
            },
        },
        preHandler: [(0, validate_1.validate)({ body: email_schema_1.ResetPasswordSchema })],
        handler: email_controller_1.resetPasswordHandler,
    });
    // ── PUT /auth/password/change ───────────────────────────────
    // Protected — butuh access token
    app.put('/password/change', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 15 * 60 * 1000,
                keyGenerator: ipKey('change-pass'),
            },
        },
        preHandler: [authenticate_1.authenticate, (0, validate_1.validate)({ body: email_schema_1.ChangePasswordSchema })],
        handler: email_controller_1.changePasswordHandler,
    });
}
//# sourceMappingURL=email.routes.js.map