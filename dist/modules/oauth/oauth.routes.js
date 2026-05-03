"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthRoutes = oauthRoutes;
const validate_1 = require("../../middlewares/validate");
const authenticate_1 = require("../../middlewares/authenticate");
const oauth_schema_1 = require("./oauth.schema");
const oauth_controller_1 = require("./oauth.controller");
function ipKey(prefix) {
    return (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip);
        return `${prefix}:${ip}`;
    };
}
async function oauthRoutes(app) {
    // ── GET /auth/oauth/:provider ─────────────────────────────
    // Publik — siapa saja bisa initiate OAuth (login baru atau link)
    // optionalAuthenticate: jika user sudah login, linkage mode aktif
    app.get('/:provider', {
        config: {
            rateLimit: {
                max: 20,
                timeWindow: 60 * 1000,
                keyGenerator: ipKey('oauth-init'),
            },
        },
        preHandler: [
            (0, validate_1.validate)({ params: oauth_schema_1.ProviderParamSchema, query: oauth_schema_1.OAuthInitQuerySchema }),
            authenticate_1.optionalAuthenticate,
        ],
        handler: oauth_controller_1.initiateOAuthHandler,
    });
    // ── GET /auth/oauth/:provider/callback ────────────────────
    // Publik — dipanggil oleh provider setelah user approve
    // Rate limit longgar karena ini dari provider, bukan user langsung
    app.get('/:provider/callback', {
        config: {
            rateLimit: {
                max: 30,
                timeWindow: 60 * 1000,
                keyGenerator: ipKey('oauth-callback'),
            },
        },
        preHandler: [
            (0, validate_1.validate)({
                params: oauth_schema_1.ProviderParamSchema,
                query: oauth_schema_1.OAuthCallbackQuerySchema,
            }),
        ],
        handler: oauth_controller_1.oauthCallbackHandler,
    });
    // ── GET /auth/oauth/providers ─────────────────────────────
    // Protected — list provider yang terhubung
    app.get('/providers', {
        preHandler: [authenticate_1.authenticate],
        handler: oauth_controller_1.getLinkedProvidersHandler,
    });
    // ── POST /auth/oauth/link ─────────────────────────────────
    // Protected — initiate link provider baru ke akun yang sudah login
    app.post('/link', {
        config: {
            rateLimit: {
                max: 10,
                timeWindow: 60 * 1000,
                keyGenerator: ipKey('oauth-link'),
            },
        },
        preHandler: [authenticate_1.authenticate, (0, validate_1.validate)({ body: oauth_schema_1.OAuthLinkBodySchema })],
        handler: oauth_controller_1.linkOAuthHandler,
    });
    // ── DELETE /auth/oauth/link/:provider ─────────────────────
    // Protected — hapus linked provider
    app.delete('/link/:provider', {
        preHandler: [authenticate_1.authenticate, (0, validate_1.validate)({ params: oauth_schema_1.OAuthUnlinkParamSchema })],
        handler: oauth_controller_1.unlinkOAuthHandler,
    });
}
//# sourceMappingURL=oauth.routes.js.map