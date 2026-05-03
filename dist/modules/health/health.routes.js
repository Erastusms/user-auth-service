"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = healthRoutes;
const prisma_1 = __importDefault(require("../../lib/prisma"));
const logger_1 = require("../../lib/logger");
const log = (0, logger_1.createLogger)('health');
async function healthRoutes(app) {
    // GET /health — simple ping (tidak cek DB, untuk load balancer)
    app.get('/health', {
        config: {
            // Skip rate limit untuk health check
            rateLimit: { max: 1000, timeWindow: 60000 },
        },
    }, async (_request, reply) => {
        return reply
            .status(200)
            .send({ status: 'ok', timestamp: new Date().toISOString() });
    });
    // GET /health/full — cek semua services (untuk monitoring)
    app.get('/health/full', async (_request, reply) => {
        let dbStatus = 'ok';
        try {
            await prisma_1.default.$queryRaw `SELECT 1`;
        }
        catch (err) {
            log.error({ err }, 'Database health check failed');
            dbStatus = 'error';
        }
        const overallStatus = dbStatus === 'error' ? 'degraded' : 'ok';
        const body = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version ?? '1.0.0',
            services: {
                database: dbStatus,
            },
        };
        const statusCode = overallStatus === 'ok' ? 200 : 503;
        return reply.status(statusCode).send(body);
    });
}
//# sourceMappingURL=health.routes.js.map