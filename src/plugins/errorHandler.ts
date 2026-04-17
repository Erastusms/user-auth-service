import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  AppError,
  ValidationError,
  MfaRequiredError,
  InternalError,
  TokenInvalidError,
  TokenExpiredError,
  RateLimitError,
  NotFoundError,
  ConflictError,
} from '@/shared/errors';
import { errorResponse } from '@/shared/response';
import { createLogger } from '@/lib/logger';
import { isProd } from '@/config/env';

const log = createLogger('error-handler');

// fp() breaks encapsulation — errorHandler applies to all child scopes
export const errorHandlerPlugin = fp(async function errorHandlerPlugin(
  app: FastifyInstance,
): Promise<void> {
  app.setErrorHandler(
    (error: Error, request: FastifyRequest, reply: FastifyReply) => {
      // ── AppError (semua custom errors kita) ───────────────────
      if (error instanceof AppError) {
        if (error.isOperational) {
          log.warn(
            {
              requestId: request.id,
              url: request.url,
              method: request.method,
              statusCode: error.statusCode,
              code: error.code,
              message: error.message,
            },
            'Operational error',
          );
        } else {
          log.error(
            { err: error, requestId: request.id },
            'Non-operational AppError',
          );
        }
        return errorResponse(reply, error);
      }

      // ── JWT Errors ────────────────────────────────────────────
      if (error.name === 'JsonWebTokenError') {
        return errorResponse(reply, new TokenInvalidError());
      }
      if (error.name === 'TokenExpiredError') {
        return errorResponse(reply, new TokenExpiredError());
      }

      // ── Rate Limit (statusCode sudah di-set oleh plugin) ──────
      if (reply.statusCode === 429) {
        return errorResponse(reply, new RateLimitError());
      }

      // ── Prisma Errors ─────────────────────────────────────────
      const prismaErr = error as Error & {
        code?: string;
        meta?: Record<string, unknown>;
      };
      if (
        prismaErr.constructor?.name?.startsWith('Prisma') ||
        prismaErr.code?.startsWith('P')
      ) {
        log.warn(
          {
            err: { name: error.name, code: prismaErr.code },
            requestId: request.id,
          },
          'Prisma error',
        );

        if (prismaErr.code === 'P2002') {
          const fields = prismaErr.meta?.target as string[] | undefined;
          return errorResponse(
            reply,
            new ConflictError(
              `${fields?.join(', ') ?? 'Data'} sudah terdaftar.`,
            ),
          );
        }
        if (prismaErr.code === 'P2025') {
          return errorResponse(reply, new NotFoundError());
        }
        return errorResponse(reply, new InternalError());
      }

      // ── Unknown / Unexpected Error ────────────────────────────
      log.error({ err: error, requestId: request.id }, 'Unexpected error');
      return errorResponse(
        reply,
        new InternalError(
          isProd ? 'Terjadi kesalahan internal.' : error.message,
        ),
      );
    },
  );

  // ── 404 Handler ───────────────────────────────────────────────
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    log.warn(
      { requestId: request.id, url: request.url, method: request.method },
      'Route not found',
    );
    return errorResponse(
      reply,
      new NotFoundError(`Route ${request.method} ${request.url}`),
    );
  });
});
