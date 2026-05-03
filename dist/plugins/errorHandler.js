"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlerPlugin = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const errors_1 = require("../shared/errors");
const response_1 = require("../shared/response");
const logger_1 = require("../lib/logger");
const env_1 = require("../config/env");
const log = (0, logger_1.createLogger)('error-handler');
// fp() breaks encapsulation — errorHandler applies to all child scopes
exports.errorHandlerPlugin = (0, fastify_plugin_1.default)(async function errorHandlerPlugin(app) {
    app.setErrorHandler((error, request, reply) => {
        // ── AppError (semua custom errors kita) ───────────────────
        if (error instanceof errors_1.AppError) {
            if (error.isOperational) {
                log.warn({
                    requestId: request.id,
                    url: request.url,
                    method: request.method,
                    statusCode: error.statusCode,
                    code: error.code,
                    message: error.message,
                }, 'Operational error');
            }
            else {
                log.error({ err: error, requestId: request.id }, 'Non-operational AppError');
            }
            return (0, response_1.errorResponse)(reply, error);
        }
        // ── JWT Errors ────────────────────────────────────────────
        if (error.name === 'JsonWebTokenError') {
            return (0, response_1.errorResponse)(reply, new errors_1.TokenInvalidError());
        }
        if (error.name === 'TokenExpiredError') {
            return (0, response_1.errorResponse)(reply, new errors_1.TokenExpiredError());
        }
        // ── Rate Limit (statusCode sudah di-set oleh plugin) ──────
        if (reply.statusCode === 429) {
            return (0, response_1.errorResponse)(reply, new errors_1.RateLimitError());
        }
        // ── Prisma Errors ─────────────────────────────────────────
        const prismaErr = error;
        if (prismaErr.constructor?.name?.startsWith('Prisma') ||
            prismaErr.code?.startsWith('P')) {
            log.warn({
                err: { name: error.name, code: prismaErr.code },
                requestId: request.id,
            }, 'Prisma error');
            if (prismaErr.code === 'P2002') {
                const fields = prismaErr.meta?.target;
                return (0, response_1.errorResponse)(reply, new errors_1.ConflictError(`${fields?.join(', ') ?? 'Data'} sudah terdaftar.`));
            }
            if (prismaErr.code === 'P2025') {
                return (0, response_1.errorResponse)(reply, new errors_1.NotFoundError());
            }
            return (0, response_1.errorResponse)(reply, new errors_1.InternalError());
        }
        // ── Unknown / Unexpected Error ────────────────────────────
        log.error({ err: error, requestId: request.id }, 'Unexpected error');
        return (0, response_1.errorResponse)(reply, new errors_1.InternalError(env_1.isProd ? 'Terjadi kesalahan internal.' : error.message));
    });
    // ── 404 Handler ───────────────────────────────────────────────
    app.setNotFoundHandler((request, reply) => {
        log.warn({ requestId: request.id, url: request.url, method: request.method }, 'Route not found');
        return (0, response_1.errorResponse)(reply, new errors_1.NotFoundError(`Route ${request.method} ${request.url}`));
    });
});
//# sourceMappingURL=errorHandler.js.map