import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@/lib/logger';
import { isDev } from '@/config/env';

const log = createLogger('request');

// ── Request ID + HTTP Logging Plugin ─────────────────────────
export const requestPlugin = fp(async function requestPlugin(
  app: FastifyInstance,
): Promise<void> {
  // ── Request ID ───────────────────────────────────────────────
  // Setiap request mendapat unique ID untuk tracing/debugging.
  // Cek header X-Request-Id dulu (untuk distributed tracing),
  // kalau tidak ada generate sendiri.
  app.addHook(
    'onRequest',
    (request: FastifyRequest, reply: FastifyReply, done) => {
      const incomingId = request.headers['x-request-id'] as string | undefined;
      const requestId = incomingId ?? uuidv4();

      // Fastify sudah punya request.id tapi kita override agar bisa custom
      (request as FastifyRequest & { id: string }).id = requestId;

      // Kirim kembali ke client
      void reply.header('X-Request-Id', requestId);

      done();
    },
  );

  // ── HTTP Request/Response Logging ────────────────────────────
  app.addHook(
    'onResponse',
    (request: FastifyRequest, reply: FastifyReply, done) => {
      // Skip logging untuk health check
      if (request.url === '/health' || request.url === '/v1/health') {
        done();
        return;
      }

      const duration = reply.elapsedTime;
      const statusCode = reply.statusCode;
      const level =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

      log[level](
        {
          requestId: request.id,
          method: request.method,
          url: request.url,
          statusCode,
          durationMs: Math.round(duration),
          userId: request.authUser?.id,
          ip: (request.headers['x-forwarded-for'] as string) ?? request.ip,
        },
        `${request.method} ${request.url} ${statusCode}`,
      );

      done();
    },
  );

  // ── Log Unhandled Errors ──────────────────────────────────────
  app.addHook('onError', (request, _reply, error, done) => {
    log.debug(
      {
        requestId: request.id,
        url: request.url,
        errName: error.name,
      },
      'Hook onError triggered',
    );
    done();
  });

  // ── Development: log parsed body ─────────────────────────────
  if (isDev) {
    app.addHook('preHandler', (request, _reply, done) => {
      if (request.body && typeof request.body === 'object') {
        log.trace(
          { requestId: request.id, body: request.body },
          'Request body (dev only)',
        );
      }
      done();
    });
  }
});
