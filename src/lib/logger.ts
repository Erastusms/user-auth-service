import pino from 'pino';
import { env, isDev } from '@/config/env';

// ── Logger Configuration ──────────────────────────────────────
const transport =
  isDev || env.LOG_FORMAT === 'pretty'
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

export const logger = pino({
  level: env.LOG_LEVEL,
  transport,
  base: {
    env: env.NODE_ENV,
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
    req(req: {
      method: string;
      url: string;
      headers: Record<string, string>;
      id: string;
    }) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
      };
    },
    res(res: { statusCode: number }) {
      return {
        statusCode: res.statusCode,
      };
    },
    err: pino.stdSerializers.err,
  },
});

// ── Child Logger Factory ──────────────────────────────────────
// Gunakan untuk logging per-module dengan context tambahan.
export function createLogger(module: string) {
  return logger.child({ module });
}

export type Logger = typeof logger;
export default logger;
