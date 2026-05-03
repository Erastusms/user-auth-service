"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestPlugin = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const uuid_1 = require("uuid");
const logger_1 = require("../lib/logger");
const env_1 = require("../config/env");
const log = (0, logger_1.createLogger)('request');
// ── Request ID + HTTP Logging Plugin ─────────────────────────
exports.requestPlugin = (0, fastify_plugin_1.default)(async function requestPlugin(app) {
    // ── Request ID ───────────────────────────────────────────────
    // Setiap request mendapat unique ID untuk tracing/debugging.
    // Cek header X-Request-Id dulu (untuk distributed tracing),
    // kalau tidak ada generate sendiri.
    app.addHook('onRequest', (request, reply, done) => {
        const incomingId = request.headers['x-request-id'];
        const requestId = incomingId ?? (0, uuid_1.v4)();
        // Fastify sudah punya request.id tapi kita override agar bisa custom
        request.id = requestId;
        // Kirim kembali ke client
        void reply.header('X-Request-Id', requestId);
        done();
    });
    // ── HTTP Request/Response Logging ────────────────────────────
    app.addHook('onResponse', (request, reply, done) => {
        // Skip logging untuk health check
        if (request.url === '/health' || request.url === '/v1/health') {
            done();
            return;
        }
        const duration = reply.elapsedTime;
        const statusCode = reply.statusCode;
        const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        log[level]({
            requestId: request.id,
            method: request.method,
            url: request.url,
            statusCode,
            durationMs: Math.round(duration),
            userId: request.authUser?.id,
            ip: request.headers['x-forwarded-for'] ?? request.ip,
        }, `${request.method} ${request.url} ${statusCode}`);
        done();
    });
    // ── Log Unhandled Errors ──────────────────────────────────────
    app.addHook('onError', (request, _reply, error, done) => {
        log.debug({
            requestId: request.id,
            url: request.url,
            errName: error.name,
        }, 'Hook onError triggered');
        done();
    });
    // ── Development: log parsed body ─────────────────────────────
    if (env_1.isDev) {
        app.addHook('preHandler', (request, _reply, done) => {
            if (request.body && typeof request.body === 'object') {
                log.trace({ requestId: request.id, body: request.body }, 'Request body (dev only)');
            }
            done();
        });
    }
});
//# sourceMappingURL=request.js.map