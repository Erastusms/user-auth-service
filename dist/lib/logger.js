"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
const pino_1 = __importDefault(require("pino"));
const env_1 = require("../config/env");
// ── Logger Configuration ──────────────────────────────────────
const transport = env_1.isDev || env_1.env.LOG_FORMAT === 'pretty'
    ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
            singleLine: false,
        },
    }
    : undefined;
exports.logger = (0, pino_1.default)({
    level: env_1.env.LOG_LEVEL,
    transport,
    base: {
        env: env_1.env.NODE_ENV,
        service: 'user-auth-service',
    },
    // Redact sensitive fields dari semua log
    redact: {
        paths: [
            'password',
            'passwordHash',
            'currentPassword',
            'newPassword',
            'token',
            'accessToken',
            'refreshToken',
            'clientSecret',
            'jwtSecret',
            'encryptionKey',
            'req.headers.authorization',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'req.body.refreshToken',
        ],
        censor: '[REDACTED]',
    },
    // Custom serializers
    serializers: {
        req(req) {
            return {
                id: req.id,
                method: req.method,
                url: req.url,
                userAgent: req.headers['user-agent'],
            };
        },
        res(res) {
            return {
                statusCode: res.statusCode,
            };
        },
        err: pino_1.default.stdSerializers.err,
    },
});
// ── Child Logger Factory ──────────────────────────────────────
// Gunakan untuk logging per-module dengan context tambahan.
function createLogger(module) {
    return exports.logger.child({ module });
}
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map