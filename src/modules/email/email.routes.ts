import type { FastifyInstance, FastifyRequest } from 'fastify';
import { validate } from '@/middlewares/validate';
import { authenticate } from '@/middlewares/authenticate';
import {
  SendVerificationSchema,
  VerifyEmailSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from './email.schema';
import {
  sendVerificationHandler,
  verifyEmailHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  changePasswordHandler,
} from './email.controller';

function ipKey(prefix: string) {
  return (req: FastifyRequest): string => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip);
    return `${prefix}:${ip}`;
  };
}

export async function emailRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /auth/email/send-verification ─────────────────────
  // Rate limit ketat: 3 per 10 menit per IP (cegah email spam)
  app.post('/email/send-verification', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: 10 * 60 * 1000,
        keyGenerator: ipKey('send-verify'),
      },
    },
    preHandler: [validate({ body: SendVerificationSchema })],
    handler: sendVerificationHandler,
  });

  // ── POST /auth/email/verify ─────────────────────────────────
  // Publik — dipanggil dari link di email
  app.post('/email/verify', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 60 * 1000,
        keyGenerator: ipKey('verify-email'),
      },
    },
    preHandler: [validate({ body: VerifyEmailSchema })],
    handler: verifyEmailHandler,
  });

  // ── POST /auth/password/forgot ──────────────────────────────
  // Rate limit ketat: 3 per 15 menit per IP
  app.post('/password/forgot', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: 15 * 60 * 1000,
        keyGenerator: ipKey('forgot-pass'),
      },
    },
    preHandler: [validate({ body: ForgotPasswordSchema })],
    handler: forgotPasswordHandler,
  });

  // ── POST /auth/password/reset ───────────────────────────────
  // Publik — dipanggil dari link di email
  app.post('/password/reset', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 15 * 60 * 1000,
        keyGenerator: ipKey('reset-pass'),
      },
    },
    preHandler: [validate({ body: ResetPasswordSchema })],
    handler: resetPasswordHandler,
  });

  // ── PUT /auth/password/change ───────────────────────────────
  // Protected — butuh access token
  app.put('/password/change', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 15 * 60 * 1000,
        keyGenerator: ipKey('change-pass'),
      },
    },
    preHandler: [authenticate, validate({ body: ChangePasswordSchema })],
    handler: changePasswordHandler,
  });
}
