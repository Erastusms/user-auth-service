"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appsRoutes = appsRoutes;
const validate_1 = require("../../middlewares/validate");
const apps_schema_1 = require("./apps.schema");
const apps_controller_1 = require("./apps.controller");
// Helper: rate-limit keyGenerator yang kompatibel dengan Fastify types
function ipKey(prefix) {
    return (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip);
        return `${prefix}:${ip}`;
    };
}
async function appsRoutes(app) {
    // ── POST /apps/register ────────────────────────────────────
    // Endpoint publik untuk mendaftarkan aplikasi baru ke sistem.
    // Tidak memerlukan autentikasi — ini adalah entry point bagi developer.
    app.post('/register', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 60 * 60 * 1000, // 1 jam
                keyGenerator: ipKey('app-register'),
            },
        },
        preHandler: [(0, validate_1.validate)({ body: apps_schema_1.RegisterAppSchema })],
        handler: apps_controller_1.registerAppHandler,
    });
}
//# sourceMappingURL=apps.routes.js.map