"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("module-alias/register");
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = __importDefault(require("./lib/logger"));
const prisma_1 = __importDefault(require("./lib/prisma"));
// ── Bootstrap ─────────────────────────────────────────────────
async function start() {
    let app;
    try {
        console.log('RUNNING FILE:', __filename);
        // Cek koneksi database sebelum start server
        logger_1.default.info('Checking database connection...');
        await prisma_1.default.$connect();
        logger_1.default.info('Database connected');
        // Build Fastify app
        app = await (0, app_1.buildApp)();
        // Start listening
        await app.listen({
            port: env_1.env.PORT,
            host: env_1.env.HOST,
        });
        logger_1.default.info({
            port: env_1.env.PORT,
            host: env_1.env.HOST,
            env: env_1.env.NODE_ENV,
        }, `Server running at http://${env_1.env.HOST}:${env_1.env.PORT}`);
    }
    catch (err) {
        logger_1.default.fatal({ err }, 'Failed to start server');
        process.exit(1);
    }
    // ── Graceful Shutdown ─────────────────────────────────────────
    const shutdown = async (signal) => {
        logger_1.default.info({ signal }, 'Shutdown signal received');
        try {
            if (app) {
                // Stop accepting new connections, finish existing ones
                await app.close();
                logger_1.default.info('HTTP server closed');
            }
            // Tutup koneksi database
            await prisma_1.default.$disconnect();
            logger_1.default.info('Database disconnected');
            logger_1.default.info('Graceful shutdown complete');
            process.exit(0);
        }
        catch (err) {
            logger_1.default.error({ err }, 'Error during shutdown');
            process.exit(1);
        }
    };
    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker stop
    process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Nodemon restart
    // ── Unhandled Rejections ──────────────────────────────────────
    process.on('unhandledRejection', (reason, promise) => {
        logger_1.default.fatal({ reason, promise }, 'Unhandled Promise Rejection');
        process.exit(1);
    });
    process.on('uncaughtException', (error) => {
        logger_1.default.fatal({ err: error }, 'Uncaught Exception');
        process.exit(1);
    });
}
// Run
start();
//# sourceMappingURL=server.js.map