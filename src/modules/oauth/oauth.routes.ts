import type { FastifyInstance, FastifyRequest } from 'fastify';
import { validate } from '@/middlewares/validate';
import { authenticate, optionalAuthenticate } from '@/middlewares/authenticate';
import {
  ProviderParamSchema,
  OAuthInitQuerySchema,
  OAuthCallbackQuerySchema,
  OAuthLinkBodySchema,
  OAuthUnlinkParamSchema,
} from './oauth.schema';
import {
  initiateOAuthHandler,
  oauthCallbackHandler,
  linkOAuthHandler,
  unlinkOAuthHandler,
  getLinkedProvidersHandler,
} from './oauth.controller';

function ipKey(prefix: string) {
  return (req: FastifyRequest): string => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip);
    return `${prefix}:${ip}`;
  };
}

export async function oauthRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /auth/oauth/:provider ─────────────────────────────
  // Publik — siapa saja bisa initiate OAuth (login baru atau link)
  // optionalAuthenticate: jika user sudah login, linkage mode aktif
  app.get('/:provider', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: 60 * 1000,
        keyGenerator: ipKey('oauth-init'),
      },
    },
    preHandler: [
      validate({ params: ProviderParamSchema, query: OAuthInitQuerySchema }),
      optionalAuthenticate,
    ],
    handler: initiateOAuthHandler,
  });

  // ── GET /auth/oauth/:provider/callback ────────────────────
  // Publik — dipanggil oleh provider setelah user approve
  // Rate limit longgar karena ini dari provider, bukan user langsung
  app.get('/:provider/callback', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: 60 * 1000,
        keyGenerator: ipKey('oauth-callback'),
      },
    },
    preHandler: [
      validate({
        params: ProviderParamSchema,
        query: OAuthCallbackQuerySchema,
      }),
    ],
    handler: oauthCallbackHandler,
  });

  // ── GET /auth/oauth/providers ─────────────────────────────
  // Protected — list provider yang terhubung
  app.get('/providers', {
    preHandler: [authenticate],
    handler: getLinkedProvidersHandler,
  });

  // ── POST /auth/oauth/link ─────────────────────────────────
  // Protected — initiate link provider baru ke akun yang sudah login
  app.post('/link', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 60 * 1000,
        keyGenerator: ipKey('oauth-link'),
      },
    },
    preHandler: [authenticate, validate({ body: OAuthLinkBodySchema })],
    handler: linkOAuthHandler,
  });

  // ── DELETE /auth/oauth/link/:provider ─────────────────────
  // Protected — hapus linked provider
  app.delete('/link/:provider', {
    preHandler: [authenticate, validate({ params: OAuthUnlinkParamSchema })],
    handler: unlinkOAuthHandler,
  });
}
