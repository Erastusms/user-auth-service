import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger('health');

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'ok' | 'error';
  };
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // GET /health — simple ping (tidak cek DB, untuk load balancer)
  app.get(
    '/health',
    {
      config: {
        // Skip rate limit untuk health check
        rateLimit: { max: 1000, timeWindow: 60000 },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply
        .status(200)
        .send({ status: 'ok', timestamp: new Date().toISOString() });
    },
  );

  // GET /health/full — cek semua services (untuk monitoring)
  app.get(
    '/health/full',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      let dbStatus: 'ok' | 'error' = 'ok';

      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        log.error({ err }, 'Database health check failed');
        dbStatus = 'error';
      }

      const overallStatus: HealthStatus['status'] =
        dbStatus === 'error' ? 'degraded' : 'ok';

      const body: HealthStatus = {
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
    },
  );
}
