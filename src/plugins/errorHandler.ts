import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppError, ValidationError, MfaRequiredError, InternalError } from '@/shared/errors';
import { errorResponse } from '@/shared/response';
import { createLogger } from '@/lib/logger';
import { HTTP } from '@/config/constants';
import { isProd } from '@/config/env';

const log = createLogger('error-handler');

// ── Global Error Handler Plugin ───────────────────────────────
export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler(
    (error: Error, request: FastifyRequest, reply: FastifyReply) => {
      // ── AppError (semua custom errors kita) ─────────────────
      if (error instanceof AppError) {
        // Log operational errors sebagai warn, non-operational sebagai error
        if (error.isOperational) {
          log.warn({
            requestId: request.id,
            url: request.url,
            method: request.method,
            statusCode: error.statusCode,
            code: error.code,
            message: error.message,
          }, 'Operational error');
        } else {
          log.error({
            err: error,
            requestId: request.id,
            url: request.url,
            method: request.method,
          }, 'Non-operational AppError');
        }

        return errorResponse(reply, error);
      }

      // ── Fastify Validation Error (JSON Schema default Fastify) ─
      // Kita tidak pakai ini tapi handle untuk keamanan
      if (error.name === 'ValidationError' || 'validation' in error) {
        const validationErr = new ValidationError([
          { field: 'request', message: error.message },
        ]);
        return errorResponse(reply, validationErr);
      }

      // ── JWT Error dari @fastify/jwt ───────────────────────────
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        const { TokenInvalidError, TokenExpiredError } = require('@/shared/errors');
        const jwtErr = error.name === 'TokenExpiredError'
          ? new TokenExpiredError()
          : new TokenInvalidError();
        return errorResponse(reply, jwtErr);
      }

      // ── Prisma Errors ─────────────────────────────────────────
      if (error.constructor?.name?.startsWith('Prisma')) {
        return handlePrismaError(error, request, reply);
      }

      // ── Rate Limit Error dari @fastify/rate-limit ────────────
      if (reply.statusCode === HTTP.TOO_MANY_REQUESTS) {
        const { RateLimitError } = require('@/shared/errors');
        return errorResponse(reply, new RateLimitError());
      }

      // ── Unknown / Unexpected Error ────────────────────────────
      log.error({
        err: error,
        requestId: request.id,
        url: request.url,
        method: request.method,
      }, 'Unexpected error');

      const internalErr = new InternalError(
        isProd ? 'Terjadi kesalahan internal.' : error.message
      );
      return errorResponse(reply, internalErr);
    }
  );

  // ── 404 Handler ───────────────────────────────────────────────
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const { NotFoundError } = require('@/shared/errors');
    log.warn({
      requestId: request.id,
      url: request.url,
      method: request.method,
    }, 'Route not found');

    return errorResponse(reply, new NotFoundError(`Route ${request.method} ${request.url}`));
  });
}

// ── Prisma Error Mapper ───────────────────────────────────────
function handlePrismaError(
  error: Error & { code?: string; meta?: Record<string, unknown> },
  request: FastifyRequest,
  reply: FastifyReply
): FastifyReply {
  const { ConflictError, NotFoundError, InternalError } = require('@/shared/errors');

  log.warn({
    err: {
      name: error.name,
      code: error.code,
      meta: error.meta,
      message: error.message,
    },
    requestId: request.id,
  }, 'Prisma error');

  switch (error.code) {
    // Unique constraint violation
    case 'P2002': {
      const fields = error.meta?.target as string[] | undefined;
      const fieldMsg = fields?.join(', ') ?? 'data';
      return errorResponse(reply, new ConflictError(`${fieldMsg} sudah terdaftar.`));
    }
    // Record not found
    case 'P2025':
      return errorResponse(reply, new NotFoundError());
    // Foreign key constraint
    case 'P2003':
      return errorResponse(
        reply,
        new ConflictError('Data terkait tidak ditemukan.')
      );
    default:
      return errorResponse(reply, new InternalError());
  }
}
