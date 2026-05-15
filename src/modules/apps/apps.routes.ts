import type { FastifyInstance, FastifyRequest } from 'fastify';
import { validate } from '@/middlewares/validate';
import { RegisterAppSchema } from './apps.schema';
import { registerAppHandler } from './apps.controller';

// Helper: rate-limit keyGenerator yang kompatibel dengan Fastify types
function ipKey(prefix: string) {
  return (req: FastifyRequest): string => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip);
    return `${prefix}:${ip}`;
  };
}

export async function appsRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /apps/register ────────────────────────────────────
  // Endpoint publik untuk mendaftarkan aplikasi baru ke sistem.
  // Tidak memerlukan autentikasi — ini adalah entry point bagi developer.
  app.post('/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 60 * 60 * 1000, // 1 jam
        keyGenerator: ipKey('app-register'),
      },
    },
    preHandler: [validate({ body: RegisterAppSchema })],
    handler: registerAppHandler,
  });
}
