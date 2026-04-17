import type { FastifyInstance, FastifyRequest } from 'fastify';
import { validate } from '@/middlewares/validate';
import { authenticate } from '@/middlewares/authenticate';
import { authRateLimitConfig } from '@/plugins/security';
import {
  RegisterSchema,
  LoginSchema,
  LogoutSchema,
  RefreshSchema,
  RevokeAllSchema,
} from './auth.schema';
import {
  registerHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  revokeAllHandler,
} from './auth.controller';

// Helper: rate-limit keyGenerator yang kompatibel dengan Fastify types
function ipKey(prefix: string) {
  return (req: FastifyRequest): string => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip);
    return `${prefix}:${ip}`;
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /auth/register ───────────────────────────────────
  app.post('/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 15 * 60 * 1000,
        keyGenerator: ipKey('register'),
      },
    },
    preHandler: [validate({ body: RegisterSchema })],
    handler: registerHandler,
  });

  // ── POST /auth/login ──────────────────────────────────────
  app.post('/login', {
    config: {
      rateLimit: {
        ...authRateLimitConfig,
        keyGenerator: ipKey('login'),
      },
    },
    preHandler: [validate({ body: LoginSchema })],
    handler: loginHandler,
  });

  // ── POST /auth/logout ─────────────────────────────────────
  app.post('/logout', {
    preHandler: [authenticate, validate({ body: LogoutSchema })],
    handler: logoutHandler,
  });

  // ── POST /auth/refresh ────────────────────────────────────
  app.post('/refresh', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: 60 * 1000,
        keyGenerator: ipKey('refresh'),
      },
    },
    preHandler: [validate({ body: RefreshSchema })],
    handler: refreshHandler,
  });

  // ── POST /auth/revoke-all ─────────────────────────────────
  app.post('/revoke-all', {
    preHandler: [authenticate, validate({ body: RevokeAllSchema })],
    handler: revokeAllHandler,
  });
}
